import { DateTime } from 'luxon';
import { getJson } from '../util/http.js';
import type { TimelineEvent, MediaAttachment } from '../types.js';
import { classifyTarget, stripHtml, type Ingester, type IngestContext } from './base.js';

interface MastoAccount {
  id: string;
  acct: string;
  username: string;
}
interface MastoStatus {
  id: string;
  created_at: string;
  content: string;
  url: string;
  reblog: MastoStatus | null;
  in_reply_to_id: string | null;
  favourites_count: number;
  reblogs_count: number;
  replies_count: number;
  language: string | null;
  account: { acct: string };
  media_attachments: { type: string; url: string; description: string | null }[];
}

/**
 * Mastodon public account activity. No auth needed for public statuses - a
 * free/OSS replacement for the paid Twitter/X ingester.
 * Accepts `user`, `@user`, or full `user@instance.tld` (webfinger handle).
 */
export const mastodonIngester: Ingester = {
  platform: 'mastodon',
  applicable(target) {
    const { kind } = classifyTarget(target);
    return kind === 'username' || kind === 'handle';
  },
  async ingest(target, ctx): Promise<TimelineEvent[]> {
    const raw = classifyTarget(target).value; // may be "user" or "user@instance"
    const [user, handleInstance] = raw.split('@');
    const instance = handleInstance || ctx.config.mastodon.instance;
    const acct = handleInstance ? `${user}@${handleInstance}` : user;
    const ua = ctx.config.userAgent;

    let account: MastoAccount;
    try {
      account = await getJson<MastoAccount>(
        `https://${instance}/api/v1/accounts/lookup?acct=${encodeURIComponent(acct)}`,
        { userAgent: ua, minIntervalMs: 300 },
      );
    } catch (err) {
      ctx.logger.warn(`mastodon(${instance}): lookup failed - ${(err as Error).message}`);
      return [];
    }

    const limit = Math.min(ctx.config.limitPerPlatform || 40, 40);
    let statuses: MastoStatus[];
    try {
      statuses = await getJson<MastoStatus[]>(
        `https://${instance}/api/v1/accounts/${account.id}/statuses?limit=${limit}&exclude_replies=false`,
        { userAgent: ua, minIntervalMs: 300 },
      );
    } catch (err) {
      ctx.logger.warn(`mastodon(${instance}): statuses failed - ${(err as Error).message}`);
      return [];
    }

    return statuses
      .map((s) => toEvent(s, instance))
      .filter((e): e is TimelineEvent => e !== null)
      .filter((e) => {
        if (ctx.since && e.timestamp < ctx.since) return false;
        if (ctx.until && e.timestamp > ctx.until) return false;
        return true;
      });
  },
};

function toEvent(s: MastoStatus, instance: string): TimelineEvent | null {
  const ts = DateTime.fromISO(s.created_at);
  if (!ts.isValid) return null;
  const isReblog = !!s.reblog;
  const src = s.reblog ?? s;
  const text = stripHtml(src.content);
  const media: MediaAttachment[] = (src.media_attachments ?? []).map((m) => ({
    type: (['image', 'video', 'audio'].includes(m.type) ? m.type : 'other') as MediaAttachment['type'],
    url: m.url,
    description: m.description ?? undefined,
  }));

  return {
    id: `mastodon:${s.id}`,
    platform: 'mastodon',
    category: isReblog ? 'share' : s.in_reply_to_id ? 'comment' : 'post',
    timestamp: ts,
    originalTimestamp: s.created_at,
    title: isReblog ? `Boosted @${src.account.acct}` : text.slice(0, 80) || 'Toot',
    content: text,
    url: src.url || s.url,
    username: s.account.acct,
    media: media.length ? media : undefined,
    metrics: {
      likes: src.favourites_count,
      shares: src.reblogs_count,
      comments: src.replies_count,
    },
    relations: s.in_reply_to_id
      ? [{ type: 'reply_to', targetId: `mastodon:${s.in_reply_to_id}` }]
      : undefined,
    language: src.language ?? undefined,
    metadata: { instance, boosted: isReblog },
  };
}
