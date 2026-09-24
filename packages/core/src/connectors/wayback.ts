import { getText } from '../util/http.js';
import { provenance } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type CollectionTask, type Connector, type RawItem } from './types.js';

/**
 * Internet Archive Wayback CDX API: historical captures of a URL or a whole
 * domain. Keyless. Turns the web into a time machine for evidence.
 */
export const waybackConnector: Connector = {
  id: 'wayback',
  domain: 'media',
  auth: 'none',
  capabilities: ['search', 'lookup'],
  sourceTier: 'archive',
  rateLimit: { rps: 1 },
  tosNote: 'Internet Archive Wayback CDX API, keyless, public.',
  applicable(task) {
    const k = classifyOsintTarget(task.target).kind;
    return k === 'domain' || k === 'url';
  },
  async healthCheck(ua) {
    try {
      const r = await getText('http://web.archive.org/cdx/search/cdx?url=example.com&limit=1&output=json', { userAgent: ua, timeoutMs: 14000, retries: 0 });
      return r.length > 0;
    } catch {
      return false;
    }
  },
  async run(task, ua): Promise<CollectResult> {
    const { kind, value } = classifyOsintTarget(task.target);
    const limit = Math.min(Number(task.params?.limit ?? 200), 1000);
    const matchType = kind === 'domain' ? 'domain' : 'prefix';
    const url =
      `http://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(value)}` +
      `&matchType=${matchType}&output=json&limit=${limit}&collapse=urlkey&fl=timestamp,original,statuscode,mimetype`;
    const raw = await getText(url, { userAgent: ua, minIntervalMs: 1000, timeoutMs: 25000 });
    const prov = provenance('wayback', url, raw, 'Internet Archive, public');

    let rows: string[][] = [];
    try {
      rows = JSON.parse(raw) as string[][];
    } catch {
      return { connector: 'wayback', domain: 'media', target: value, items: [], provenance: prov, warning: 'non-JSON response' };
    }
    const body = rows.slice(1); // drop header row
    const items: RawItem[] = body.map(([timestamp, original, statuscode, mimetype]) => ({
      kind: 'wayback_capture',
      data: {
        original,
        timestamp,
        statuscode,
        mimetype,
        waybackUrl: `http://web.archive.org/web/${timestamp}/${original}`,
      },
      provenance: { ...prov, waybackUrl: `http://web.archive.org/web/${timestamp}/${original}` },
    }));

    return { connector: 'wayback', domain: 'media', target: value, items, provenance: prov };
  },
};
