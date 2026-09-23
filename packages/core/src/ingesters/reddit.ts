import { DateTime } from 'luxon';
import { getJson, httpGet } from '../util/http.js';
import type { StorytimeConfig } from '../config.js';
import type { TimelineEvent, EventCategory } from '../types.js';
import { classifyTarget, type Ingester, type IngestContext } from './base.js';

interface RedditChild {
  kind: string; // t1 = comment, t3 = link/post
  data: {
    id: string;
    name: string;
    author: string;
    created_utc: number;
    permalink: string;
    subreddit: string;
    title?: string;
    selftext?: string;
    body?: string;
    url?: string;
    ups?: number;
    num_comments?: number;
    link_title?: string;
  };
}
interface RedditListing {
  data: { children: RedditChild[]; after: string | null };
}

/**
 * Reddit public user activity via the open `.json` endpoint - no OAuth, no key.
 * This intentionally replaces the old snoowrap/OAuth path.
 */
export const redditIngester: Ingester = {
  platform: 'reddit',
  applicable(target) {
    const { kind } = classifyTarget(target);
    return kind === 'username' || kind === 'handle';
  },
  async ingest(target, ctx): Promise<TimelineEvent[]> {
    const user = classifyTarget(target).value;
    const limit = Math.min(ctx.config.limitPerPlatform || 50, 100);
    const ua = ctx.config.reddit.userAgent;

    // Prefer free OAuth (reliable) when app creds are present; otherwise fall
    // back to the public .json endpoint (works from many residential IPs).
    const token = await getAppToken(ctx.config, ua);
    const base = token ? 'https://oauth.reddit.com' : 'https://www.reddit.com';
    const url = `${base}/user/${encodeURIComponent(user)}/.json?limit=${limit}&raw_json=1`;

    let listing: RedditListing;
    try {
      listing = await getJson<RedditListing>(url, {
        userAgent: ua,
        minIntervalMs: 1000,
        headers: token ? { Authorization: `bearer ${token}` } : undefined,
      });
    } catch (err) {
      const msg = (err as Error).message;
      if (!token && /\b403\b/.test(msg)) {
        ctx.logger.warn(
          'reddit: 403 on public endpoint (blocked from this network). Set free ' +
            'REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET (https://www.reddit.com/prefs/apps) for reliable access.',
        );
      } else {
        ctx.logger.warn(`reddit: ${msg}`);
      }
      return [];
    }

    return (listing.data?.children ?? [])
      .map((c) => toEvent(c))
      .filter((e): e is TimelineEvent => e !== null)
      .filter((e) => {
        if (ctx.since && e.timestamp < ctx.since) return false;
        if (ctx.until && e.timestamp > ctx.until) return false;
        return true;
      });
  },
};

let cachedToken: { value: string; expires: number } | null = null;

/** Free Reddit app-only OAuth (client_credentials). Returns null if no creds. */
async function getAppToken(
  config: StorytimeConfig,
  ua: string,
): Promise<string | null> {
  const { clientId, clientSecret } = config.reddit;
  if (!clientId || !clientSecret) return null;
  if (cachedToken && cachedToken.expires > Date.now()) return cachedToken.value;
  try {
    const res = await httpGet('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      userAgent: ua,
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    cachedToken = {
      value: data.access_token,
      expires: Date.now() + (data.expires_in ?? 3600) * 1000 - 60000,
    };
    return cachedToken.value;
  } catch {
    return null;
  }
}

function toEvent(c: RedditChild): TimelineEvent | null {
  const d = c.data;
  const ts = DateTime.fromSeconds(d.created_utc);
  if (!ts.isValid) return null;
  const isComment = c.kind === 't1';
  const category: EventCategory = isComment ? 'comment' : 'post';
  const title = isComment
    ? `Comment in r/${d.subreddit}${d.link_title ? `: ${d.link_title}` : ''}`
    : d.title ?? `Post in r/${d.subreddit}`;
  const content = isComment ? d.body ?? '' : d.selftext ?? d.url ?? '';

  return {
    id: `reddit:${d.name}`,
    platform: 'reddit',
    category,
    timestamp: ts,
    originalTimestamp: new Date(d.created_utc * 1000).toISOString(),
    title,
    content,
    url: `https://www.reddit.com${d.permalink}`,
    username: d.author,
    metrics: { likes: d.ups, comments: d.num_comments },
    metadata: { subreddit: d.subreddit, kind: c.kind },
  };
}
