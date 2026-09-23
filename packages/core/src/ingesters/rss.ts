import { DateTime } from 'luxon';
import Parser from 'rss-parser';
import type { TimelineEvent } from '../types.js';
import { stripHtml, type Ingester, type IngestContext } from './base.js';

const parser = new Parser({ timeout: 20000 });

/**
 * RSS / Atom blog & news feeds. Feeds come from config.rssFeeds (STORYTIME
 * `RSS_FEEDS` env or CLI). Fully free - just HTTP fetches of public feeds.
 */
export const rssIngester: Ingester = {
  platform: 'rss',
  applicable(_target, ctx) {
    return ctx.config.rssFeeds.length > 0;
  },
  async ingest(_target, ctx): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    for (const feedUrl of ctx.config.rssFeeds) {
      try {
        const feed = await parser.parseURL(feedUrl);
        const feedTitle = feed.title ?? feedUrl;
        for (const item of feed.items.slice(0, ctx.config.limitPerPlatform || 50)) {
          const iso = item.isoDate ?? item.pubDate ?? '';
          const ts = iso ? DateTime.fromISO(DateTime.fromRFC2822(iso).isValid ? DateTime.fromRFC2822(iso).toISO()! : iso) : DateTime.invalid('no-date');
          const stamp = ts.isValid ? ts : DateTime.fromJSDate(new Date(iso));
          if (!stamp.isValid) continue;
          if (ctx.since && stamp < ctx.since) continue;
          if (ctx.until && stamp > ctx.until) continue;
          events.push({
            id: `rss:${item.guid ?? item.link ?? item.title ?? Math.random()}`,
            platform: 'rss',
            category: 'blog_post',
            timestamp: stamp,
            originalTimestamp: iso,
            title: item.title ?? 'Untitled',
            content: stripHtml(item.contentSnippet ?? item.content ?? item['content:encoded'] ?? ''),
            url: item.link ?? feedUrl,
            username: item.creator ?? feedTitle,
            metadata: { feed: feedTitle, feedUrl, categories: item.categories ?? [] },
          });
        }
      } catch (err) {
        ctx.logger.warn(`rss(${feedUrl}): ${(err as Error).message}`);
      }
    }
    return events;
  },
};
