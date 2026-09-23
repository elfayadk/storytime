import { DateTime } from 'luxon';
import { getJson } from '../util/http.js';
import type { TimelineEvent } from '../types.js';
import { classifyTarget, type Ingester, type IngestContext } from './base.js';

interface HnHit {
  objectID: string;
  created_at: string;
  author: string;
  title?: string;
  story_title?: string;
  comment_text?: string;
  url?: string;
  story_id?: number;
  points?: number;
  num_comments?: number;
  _tags?: string[];
}
interface HnResponse {
  hits: HnHit[];
}

/**
 * Hacker News activity via the public Algolia API (no key). Pulls a user's
 * stories and comments by author, keyed directly off the username.
 */
export const hackernewsIngester: Ingester = {
  platform: 'hackernews',
  applicable(target) {
    const { kind } = classifyTarget(target);
    return kind === 'username' || kind === 'handle';
  },
  async ingest(target, ctx): Promise<TimelineEvent[]> {
    const user = classifyTarget(target).value.split('@')[0];
    const n = Math.min(ctx.config.limitPerPlatform || 50, 100);
    const url = `https://hn.algolia.com/api/v1/search_by_date?tags=author_${encodeURIComponent(user)}&hitsPerPage=${n}`;

    let data: HnResponse;
    try {
      data = await getJson<HnResponse>(url, { userAgent: ctx.config.userAgent, minIntervalMs: 300 });
    } catch (err) {
      ctx.logger.warn(`hackernews: ${(err as Error).message}`);
      return [];
    }

    return (data.hits ?? [])
      .map((h) => toEvent(h))
      .filter((e): e is TimelineEvent => e !== null)
      .filter((e) => {
        if (ctx.since && e.timestamp < ctx.since) return false;
        if (ctx.until && e.timestamp > ctx.until) return false;
        return true;
      });
  },
};

function toEvent(h: HnHit): TimelineEvent | null {
  const ts = DateTime.fromISO(h.created_at);
  if (!ts.isValid) return null;
  const isComment = (h._tags ?? []).includes('comment') || !!h.comment_text;
  const hnUrl = `https://news.ycombinator.com/item?id=${h.objectID}`;
  const content = isComment
    ? stripBasicHtml(h.comment_text ?? '')
    : h.title ?? '';
  const title = isComment
    ? `Comment on "${h.story_title ?? 'a thread'}"`
    : h.title ?? 'Story';

  return {
    id: `hackernews:${h.objectID}`,
    platform: 'hackernews',
    category: isComment ? 'comment' : 'post',
    timestamp: ts,
    originalTimestamp: h.created_at,
    title,
    content,
    url: hnUrl,
    username: h.author,
    metrics: { likes: h.points, comments: h.num_comments },
    metadata: { linkedUrl: h.url, storyId: h.story_id },
  };
}

function stripBasicHtml(s: string): string {
  return s
    .replace(/<p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .trim();
}
