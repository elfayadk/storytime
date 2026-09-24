import { getText } from '../util/http.js';
import { provenance } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type CollectionTask, type Connector, type RawItem } from './types.js';

/**
 * GLEIF: the global Legal Entity Identifier (LEI) index. Keyless. Resolve a
 * company name to its LEI, jurisdiction, and registered address.
 */
export const gleifConnector: Connector = {
  id: 'gleif',
  domain: 'records',
  auth: 'none',
  capabilities: ['search'],
  sourceTier: 'primary',
  rateLimit: { rps: 2 },
  tosNote: 'GLEIF LEI API, keyless, public.',
  applicable(task) {
    const k = classifyOsintTarget(task.target).kind;
    return k === 'handle' || k === 'unknown';
  },
  async healthCheck(ua) {
    try {
      const r = await getText('https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=test&page[size]=1', { userAgent: ua, timeoutMs: 8000, retries: 0 });
      return r.includes('data');
    } catch {
      return false;
    }
  },
  async run(task, ua): Promise<CollectResult> {
    const q = task.target.trim();
    const url = `https://api.gleif.org/api/v1/lei-records?filter[entity.legalName]=${encodeURIComponent(q)}&page[size]=10`;
    const raw = await getText(url, { userAgent: ua, minIntervalMs: 500, timeoutMs: 12000 });
    const prov = provenance('gleif', url, raw, 'GLEIF, public');
    let data: { data?: any[] } = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return { connector: 'gleif', domain: 'records', target: q, items: [], provenance: prov, warning: 'non-JSON response' };
    }
    const items: RawItem[] = (data.data ?? []).map((rec) => {
      const e = rec.attributes?.entity ?? {};
      return {
        kind: 'legal_entity',
        data: {
          lei: rec.attributes?.lei ?? rec.id,
          legalName: e.legalName?.name,
          jurisdiction: e.jurisdiction,
          status: e.status,
          city: e.legalAddress?.city,
          country: e.legalAddress?.country,
          url: `https://search.gleif.org/#/record/${rec.id}`,
        },
        provenance: prov,
      };
    });
    return { connector: 'gleif', domain: 'records', target: q, items, provenance: prov };
  },
};
