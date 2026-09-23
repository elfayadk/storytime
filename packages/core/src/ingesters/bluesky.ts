import { DateTime } from 'luxon';
import { getJson } from '../util/http.js';
import type { TimelineEvent, MediaAttachment } from '../types.js';
import { classifyTarget, type Ingester, type IngestContext } from './base.js';

interface BskyPost {
  uri: string;
  cid: string;
  author: { handle: string; displayName?: string; did: string };
  record: { text?: string; createdAt?: string; reply?: { parent?: { uri: string } } };
  embed?: { images?: { fullsize: string; alt?: string }[] };
  likeCount?: number;
  repostCount?: number;
  replyCount?: number;
  indexedAt?: string;
}
interface BskyFeedItem {
  post: BskyPost;
  reason?: { $type: string };
}
interface BskyFeed {
  feed: BskyFeedItem[];
  cursor?: string;
}

/**
 * Bluesky public author feed via the unauthenticated AppView
 * (public.api.bsky.app) - no app-password required for public posts.
 * Free/OSS replacement for the paid Twitter/X ingester.
 */
export const blueskyIngester: Ingester = {
  platform: 'bluesky',
  applicable(target) {
    const { kind } = classifyTarget(target);
    return kind === 'username' || kind === 'handle';
  },
  async ingest(target, ctx): Promise<TimelineEvent[]> {
    const actor = normalizeHandle(classifyTarget(target).value);
    const limit = Math.min(ctx.config.limitPerPlatform || 50, 100);
    const base = ctx.config.bluesky.service.replace(/\/$/, '');
    const url = `${base}/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(actor)}&limit=${limit}`;

    let feed: BskyFeed;
    try {
      feed = await getJson<BskyFeed>(url, {
        userAgent: ctx.config.userAgent,
        minIntervalMs: 200,
      });
    } catch (err) {
      ctx.logger.warn(`bluesky: ${(err as Error).message}`);
      return [];
    }

    return (feed.feed ?? [])
      .map((item) => toEvent(item))
      .filter((e): e is TimelineEvent => e !== null)
      .filter((e) => {
        if (ctx.since && e.timestamp < ctx.since) return false;
        if (ctx.until && e.timestamp > ctx.until) return false;
        return true;
      });
  },
};

function normalizeHandle(h: string): string {
  if (h.startsWith('did:')) return h;
  if (h.includes('.')) return h; // already a full handle or custom domain
  return `${h}.bsky.social`;
}

function toEvent(item: BskyFeedItem): TimelineEvent | null {
  const p = item.post;
  const created = p.record?.createdAt || p.indexedAt || '';
  const ts = DateTime.fromISO(created);
  if (!ts.isValid) return null;
  const isRepost = item.reason?.$type?.includes('Repost');
  const text = p.record?.text ?? '';
  const rkey = p.uri.split('/').pop() ?? '';
  const webUrl = `https://bsky.app/profile/${p.author.handle}/post/${rkey}`;
  const media: MediaAttachment[] = (p.embed?.images ?? []).map((img) => ({
    type: 'image',
    url: img.fullsize,
    description: img.alt,
  }));

  return {
    id: `bluesky:${p.uri}`,
    platform: 'bluesky',
    category: isRepost ? 'share' : p.record?.reply ? 'comment' : 'post',
    timestamp: ts,
    originalTimestamp: created,
    title: isRepost ? `Reposted @${p.author.handle}` : text.slice(0, 80) || 'Post',
    content: text,
    url: webUrl,
    username: p.author.handle,
    media: media.length ? media : undefined,
    metrics: { likes: p.likeCount, shares: p.repostCount, comments: p.replyCount },
    relations: p.record?.reply?.parent?.uri
      ? [{ type: 'reply_to', targetId: `bluesky:${p.record.reply.parent.uri}` }]
      : undefined,
    metadata: { did: p.author.did, repost: !!isRepost },
  };
}
