import { getText } from '../util/http.js';
import { provenance } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type CollectionTask, type Connector, type RawItem } from './types.js';

/**
 * SEC EDGAR full-text search of US securities filings. Keyless; the SEC requires
 * a descriptive User-Agent (Storytime sets one).
 */
export const secConnector: Connector = {
  id: 'sec',
  domain: 'records',
  auth: 'none',
  capabilities: ['search'],
  sourceTier: 'primary',
  rateLimit: { rps: 2 },
  tosNote: 'SEC EDGAR full-text search, keyless (descriptive User-Agent required).',
  applicable(task) {
    const k = classifyOsintTarget(task.target).kind;
    return k === 'handle' || k === 'unknown';
  },
  async healthCheck() {
    const secUa = process.env.SEC_USER_AGENT || 'storytime-osint/2.0 (OSINT research; +github.com/elfayadk/storytime)';
    try {
      const r = await getText('https://efts.sec.gov/LATEST/search-index?q=apple', { userAgent: secUa, timeoutMs: 8000, retries: 0 });
      return r.includes('hits');
    } catch {
      return false;
    }
  },
  async run(task, _ua): Promise<CollectResult> {
    const q = task.target.trim();
    // SEC requires a descriptive User-Agent identifying the requester.
    const secUa = process.env.SEC_USER_AGENT || 'storytime-osint/2.0 (OSINT research; +github.com/elfayadk/storytime)';
    const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${q}"`)}`;
    let raw: string;
    try {
      raw = await getText(url, { userAgent: secUa, minIntervalMs: 600, timeoutMs: 14000 });
    } catch (err) {
      const prov = provenance('sec', url, '', 'SEC EDGAR');
      return { connector: 'sec', domain: 'records', target: q, items: [], provenance: prov, warning: `${(err as Error).message} (SEC requires a descriptive User-Agent and rate limits sharply)` };
    }
    const prov = provenance('sec', url, raw, 'SEC EDGAR, public');
    let data: { hits?: { hits?: any[] } } = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return { connector: 'sec', domain: 'records', target: q, items: [], provenance: prov, warning: 'non-JSON response' };
    }
    const items: RawItem[] = (data.hits?.hits ?? []).slice(0, 20).map((h) => {
      const s = h._source ?? {};
      const adsh = String(h._id ?? '').split(':')[0].replace(/-/g, '');
      const cik = (s.ciks ?? [])[0];
      return {
        kind: 'sec_filing',
        data: {
          form: s.form ?? s.file_type,
          filer: (s.display_names ?? [])[0],
          fileDate: s.file_date,
          url: cik && adsh ? `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}` : 'https://efts.sec.gov/LATEST/search-index',
        },
        provenance: prov,
      };
    });
    return { connector: 'sec', domain: 'records', target: q, items, provenance: prov };
  },
};
