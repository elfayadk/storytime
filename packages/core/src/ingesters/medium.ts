import { DateTime } from 'luxon';
import Parser from 'rss-parser';
import type { TimelineEvent } from '../types.js';
import { classifyTarget, stripHtml, type Ingester, type IngestContext } from './base.js';

const parser = new Parser({ timeout: 15000 });

/**
 * Medium posts via the public per-user RSS feed (medium.com/feed/@user).
 * Keyless, keyed off username.
 */
export const mediumIngester: Ingester = {
  platform: 'medium',
  applicable(target) {
    const { kind } = classifyTarget(target);
    return kind === 'username' || kind === 'handle';
  },
  async ingest(target, ctx): Promise<TimelineEvent[]> {
    const user = classifyTarget(target).value.split('@')[0];
    const url = `https://medium.com/feed/@${encodeURIComponent(user)}`;
    let feed;
    try {
      feed = await parser.parseURL(url);
    } catch (err) {
      ctx.logger.warn(`medium: ${(err as Error).message}`);
      return [];
    }
    return feed.items
      .slice(0, ctx.config.limitPerPlatform || 50)
      .map((item) => {
        const iso = item.isoDate ?? item.pubDate ?? '';
        const ts = iso ? DateTime.fromISO(DateTime.fromRFC2822(iso).isValid ? DateTime.fromRFC2822(iso).toISO()! : iso) : DateTime.invalid('no-date');
        const stamp = ts.isValid ? ts : DateTime.fromJSDate(new Date(iso));
        if (!stamp.isValid) return null;
        return {
          id: `medium:${item.guid ?? item.link}`,
          platform: 'medium' as const,
          category: 'article' as const,
          timestamp: stamp,
          originalTimestamp: iso,
          title: item.title ?? 'Untitled',
          content: stripHtml(item['content:encoded'] ?? item.content ?? item.contentSnippet ?? '').slice(0, 600),
          url: item.link ?? url,
          username: user,
          topics: item.categories ?? [],
          metadata: { categories: item.categories ?? [] },
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
