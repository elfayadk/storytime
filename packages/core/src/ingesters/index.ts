import type { Platform } from '../types.js';
import type { Ingester } from './base.js';
import { githubIngester } from './github.js';
import { redditIngester } from './reddit.js';
import { mastodonIngester } from './mastodon.js';
import { blueskyIngester } from './bluesky.js';
import { rssIngester } from './rss.js';
import { pastebinIngester } from './pastebin.js';
import { hackernewsIngester } from './hackernews.js';
import { devtoIngester } from './devto.js';

export const INGESTERS: Record<Platform, Ingester> = {
  github: githubIngester,
  reddit: redditIngester,
  mastodon: mastodonIngester,
  bluesky: blueskyIngester,
  rss: rssIngester,
  pastebin: pastebinIngester,
  hackernews: hackernewsIngester,
  devto: devtoIngester,
};

export function getIngesters(platforms: Platform[]): Ingester[] {
  return platforms.map((p) => INGESTERS[p]).filter(Boolean);
}

export * from './base.js';
