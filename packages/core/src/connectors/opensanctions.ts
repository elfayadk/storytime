import { getText } from '../util/http.js';
import { provenance } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type CollectionTask, type Connector, type RawItem } from './types.js';

/**
 * OpenSanctions: consolidated sanctions lists, PEPs, and watchlists (aggregates
 * GLEIF, OpenCorporates, and more). Free for non-commercial use. High-value
 * due-diligence screening by name.
 */
const OS_KEY = () => process.env.OPENSANCTIONS_API_KEY;
const osHeader = (): Record<string, string> | undefined => (OS_KEY() ? { Authorization: `ApiKey ${OS_KEY()}` } : undefined);

export const opensanctionsConnector: Connector = {
  id: 'opensanctions',
  domain: 'records',
  auth: 'free-key',
  capabilities: ['search'],
  sourceTier: 'primary',
  rateLimit: { rps: 1 },
  tosNote: 'OpenSanctions API now requires a free API key (set OPENSANCTIONS_API_KEY). Non-commercial use.',
  applicable(task) {
    const k = classifyOsintTarget(task.target).kind;
    return k === 'handle' || k === 'unknown';
  },
  async healthCheck(ua) {
    try {
      const r = await getText('https://api.opensanctions.org/search/default?q=test&limit=1', { userAgent: ua, timeoutMs: 8000, retries: 0, headers: osHeader() });
      return r.includes('results');
    } catch {
      return false;
    }
  },
  async run(task, ua): Promise<CollectResult> {
    const q = task.target.trim();
    const n = Math.min(Number(task.params?.limit ?? 10), 25);
    const url = `https://api.opensanctions.org/search/default?q=${encodeURIComponent(q)}&limit=${n}`;
    let raw: string;
    try {
      raw = await getText(url, { userAgent: ua, minIntervalMs: 1000, timeoutMs: 12000, headers: osHeader() });
    } catch (err) {
      const prov = provenance('opensanctions', url, '', 'OpenSanctions');
      const needsKey = /401|403|No API key/.test((err as Error).message);
      return { connector: 'opensanctions', domain: 'records', target: q, items: [], provenance: prov, warning: needsKey ? 'OpenSanctions requires a free API key: register at opensanctions.org and set OPENSANCTIONS_API_KEY.' : (err as Error).message };
    }
    const prov = provenance('opensanctions', url, raw, 'OpenSanctions, non-commercial');
    if (raw.includes('No API key') || raw.includes('"detail"')) {
      return { connector: 'opensanctions', domain: 'records', target: q, items: [], provenance: prov, warning: 'OpenSanctions requires a free API key: register at opensanctions.org and set OPENSANCTIONS_API_KEY.' };
    }
    let data: { results?: any[] } = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return { connector: 'opensanctions', domain: 'records', target: q, items: [], provenance: prov, warning: 'non-JSON response' };
    }
    const items: RawItem[] = (data.results ?? []).map((r) => ({
      kind: 'sanctions_record',
      data: {
        caption: r.caption,
        schema: r.schema,
        topics: r.properties?.topics ?? [],
        countries: r.properties?.country ?? [],
        datasets: (r.datasets ?? []).slice(0, 6),
        score: r.score,
        url: `https://www.opensanctions.org/entities/${r.id}/`,
      },
      provenance: prov,
    }));
    return { connector: 'opensanctions', domain: 'records', target: q, items, provenance: prov };
  },
};
