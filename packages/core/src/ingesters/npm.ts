import { DateTime } from 'luxon';
import { getJson } from '../util/http.js';
import type { TimelineEvent } from '../types.js';
import { classifyTarget, type Ingester, type IngestContext } from './base.js';

interface NpmObject {
  package: {
    name: string;
    version: string;
    description?: string;
    date: string;
    links?: { npm?: string };
    publisher?: { username?: string };
  };
}
interface NpmSearch {
  objects: NpmObject[];
}

/**
 * npm packages authored by the user, via the public registry search API.
 * Keyless. Each package's latest publish date becomes an event.
 */
export const npmIngester: Ingester = {
  platform: 'npm',
  applicable(target) {
    const { kind } = classifyTarget(target);
    return kind === 'username' || kind === 'handle';
  },
  async ingest(target, ctx): Promise<TimelineEvent[]> {
    const user = classifyTarget(target).value.split('@')[0];
    const n = Math.min(ctx.config.limitPerPlatform || 50, 100);
    const url = `https://registry.npmjs.org/-/v1/search?text=author:${encodeURIComponent(user)}&size=${n}`;

    let data: NpmSearch;
    try {
      data = await getJson<NpmSearch>(url, { userAgent: ctx.config.userAgent, minIntervalMs: 300 });
    } catch (err) {
      ctx.logger.warn(`npm: ${(err as Error).message}`);
      return [];
    }

    return (data.objects ?? [])
      .map((o) => {
        const ts = DateTime.fromISO(o.package.date);
        if (!ts.isValid) return null;
        return {
          id: `npm:${o.package.name}@${o.package.version}`,
          platform: 'npm' as const,
          category: 'code_create' as const,
          timestamp: ts,
          originalTimestamp: o.package.date,
          title: `Published ${o.package.name} ${o.package.version}`,
          content: o.package.description ?? '',
          url: o.package.links?.npm ?? `https://www.npmjs.com/package/${o.package.name}`,
          username: o.package.publisher?.username ?? user,
          metadata: { version: o.package.version },
        } as TimelineEvent;
      })
      .filter((e): e is TimelineEvent => e !== null)
      .filter((e) => {
        if (ctx.since && e.timestamp < ctx.since) return false;
        if (ctx.until && e.timestamp > ctx.until) return false;
        return true;
      });
  },
};
