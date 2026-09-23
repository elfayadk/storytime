import type { DateTime } from 'luxon';
import type { StorytimeConfig } from '../config.js';
import type { Logger } from '../util/logger.js';
import type { Platform, TimelineEvent } from '../types.js';

export interface IngestContext {
  config: StorytimeConfig;
  logger: Logger;
  since?: DateTime;
  until?: DateTime;
}

/** An ingester pulls public activity for a target into TimelineEvents. */
export interface Ingester {
  platform: Platform;
  /** True when this ingester is usable given the current config/target. */
  applicable(target: string, ctx: IngestContext): boolean;
  ingest(target: string, ctx: IngestContext): Promise<TimelineEvent[]>;
}

/**
 * Detect what kind of identifier the user passed.
 * Note: a bare `user@host.tld` is treated as a Mastodon-style *handle*, not an
 * email - this is a social-activity tool with no email lookup, and a handle and
 * an email are pattern-identical. Ingesters key off 'username' / 'handle'.
 */
export function classifyTarget(target: string): {
  kind: 'username' | 'hashtag' | 'url' | 'handle';
  value: string;
} {
  const t = target.trim();
  if (t.startsWith('#')) return { kind: 'hashtag', value: t.slice(1) };
  if (/^https?:\/\//i.test(t)) return { kind: 'url', value: t };
  // user@instance.tld → Mastodon webfinger handle
  if (/^@?[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t)) {
    return { kind: 'handle', value: t.replace(/^@/, '') };
  }
  if (t.includes('.')) return { kind: 'handle', value: t.replace(/^@/, '') };
  return { kind: 'username', value: t.replace(/^@/, '') };
}

/** Strip HTML tags to plain text (Mastodon/Bluesky return HTML-ish content). */
export function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>(?=)/gi, '\n')
    .replace(/<\/(p|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
