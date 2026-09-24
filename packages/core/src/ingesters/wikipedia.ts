import { DateTime } from 'luxon';
import { getJson } from '../util/http.js';
import type { TimelineEvent } from '../types.js';
import { classifyTarget, type Ingester, type IngestContext } from './base.js';

interface WpContrib {
  title: string;
  timestamp: string;
  comment: string;
  revid: number;
  sizediff?: number;
  ns: number;
}
interface WpResponse {
  query?: { usercontribs?: WpContrib[] };
}

/**
 * Wikipedia public edit history via the MediaWiki API (no key), keyed off the
 * editor's username. Uses the configured language edition (default English).
 */
export const wikipediaIngester: Ingester = {
  platform: 'wikipedia',
  applicable(target) {
    const { kind } = classifyTarget(target);
    return kind === 'username' || kind === 'handle';
  },
  async ingest(target, ctx): Promise<TimelineEvent[]> {
    const user = classifyTarget(target).value.split('@')[0];
    const lang = process.env.WIKIPEDIA_LANG || 'en';
    const n = Math.min(ctx.config.limitPerPlatform || 50, 100);
    const params = new URLSearchParams({
      action: 'query',
      list: 'usercontribs',
      ucuser: user,
      uclimit: String(n),
      ucprop: 'title|timestamp|comment|sizediff|ids',
      format: 'json',
      origin: '*',
    });
    const url = `https://${lang}.wikipedia.org/w/api.php?${params.toString()}`;

    let data: WpResponse;
    try {
      data = await getJson<WpResponse>(url, { userAgent: ctx.config.userAgent, minIntervalMs: 300 });
    } catch (err) {
      ctx.logger.warn(`wikipedia: ${(err as Error).message}`);
      return [];
    }

    return (data.query?.usercontribs ?? [])
      .map((c) => toEvent(c, user, lang))
      .filter((e): e is TimelineEvent => e !== null)
      .filter((e) => {
        if (ctx.since && e.timestamp < ctx.since) return false;
        if (ctx.until && e.timestamp > ctx.until) return false;
        return true;
      });
  },
};

function toEvent(c: WpContrib, user: string, lang: string): TimelineEvent | null {
  const ts = DateTime.fromISO(c.timestamp);
  if (!ts.isValid) return null;
  const diff = typeof c.sizediff === 'number' ? ` (${c.sizediff >= 0 ? '+' : ''}${c.sizediff} bytes)` : '';
  return {
    id: `wikipedia:${c.revid}`,
    platform: 'wikipedia',
    category: 'other',
    timestamp: ts,
    originalTimestamp: c.timestamp,
    title: `Edited "${c.title}"${diff}`,
    content: c.comment || '',
    url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(c.title.replace(/ /g, '_'))}?diff=${c.revid}`,
    username: user,
    metadata: { namespace: c.ns, sizediff: c.sizediff, revid: c.revid },
  };
}
