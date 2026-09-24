import { DateTime } from 'luxon';
import { getJson } from '../util/http.js';
import type { TimelineEvent } from '../types.js';
import { classifyTarget, type Ingester, type IngestContext } from './base.js';

interface LemmyPost {
  post: { id: number; name: string; body?: string; published: string; ap_id: string; url?: string };
  counts?: { score: number; comments: number };
  community?: { name: string };
}
interface LemmyComment {
  comment: { id: number; content: string; published: string; ap_id: string };
  post?: { name: string };
  counts?: { score: number };
  community?: { name: string };
}
interface LemmyUser {
  posts: LemmyPost[];
  comments: LemmyComment[];
  person_view?: { person: { name: string } };
}

/**
 * Lemmy (fediverse link aggregator) public user activity via the v3 API.
 * Keyless. Accepts `user` or `user@instance`; defaults to lemmy.world.
 */
export const lemmyIngester: Ingester = {
  platform: 'lemmy',
  applicable(target) {
    const { kind } = classifyTarget(target);
    return kind === 'username' || kind === 'handle';
  },
  async ingest(target, ctx): Promise<TimelineEvent[]> {
    const raw = classifyTarget(target).value;
    const [user, handleInstance] = raw.split('@');
    const instance = handleInstance || process.env.LEMMY_INSTANCE || 'lemmy.world';
    const limit = Math.min(ctx.config.limitPerPlatform || 50, 50);
    const url = `https://${instance}/api/v3/user?username=${encodeURIComponent(user)}&sort=New&limit=${limit}`;

    let data: LemmyUser;
    try {
      data = await getJson<LemmyUser>(url, { userAgent: ctx.config.userAgent, minIntervalMs: 300 });
    } catch (err) {
      ctx.logger.warn(`lemmy(${instance}): ${(err as Error).message}`);
      return [];
    }

    const events: TimelineEvent[] = [];
    for (const p of data.posts ?? []) {
      const ts = DateTime.fromISO(p.post.published, { zone: 'utc' });
      if (!ts.isValid) continue;
      events.push({
        id: `lemmy:post:${p.post.id}`,
        platform: 'lemmy',
        category: 'post',
        timestamp: ts,
        originalTimestamp: p.post.published,
        title: p.post.name,
        content: p.post.body ?? p.post.url ?? '',
        url: p.post.ap_id,
        username: user,
        metrics: { likes: p.counts?.score, comments: p.counts?.comments },
        metadata: { community: p.community?.name },
      });
    }
    for (const c of data.comments ?? []) {
      const ts = DateTime.fromISO(c.comment.published, { zone: 'utc' });
      if (!ts.isValid) continue;
      events.push({
        id: `lemmy:comment:${c.comment.id}`,
        platform: 'lemmy',
        category: 'comment',
        timestamp: ts,
        originalTimestamp: c.comment.published,
        title: c.post?.name ? `Comment on "${c.post.name}"` : 'Comment',
        content: c.comment.content,
        url: c.comment.ap_id,
        username: user,
        metrics: { likes: c.counts?.score },
        metadata: { community: c.community?.name },
      });
    }
    return events.filter((e) => {
      if (ctx.since && e.timestamp < ctx.since) return false;
      if (ctx.until && e.timestamp > ctx.until) return false;
      return true;
    });
  },
};
