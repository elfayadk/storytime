import { DateTime } from 'luxon';
import Parser from 'rss-parser';
import { getText } from '../util/http.js';
import type { TimelineEvent } from '../types.js';
import { classifyTarget, type Ingester, type IngestContext } from './base.js';

const parser = new Parser({ timeout: 15000 });

/**
 * YouTube uploads via the public channel RSS feed. Resolves a @handle or legacy
 * name to a channel id from the public channel page, then reads the keyless
 * feeds/videos.xml feed. A raw UC... channel id is used directly.
 */
export const youtubeIngester: Ingester = {
  platform: 'youtube',
  applicable(target) {
    const { kind } = classifyTarget(target);
    return kind === 'username' || kind === 'handle';
  },
  async ingest(target, ctx): Promise<TimelineEvent[]> {
    const value = classifyTarget(target).value.split('@')[0];
    const channelId = await resolveChannelId(value, ctx);
    if (!channelId) {
      ctx.logger.warn(`youtube: could not resolve channel for "${value}"`);
      return [];
    }

    let feed;
    try {
      feed = await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    } catch (err) {
      ctx.logger.warn(`youtube: feed failed - ${(err as Error).message}`);
      return [];
    }

    return feed.items
      .slice(0, ctx.config.limitPerPlatform || 50)
      .map((item) => {
        const iso = item.isoDate ?? item.pubDate ?? '';
        const ts = iso ? DateTime.fromISO(iso) : DateTime.invalid('no-date');
        if (!ts.isValid) return null;
        return {
          id: `youtube:${item.id ?? item.link}`,
          platform: 'youtube' as const,
          category: 'post' as const,
          timestamp: ts,
          originalTimestamp: iso,
          title: item.title ?? 'Video',
          content: (item.contentSnippet ?? '').slice(0, 500),
          url: item.link ?? '',
          username: (item.author as string) ?? value,
          metadata: { channelId },
        } as TimelineEvent;
      })
      .filter((e): e is TimelineEvent => e !== null)
      .filter((e) => {
        if (ctx.since && e.timestamp < ctx.since) return false;
        if (ctx.until && e.timestamp > ctx.until) return false;
        return true;
      });
  },
};

async function resolveChannelId(value: string, ctx: IngestContext): Promise<string | null> {
  if (/^UC[\w-]{20,}$/.test(value)) return value; // already a channel id
  const candidates = [`https://www.youtube.com/@${value}`, `https://www.youtube.com/user/${value}`, `https://www.youtube.com/c/${value}`];
  for (const url of candidates) {
    try {
      const html = await getText(url, { userAgent: ctx.config.userAgent, timeoutMs: 12000, retries: 0 });
      const m =
        html.match(/"channelId":"(UC[\w-]{20,})"/) ??
        html.match(/"externalId":"(UC[\w-]{20,})"/) ??
        html.match(/<meta itemprop="(?:channelId|identifier)" content="(UC[\w-]{20,})"/);
      if (m) return m[1];
    } catch {
      /* try next candidate */
    }
  }
  return null;
}
