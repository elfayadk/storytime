import { getText } from '../util/http.js';
import { provenance } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type CollectionTask, type Connector, type RawItem } from './types.js';

/**
 * CourtListener (Free Law Project): US federal and state court opinions and
 * dockets. Anonymous search works within rate limits; a free token (env
 * COURTLISTENER_TOKEN) raises them.
 */
export const courtlistenerConnector: Connector = {
  id: 'courtlistener',
  domain: 'records',
  auth: 'free-key',
  capabilities: ['search'],
  sourceTier: 'primary',
  rateLimit: { rps: 1 },
  tosNote: 'CourtListener / Free Law Project. Anonymous search allowed; free token raises limits.',
  applicable(task) {
    const k = classifyOsintTarget(task.target).kind;
    return k === 'handle' || k === 'unknown';
  },
  async healthCheck(ua) {
    try {
      const r = await getText('https://www.courtlistener.com/api/rest/v4/search/?q=test&type=o', { userAgent: ua, timeoutMs: 9000, retries: 0, headers: authHeader() });
      return r.includes('results') || r.includes('count');
    } catch {
      return false;
    }
  },
  async run(task, ua): Promise<CollectResult> {
    const q = task.target.trim();
    const url = `https://www.courtlistener.com/api/rest/v4/search/?q=${encodeURIComponent(q)}&type=o&order_by=score+desc`;
    let raw: string;
    try {
      raw = await getText(url, { userAgent: ua, minIntervalMs: 1000, timeoutMs: 14000, headers: authHeader() });
    } catch (err) {
      const prov = provenance('courtlistener', url, '', 'CourtListener');
      return { connector: 'courtlistener', domain: 'records', target: q, items: [], provenance: prov, warning: `${(err as Error).message} (a free CourtListener token may be required: set COURTLISTENER_TOKEN)` };
    }
    const prov = provenance('courtlistener', url, raw, 'CourtListener, public');
    let data: { results?: any[] } = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return { connector: 'courtlistener', domain: 'records', target: q, items: [], provenance: prov, warning: 'non-JSON response' };
    }
    const items: RawItem[] = (data.results ?? []).slice(0, 20).map((r) => ({
      kind: 'court_opinion',
      data: {
        caseName: r.caseName ?? r.caseNameFull,
        court: r.court,
        dateFiled: r.dateFiled,
        docketNumber: r.docketNumber,
        url: r.absolute_url ? `https://www.courtlistener.com${r.absolute_url}` : undefined,
      },
      provenance: prov,
    }));
    return { connector: 'courtlistener', domain: 'records', target: q, items, provenance: prov };
  },
};

function authHeader(): Record<string, string> | undefined {
  return process.env.COURTLISTENER_TOKEN ? { Authorization: `Token ${process.env.COURTLISTENER_TOKEN}` } : undefined;
}
