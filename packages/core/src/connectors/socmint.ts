import { provenance } from './provenance.js';
import { sha256 } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type Connector, type RawItem } from './types.js';

/**
 * SOCMINT username presence (upgrade pack P2). Given a username, check whether a
 * public profile by that name exists on a set of platforms. Detection is
 * content-differential, never status-alone: a platform is reported "present"
 * only on a positive signal (a definitive 200 on a 404-capable route, or an
 * explicit body/JSON marker), "absent" only on a definitive negative, and
 * "unknown" otherwise (a bot wall, a 403/429, or an ambiguous soft-200). This
 * is deliberately conservative: a false "present" is worse than an "unknown".
 * Public profile pages only; no private data, no message contents.
 */
type Presence = 'present' | 'absent' | 'unknown';

interface Platform {
  name: string;
  profileUrl: (u: string) => string;
  check: (u: string, ua: string) => Promise<Presence>;
}

async function fetchStatusBody(url: string, ua: string, timeoutMs = 9000): Promise<{ status: number; body: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'user-agent': ua, accept: 'text/html,application/json,*/*' },
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = await res.text().catch(() => '');
    return { status: res.status, body };
  } catch {
    return null;
  }
}

/** Status-code presence for platforms that return a clean 200/404 per profile. */
function byStatus(url: (u: string) => string): (u: string, ua: string) => Promise<Presence> {
  return async (u, ua) => {
    const r = await fetchStatusBody(url(u), ua);
    if (!r) return 'unknown';
    if (r.status === 404 || r.status === 410) return 'absent';
    if (r.status >= 200 && r.status < 300) return 'present';
    if (r.status === 301 || r.status === 302) return 'unknown'; // redirect to login/home: ambiguous
    return 'unknown'; // 403/429/5xx: bot wall or outage, not a real answer
  };
}

const PLATFORMS: Platform[] = [
  { name: 'GitHub', profileUrl: (u) => `https://github.com/${u}`, check: byStatus((u) => `https://api.github.com/users/${u}`) },
  { name: 'Dev.to', profileUrl: (u) => `https://dev.to/${u}`, check: byStatus((u) => `https://dev.to/${u}`) },
  { name: 'npm', profileUrl: (u) => `https://www.npmjs.com/~${u}`, check: byStatus((u) => `https://www.npmjs.com/~${u}`) },
  { name: 'Lobsters', profileUrl: (u) => `https://lobste.rs/~${u}`, check: byStatus((u) => `https://lobste.rs/~${u}`) },
  {
    name: 'GitLab', profileUrl: (u) => `https://gitlab.com/${u}`, check: async (u, ua) => {
      const r = await fetchStatusBody(`https://gitlab.com/api/v4/users?username=${u}`, ua);
      if (!r || r.status !== 200) return 'unknown';
      try { return (JSON.parse(r.body) as unknown[]).length > 0 ? 'present' : 'absent'; } catch { return 'unknown'; }
    },
  },
  {
    name: 'Keybase', profileUrl: (u) => `https://keybase.io/${u}`, check: async (u, ua) => {
      const r = await fetchStatusBody(`https://keybase.io/_/api/1.0/user/lookup.json?usernames=${u}&fields=basics`, ua);
      if (!r || r.status !== 200) return 'unknown';
      try {
        const d = JSON.parse(r.body) as { them?: unknown[] };
        return Array.isArray(d.them) && d.them.some(Boolean) ? 'present' : 'absent';
      } catch { return 'unknown'; }
    },
  },
  {
    name: 'Hacker News', profileUrl: (u) => `https://news.ycombinator.com/user?id=${u}`, check: async (u, ua) => {
      const r = await fetchStatusBody(`https://hacker-news.firebaseio.com/v0/user/${u}.json`, ua);
      if (!r || r.status !== 200) return 'unknown';
      return r.body.trim() === 'null' ? 'absent' : 'present';
    },
  },
  {
    name: 'Telegram', profileUrl: (u) => `https://t.me/${u}`, check: async (u, ua) => {
      const r = await fetchStatusBody(`https://t.me/${u}`, ua);
      if (!r || r.status !== 200) return 'unknown';
      if (r.body.includes('tgme_page_title')) return 'present';
      if (r.body.includes('tgme_page_additional') || r.body.includes('If you have <strong>Telegram</strong>')) return 'absent';
      return 'unknown';
    },
  },
];

export const socmintConnector: Connector = {
  id: 'socmint',
  domain: 'socmint',
  auth: 'none',
  capabilities: ['lookup'],
  sourceTier: 'aggregator',
  rateLimit: { rps: 4 },
  tosNote: 'Public profile presence across platforms. Public pages only, content-differential detection.',
  applicable(task) {
    const c = classifyOsintTarget(task.target);
    return (c.kind === 'handle' || c.kind === 'email') && /^[a-zA-Z0-9_.-]{1,40}$/.test(c.value.replace(/@.*$/, '').replace(/^@/, ''));
  },
  async healthCheck(ua) {
    const r = await fetchStatusBody('https://hacker-news.firebaseio.com/v0/user/pg.json', ua, 6000);
    return !!r && r.status === 200 && r.body.includes('"id"');
  },
  async run(task, ua): Promise<CollectResult> {
    const username = classifyOsintTarget(task.target).value.replace(/@.*$/, '').replace(/^@/, '');
    const results = await Promise.all(
      PLATFORMS.map(async (p): Promise<RawItem> => {
        const status = await p.check(username, ua).catch((): Presence => 'unknown');
        return {
          kind: 'account_presence',
          data: { platform: p.name, username, url: p.profileUrl(username), status },
          provenance: provenance(`socmint:${p.name}`, p.profileUrl(username), '', 'Public profile presence check'),
        };
      }),
    );
    const present = results.filter((r) => (r.data as { status: string }).status === 'present');
    const summary = `${present.length} of ${PLATFORMS.length} platforms`;
    const prov: ReturnType<typeof provenance> = {
      connector: 'socmint',
      sourceUrl: '',
      fetchedAt: new Date().toISOString(),
      sha256: sha256(results.map((r) => `${(r.data as any).platform}=${(r.data as any).status}`).join('|')),
      licenseNote: 'Public profile presence checks; content-differential.',
    };
    return {
      connector: 'socmint',
      domain: 'socmint',
      target: username,
      items: results.sort((a, b) => rank((a.data as any).status) - rank((b.data as any).status)),
      provenance: prov,
      warning: present.length === 0 ? `No confident matches (${summary}); platforms may be rate-limiting.` : undefined,
    };
  },
};

function rank(s: string): number {
  return s === 'present' ? 0 : s === 'unknown' ? 1 : 2;
}
