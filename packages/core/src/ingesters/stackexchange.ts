import { DateTime } from 'luxon';
import { getJson } from '../util/http.js';
import type { TimelineEvent, EventCategory } from '../types.js';
import { classifyTarget, type Ingester, type IngestContext } from './base.js';

interface SeUser {
  user_id: number;
  display_name: string;
  reputation: number;
}
interface SeTimelineItem {
  timeline_type: string;
  creation_date: number;
  post_id?: number;
  question_id?: number;
  title?: string;
  link?: string;
  detail?: string;
}
interface SeResponse<T> {
  items: T[];
}

const CATEGORY: Record<string, EventCategory> = {
  answer: 'comment',
  question: 'post',
  commented: 'comment',
  revision: 'other',
  accepted: 'reaction',
};

/**
 * Stack Overflow activity via the public Stack Exchange API (no key; ~300
 * requests/day per IP). Resolves the best name match, then reads their timeline.
 */
export const stackexchangeIngester: Ingester = {
  platform: 'stackexchange',
  applicable(target) {
    const { kind } = classifyTarget(target);
    return kind === 'username' || kind === 'handle';
  },
  async ingest(target, ctx): Promise<TimelineEvent[]> {
    const name = classifyTarget(target).value.split('@')[0];
    const site = process.env.STACKEXCHANGE_SITE || 'stackoverflow';
    const ua = ctx.config.userAgent;

    let users: SeUser[];
    try {
      users = (
        await getJson<SeResponse<SeUser>>(
          `https://api.stackexchange.com/2.3/users?inname=${encodeURIComponent(name)}&site=${site}&order=desc&sort=reputation&pagesize=1`,
          { userAgent: ua, minIntervalMs: 300 },
        )
      ).items;
    } catch (err) {
      ctx.logger.warn(`stackexchange: lookup failed - ${(err as Error).message}`);
      return [];
    }
    const u = users[0];
    if (!u) return [];

    const n = Math.min(ctx.config.limitPerPlatform || 50, 100);
    let items: SeTimelineItem[];
    try {
      items = (
        await getJson<SeResponse<SeTimelineItem>>(
          `https://api.stackexchange.com/2.3/users/${u.user_id}/timeline?site=${site}&pagesize=${n}`,
          { userAgent: ua, minIntervalMs: 300 },
        )
      ).items;
    } catch (err) {
      ctx.logger.warn(`stackexchange: timeline failed - ${(err as Error).message}`);
      return [];
    }

    return items
      .filter((i) => CATEGORY[i.timeline_type])
      .map((i) => toEvent(i, u, site))
      .filter((e): e is TimelineEvent => e !== null)
      .filter((e) => {
        if (ctx.since && e.timestamp < ctx.since) return false;
        if (ctx.until && e.timestamp > ctx.until) return false;
        return true;
      });
  },
};

function toEvent(i: SeTimelineItem, u: SeUser, site: string): TimelineEvent | null {
  const ts = DateTime.fromSeconds(i.creation_date);
  if (!ts.isValid) return null;
  const verb = i.timeline_type;
  const title = i.title ? `${cap(verb)}: ${decode(i.title)}` : `${cap(verb)} on ${site}`;
  const postId = i.post_id ?? i.question_id;
  const url = i.link ?? (postId ? `https://${site}.com/q/${postId}` : `https://${site}.com/users/${u.user_id}`);
  return {
    id: `stackexchange:${verb}:${postId ?? i.creation_date}`,
    platform: 'stackexchange',
    category: CATEGORY[verb] ?? 'other',
    timestamp: ts,
    originalTimestamp: new Date(i.creation_date * 1000).toISOString(),
    title,
    content: i.detail ? decode(i.detail) : '',
    url,
    username: u.display_name,
    metadata: { site, timelineType: verb },
  };
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function decode(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
