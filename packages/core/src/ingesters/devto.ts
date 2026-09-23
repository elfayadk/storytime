import { DateTime } from 'luxon';
import { getJson } from '../util/http.js';
import type { TimelineEvent } from '../types.js';
import { classifyTarget, type Ingester, type IngestContext } from './base.js';

interface DevArticle {
  id: number;
  title: string;
  description: string;
  url: string;
  published_at: string;
  tag_list: string[];
  positive_reactions_count: number;
  comments_count: number;
  reading_time_minutes: number;
  user: { username: string; name: string };
}

/**
 * Dev.to published articles via the public API (no key), keyed off username.
 */
export const devtoIngester: Ingester = {
  platform: 'devto',
  applicable(target) {
    const { kind } = classifyTarget(target);
    return kind === 'username' || kind === 'handle';
  },
  async ingest(target, ctx): Promise<TimelineEvent[]> {
    const user = classifyTarget(target).value.split('@')[0];
    const n = Math.min(ctx.config.limitPerPlatform || 50, 100);
    const url = `https://dev.to/api/articles?username=${encodeURIComponent(user)}&per_page=${n}`;

    let articles: DevArticle[];
    try {
      articles = await getJson<DevArticle[]>(url, { userAgent: ctx.config.userAgent, minIntervalMs: 300 });
    } catch (err) {
      ctx.logger.warn(`devto: ${(err as Error).message}`);
      return [];
    }

    return articles
      .map((a) => toEvent(a))
      .filter((e): e is TimelineEvent => e !== null)
      .filter((e) => {
        if (ctx.since && e.timestamp < ctx.since) return false;
        if (ctx.until && e.timestamp > ctx.until) return false;
        return true;
      });
  },
};

function toEvent(a: DevArticle): TimelineEvent | null {
  const ts = DateTime.fromISO(a.published_at);
  if (!ts.isValid) return null;
  return {
    id: `devto:${a.id}`,
    platform: 'devto',
    category: 'article',
    timestamp: ts,
    originalTimestamp: a.published_at,
    title: a.title,
    content: a.description,
    url: a.url,
    username: a.user?.username ?? 'unknown',
    metrics: { likes: a.positive_reactions_count, comments: a.comments_count },
    topics: a.tag_list,
    metadata: { tags: a.tag_list, readingMinutes: a.reading_time_minutes },
  };
}
