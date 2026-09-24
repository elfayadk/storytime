import { DateTime } from 'luxon';
import { getJson } from '../util/http.js';
import type { TimelineEvent, EventCategory } from '../types.js';
import { classifyTarget, type Ingester, type IngestContext } from './base.js';

interface GlUser {
  id: number;
  username: string;
  name: string;
}
interface GlEvent {
  id: number;
  action_name: string;
  target_type: string | null;
  target_title: string | null;
  created_at: string;
  author: { username: string };
  project_id: number;
  push_data?: { commit_count: number; ref: string; commit_title: string | null; ref_type: string };
  note?: { body: string };
}

const CATEGORY: Record<string, EventCategory> = {
  pushed: 'code_push',
  'pushed to': 'code_push',
  'pushed new': 'code_push',
  opened: 'code_pr',
  closed: 'code_pr',
  merged: 'code_pr',
  commented: 'comment',
  'commented on': 'comment',
  created: 'code_create',
};

/**
 * GitLab public account activity via the REST API v4 (no key for public data),
 * keyed off username. Mirrors the GitHub ingester for gitlab.com accounts.
 */
export const gitlabIngester: Ingester = {
  platform: 'gitlab',
  applicable(target) {
    const { kind } = classifyTarget(target);
    return kind === 'username' || kind === 'handle';
  },
  async ingest(target, ctx): Promise<TimelineEvent[]> {
    const user = classifyTarget(target).value.split('@')[0];
    const ua = ctx.config.userAgent;

    let users: GlUser[];
    try {
      users = await getJson<GlUser[]>(
        `https://gitlab.com/api/v4/users?username=${encodeURIComponent(user)}`,
        { userAgent: ua, minIntervalMs: 300 },
      );
    } catch (err) {
      ctx.logger.warn(`gitlab: lookup failed - ${(err as Error).message}`);
      return [];
    }
    const acct = users[0];
    if (!acct) return [];

    const n = Math.min(ctx.config.limitPerPlatform || 50, 100);
    let events: GlEvent[];
    try {
      events = await getJson<GlEvent[]>(
        `https://gitlab.com/api/v4/users/${acct.id}/events?per_page=${n}`,
        { userAgent: ua, minIntervalMs: 300 },
      );
    } catch (err) {
      ctx.logger.warn(`gitlab: events failed - ${(err as Error).message}`);
      return [];
    }

    return events
      .map((e) => toEvent(e, acct))
      .filter((e): e is TimelineEvent => e !== null)
      .filter((e) => {
        if (ctx.since && e.timestamp < ctx.since) return false;
        if (ctx.until && e.timestamp > ctx.until) return false;
        return true;
      });
  },
};

function toEvent(e: GlEvent, acct: GlUser): TimelineEvent | null {
  const ts = DateTime.fromISO(e.created_at);
  if (!ts.isValid) return null;
  const action = e.action_name;
  let title = `${action} ${e.target_type ?? ''}`.trim();
  let content = e.target_title ?? '';
  if (e.push_data) {
    const c = e.push_data.commit_count;
    title = `Pushed ${c} commit${c === 1 ? '' : 's'} to ${e.push_data.ref}`;
    content = e.push_data.commit_title ?? '';
  } else if (e.note?.body) {
    content = e.note.body;
  } else if (e.target_title) {
    title = `${action} ${e.target_type}: ${e.target_title}`;
  }

  return {
    id: `gitlab:${e.id}`,
    platform: 'gitlab',
    category: CATEGORY[action] ?? 'other',
    timestamp: ts,
    originalTimestamp: e.created_at,
    title,
    content,
    url: `https://gitlab.com/${acct.username}`,
    username: e.author?.username ?? acct.username,
    metadata: { action, projectId: e.project_id, targetType: e.target_type },
  };
}
