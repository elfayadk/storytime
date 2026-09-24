/**
 * Subject profile collection. Resolves a normalized Profile from GitHub or
 * GitLab and (best effort) auto-discovers the subject's blog feed. All public,
 * keyless, and fully optional: any failure returns undefined and never breaks a run.
 */
import { getJson, getText } from '../util/http.js';
import type { StorytimeConfig } from '../config.js';
import type { Logger } from '../util/logger.js';
import type { Profile } from '../types.js';
import { classifyTarget } from '../ingesters/base.js';

export async function collectProfile(
  target: string,
  config: StorytimeConfig,
  logger: Logger,
): Promise<Profile | undefined> {
  const { kind, value } = classifyTarget(target);
  if (kind !== 'username' && kind !== 'handle') return undefined;
  const user = value.split('@')[0];

  return (await githubProfile(user, config, logger)) ?? (await gitlabProfile(user, config, logger));
}

async function githubProfile(
  user: string,
  config: StorytimeConfig,
  logger: Logger,
): Promise<Profile | undefined> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (config.github.token) headers.Authorization = `Bearer ${config.github.token}`;
  try {
    const u = await getJson<any>(`https://api.github.com/users/${encodeURIComponent(user)}`, {
      headers,
      userAgent: config.userAgent,
    });
    if (!u?.login) return undefined;

    let topLanguages: { name: string; count: number }[] = [];
    let topRepos: Profile['topRepos'] = [];
    try {
      const repos = await getJson<any[]>(
        `https://api.github.com/users/${encodeURIComponent(user)}/repos?sort=pushed&per_page=100`,
        { headers, userAgent: config.userAgent },
      );
      const langCount = new Map<string, number>();
      for (const r of repos) if (r.language) langCount.set(r.language, (langCount.get(r.language) ?? 0) + 1);
      topLanguages = [...langCount.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
      topRepos = [...repos]
        .filter((r) => !r.fork)
        .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
        .slice(0, 5)
        .map((r) => ({ name: r.name, url: r.html_url, stars: r.stargazers_count ?? 0, description: r.description ?? undefined, language: r.language ?? undefined }));
    } catch {
      /* repos are a bonus */
    }

    return {
      platform: 'github',
      handle: u.login,
      displayName: u.name ?? undefined,
      bio: u.bio ?? undefined,
      avatarUrl: u.avatar_url ?? undefined,
      url: u.html_url,
      location: u.location ?? undefined,
      company: u.company ?? undefined,
      blog: u.blog || undefined,
      followers: u.followers,
      following: u.following,
      repos: u.public_repos,
      joined: u.created_at ?? undefined,
      topLanguages,
      topRepos,
    };
  } catch (err) {
    logger.debug(`github profile: ${(err as Error).message}`);
    return undefined;
  }
}

async function gitlabProfile(
  user: string,
  config: StorytimeConfig,
  logger: Logger,
): Promise<Profile | undefined> {
  try {
    const users = await getJson<any[]>(`https://gitlab.com/api/v4/users?username=${encodeURIComponent(user)}`, {
      userAgent: config.userAgent,
    });
    const u = users[0];
    if (!u) return undefined;
    return {
      platform: 'gitlab',
      handle: u.username,
      displayName: u.name ?? undefined,
      bio: u.bio || undefined,
      avatarUrl: u.avatar_url ?? undefined,
      url: u.web_url,
      location: u.location || undefined,
      company: u.organization || undefined,
      blog: u.website_url || undefined,
      joined: u.created_at ?? undefined,
    };
  } catch (err) {
    logger.debug(`gitlab profile: ${(err as Error).message}`);
    return undefined;
  }
}

/** Auto-discover an RSS/Atom feed URL from a site's HTML <link> tags. */
export async function discoverFeed(
  siteUrl: string,
  config: StorytimeConfig,
  logger: Logger,
): Promise<string | undefined> {
  let url = siteUrl.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const html = await getText(url, { userAgent: config.userAgent, timeoutMs: 12000 });
    const linkTags = html.match(/<link[^>]+>/gi) ?? [];
    for (const tag of linkTags) {
      if (/rel=["']?alternate/i.test(tag) && /type=["']?application\/(rss|atom)\+xml/i.test(tag)) {
        const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
        if (href) return new URL(href, url).toString();
      }
    }
    // Common fallbacks.
    for (const path of ['/feed', '/rss', '/feed.xml', '/rss.xml', '/index.xml', '/atom.xml']) {
      const candidate = new URL(path, url).toString();
      try {
        const head = await getText(candidate, { userAgent: config.userAgent, retries: 0, timeoutMs: 6000 });
        if (/<rss|<feed/i.test(head.slice(0, 500))) return candidate;
      } catch {
        /* try next */
      }
    }
  } catch (err) {
    logger.debug(`feed discovery(${url}): ${(err as Error).message}`);
  }
  return undefined;
}
