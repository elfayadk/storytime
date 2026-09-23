/**
 * Runtime configuration. EVERY credential is optional - Storytime runs fully
 * without any of them (public endpoints only). Tokens, when present, only raise
 * rate limits; they are never required.
 */
import type { Platform } from './types.js';

export interface StorytimeConfig {
  /** Timezone for normalized timestamps. */
  timezone: string;
  /** Which platforms to ingest from. */
  platforms: Platform[];
  /** Max events per platform (0 = provider default). */
  limitPerPlatform: number;
  /** Optional date window (ISO strings). */
  since?: string;
  until?: string;

  github: { token?: string };
  /**
   * Reddit now blocks unauthenticated `.json` from many (esp. cloud) IPs.
   * clientId/secret are OPTIONAL and FREE - register a "script" app at
   * https://www.reddit.com/prefs/apps. Without them we still try the public
   * endpoint (works from many residential IPs).
   */
  reddit: { userAgent: string; clientId?: string; clientSecret?: string };
  mastodon: { instance: string };
  bluesky: { service: string };
  /** RSS feed URLs to pull (blogs, news). */
  rssFeeds: string[];
  /** Pastebin paste IDs or full URLs to fetch (public, no key). */
  pastebinIds: string[];

  /** Geocoding via OpenStreetMap Nominatim (free). */
  geocode: { enabled: boolean; endpoint: string; email?: string };

  /** Optional local LLM (Ollama). Off unless enabled. */
  ai: { enabled: boolean; endpoint: string; model: string };

  /** Shared HTTP identity - be a good netizen on public/free endpoints. */
  userAgent: string;
}

const DEFAULT_UA =
  'storytime/2.0 (+https://github.com/elfayadk/storytime)';

export function loadConfig(
  overrides: Partial<StorytimeConfig> = {},
  env: NodeJS.ProcessEnv = process.env,
): StorytimeConfig {
  const base: StorytimeConfig = {
    timezone: env.STORYTIME_TZ || 'UTC',
    platforms: ['github', 'reddit', 'mastodon', 'bluesky', 'hackernews', 'devto', 'rss'],
    limitPerPlatform: Number(env.STORYTIME_LIMIT || 50),
    github: { token: env.GITHUB_TOKEN || undefined },
    reddit: {
      userAgent: env.REDDIT_USER_AGENT || DEFAULT_UA,
      clientId: env.REDDIT_CLIENT_ID || undefined,
      clientSecret: env.REDDIT_CLIENT_SECRET || undefined,
    },
    mastodon: { instance: env.MASTODON_INSTANCE || 'mastodon.social' },
    bluesky: { service: env.BLUESKY_SERVICE || 'https://public.api.bsky.app' },
    rssFeeds: splitList(env.RSS_FEEDS),
    pastebinIds: splitList(env.PASTEBIN_IDS),
    geocode: {
      enabled: env.GEOCODE_ENABLED !== 'false',
      endpoint:
        env.NOMINATIM_ENDPOINT || 'https://nominatim.openstreetmap.org/search',
      email: env.NOMINATIM_EMAIL || undefined,
    },
    ai: {
      enabled: env.OLLAMA_ENABLED === 'true',
      endpoint: env.OLLAMA_ENDPOINT || 'http://localhost:11434',
      model: env.OLLAMA_MODEL || 'llama3.2',
    },
    userAgent: env.STORYTIME_UA || DEFAULT_UA,
  };
  return { ...base, ...overrides };
}

function splitList(v?: string): string[] {
  if (!v) return [];
  return v
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
