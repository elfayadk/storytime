import { getText } from '../util/http.js';
import { provenance } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type CollectionTask, type Connector, type RawItem } from './types.js';

/**
 * OpenAlex: the CC0 scholarly graph. Keyless. Search works, authors, and
 * institutions by name or topic.
 */
export const openalexConnector: Connector = {
  id: 'openalex',
  domain: 'media',
  auth: 'none',
  capabilities: ['search'],
  sourceTier: 'primary',
  rateLimit: { rps: 2 },
  tosNote: 'OpenAlex, CC0, keyless (add a mailto for the polite pool).',
  applicable(task) {
    const k = classifyOsintTarget(task.target).kind;
    return k === 'handle' || k === 'unknown';
  },
  async healthCheck(ua) {
    try {
      const r = await getText('https://api.openalex.org/works?search=test&per_page=1', { userAgent: ua, timeoutMs: 8000, retries: 0 });
      return r.includes('results');
    } catch {
      return false;
    }
  },
  async run(task, ua): Promise<CollectResult> {
    const q = task.target.trim();
    const n = Math.min(Number(task.params?.limit ?? 10), 25);
    const mail = process.env.OPENALEX_MAILTO ? `&mailto=${encodeURIComponent(process.env.OPENALEX_MAILTO)}` : '';
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per_page=${n}&sort=cited_by_count:desc${mail}`;
    const raw = await getText(url, { userAgent: ua, minIntervalMs: 500, timeoutMs: 12000 });
    const prov = provenance('openalex', url, raw, 'OpenAlex, CC0');
    let data: { results?: any[] } = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return { connector: 'openalex', domain: 'media', target: q, items: [], provenance: prov, warning: 'non-JSON response' };
    }
    const items: RawItem[] = (data.results ?? []).map((w) => ({
      kind: 'scholarly_work',
      data: {
        title: w.display_name,
        year: w.publication_year,
        doi: w.doi,
        citedBy: w.cited_by_count,
        authors: (w.authorships ?? []).slice(0, 5).map((a: any) => a.author?.display_name).filter(Boolean),
        url: w.id,
      },
      provenance: prov,
    }));
    return { connector: 'openalex', domain: 'media', target: q, items, provenance: prov };
  },
};
