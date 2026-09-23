import { DateTime } from 'luxon';
import { getText } from '../util/http.js';
import type { TimelineEvent } from '../types.js';
import type { Ingester, IngestContext } from './base.js';

/**
 * Pastebin public pastes fetched via the free raw endpoint
 * (https://pastebin.com/raw/<id>) - NO paid PRO scraping key.
 * IDs/URLs come from config.pastebinIds (env PASTEBIN_IDS or CLI).
 */
export const pastebinIngester: Ingester = {
  platform: 'pastebin',
  applicable(_target, ctx) {
    return ctx.config.pastebinIds.length > 0;
  },
  async ingest(_target, ctx): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = [];
    for (const ref of ctx.config.pastebinIds) {
      const id = extractId(ref);
      if (!id) continue;
      try {
        const text = await getText(`https://pastebin.com/raw/${id}`, {
          userAgent: ctx.config.userAgent,
          minIntervalMs: 500,
        });
        // Raw pastes carry no timestamp; use "now" as the ingest marker.
        const ts = DateTime.now();
        events.push({
          id: `pastebin:${id}`,
          platform: 'pastebin',
          category: 'paste',
          timestamp: ts,
          originalTimestamp: ts.toISO()!,
          title: `Paste ${id}`,
          content: text.slice(0, 20000),
          url: `https://pastebin.com/${id}`,
          username: 'unknown',
          metadata: { pasteId: id, bytes: text.length },
        });
      } catch (err) {
        ctx.logger.warn(`pastebin(${id}): ${(err as Error).message}`);
      }
    }
    return events;
  },
};

function extractId(ref: string): string | null {
  const m = ref.match(/pastebin\.com\/(?:raw\/)?([A-Za-z0-9]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9]+$/.test(ref)) return ref;
  return null;
}
