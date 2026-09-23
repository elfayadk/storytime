import { DateTime } from 'luxon';
import { getJson } from '../util/http.js';
import type { TimelineEvent, EventCategory } from '../types.js';
import { classifyTarget, type Ingester, type IngestContext } from './base.js';

interface GhActor {
  login: string;
}
interface GhRepo {
  name: string;
}
interface GhEvent {
  id: string;
  type: string;
  actor: GhActor;
  repo: GhRepo;
  created_at: string;
  payload: Record<string, any>;
}

const CATEGORY: Record<string, EventCategory> = {
  PushEvent: 'code_push',
  CreateEvent: 'code_create',
  PullRequestEvent: 'code_pr',
  IssuesEvent: 'code_issue',
  IssueCommentEvent: 'comment',
  CommitCommentEvent: 'comment',
  ForkEvent: 'share',
  WatchEvent: 'reaction',
  ReleaseEvent: 'code_create',
};

/** GitHub public activity. Token is OPTIONAL (only raises the 60→5000/hr limit). */
export const githubIngester: Ingester = {
  platform: 'github',
  applicable(target) {
    const { kind } = classifyTarget(target);
    return kind === 'username' || kind === 'handle';
  },
  async ingest(target, ctx): Promise<TimelineEvent[]> {
    const user = classifyTarget(target).value;
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (ctx.config.github.token) {
      headers.Authorization = `Bearer ${ctx.config.github.token}`;
    }
    const perPage = Math.min(ctx.config.limitPerPlatform || 50, 100);
    const url = `https://api.github.com/users/${encodeURIComponent(user)}/events/public?per_page=${perPage}`;

    let raw: GhEvent[];
    try {
      raw = await getJson<GhEvent[]>(url, {
        headers,
        userAgent: ctx.config.userAgent,
      });
    } catch (err) {
      ctx.logger.warn(`github: ${(err as Error).message}`);
      return [];
    }

    return raw
      .map((e) => toEvent(e, user))
      .filter((e): e is TimelineEvent => e !== null)
      .filter((e) => inWindow(e.timestamp, ctx));
  },
};

function toEvent(e: GhEvent, user: string): TimelineEvent | null {
  const ts = DateTime.fromISO(e.created_at);
  if (!ts.isValid) return null;
  const repo = e.repo?.name ?? '';
  let title = `${e.type} on ${repo}`;
  let content = '';
  let url = `https://github.com/${repo}`;

  switch (e.type) {
    case 'PushEvent': {
      const commits: any[] = e.payload.commits ?? [];
      const count = e.payload.size || commits.length;
      const branch = String(e.payload.ref ?? '').replace('refs/heads/', '');
      title = count
        ? `Pushed ${count} commit${count === 1 ? '' : 's'} to ${repo}${branch ? ` (${branch})` : ''}`
        : `Pushed to ${repo}${branch ? ` (${branch})` : ''}`;
      content = commits.map((c) => `- ${c.message}`).join('\n');
      break;
    }
    case 'PullRequestEvent': {
      const pr = e.payload.pull_request ?? {};
      title = `${e.payload.action} PR #${pr.number} in ${repo}`;
      content = `${pr.title ?? ''}\n${pr.body ?? ''}`.trim();
      url = pr.html_url ?? url;
      break;
    }
    case 'IssuesEvent': {
      const iss = e.payload.issue ?? {};
      title = `${e.payload.action} issue #${iss.number} in ${repo}`;
      content = `${iss.title ?? ''}\n${iss.body ?? ''}`.trim();
      url = iss.html_url ?? url;
      break;
    }
    case 'IssueCommentEvent':
    case 'CommitCommentEvent': {
      const c = e.payload.comment ?? {};
      title = `Commented in ${repo}`;
      content = c.body ?? '';
      url = c.html_url ?? url;
      break;
    }
    case 'CreateEvent':
      title = `Created ${e.payload.ref_type} ${e.payload.ref ?? ''} in ${repo}`.trim();
      break;
    case 'ForkEvent':
      title = `Forked ${repo}`;
      break;
    case 'WatchEvent':
      title = `Starred ${repo}`;
      break;
    case 'ReleaseEvent':
      title = `Released ${e.payload.release?.tag_name ?? ''} in ${repo}`;
      content = e.payload.release?.body ?? '';
      url = e.payload.release?.html_url ?? url;
      break;
  }

  return {
    id: `github:${e.id}`,
    platform: 'github',
    category: CATEGORY[e.type] ?? 'other',
    timestamp: ts,
    originalTimestamp: e.created_at,
    title,
    content,
    url,
    username: e.actor?.login ?? user,
    metadata: { githubType: e.type, repo },
  };
}

function inWindow(ts: DateTime, ctx: IngestContext): boolean {
  if (ctx.since && ts < ctx.since) return false;
  if (ctx.until && ts > ctx.until) return false;
  return true;
}
