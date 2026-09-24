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
import { gitlabIngester } from './gitlab.js';
import { wikipediaIngester } from './wikipedia.js';
import { stackexchangeIngester } from './stackexchange.js';
import { mediumIngester } from './medium.js';
import { lemmyIngester } from './lemmy.js';
import { npmIngester } from './npm.js';
import { youtubeIngester } from './youtube.js';

export const INGESTERS: Record<Platform, Ingester> = {
  github: githubIngester,
  reddit: redditIngester,
  mastodon: mastodonIngester,
  bluesky: blueskyIngester,
  rss: rssIngester,
  pastebin: pastebinIngester,
  hackernews: hackernewsIngester,
  devto: devtoIngester,
  gitlab: gitlabIngester,
  wikipedia: wikipediaIngester,
  stackexchange: stackexchangeIngester,
  medium: mediumIngester,
  lemmy: lemmyIngester,
  npm: npmIngester,
  youtube: youtubeIngester,
};

export function getIngesters(platforms: Platform[]): Ingester[] {
  return platforms.map((p) => INGESTERS[p]).filter(Boolean);
}

export * from './base.js';
