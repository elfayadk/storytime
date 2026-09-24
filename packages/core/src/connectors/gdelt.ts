import { getText } from '../util/http.js';
import { provenance } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type CollectionTask, type Connector, type RawItem } from './types.js';

/**
 * GDELT DOC 2.0: global news monitoring, 15-minute cadence, 100+ languages.
 * Keyless. Search a person, org, or topic across the world's news.
 */
export const gdeltConnector: Connector = {
  id: 'gdelt',
  domain: 'media',
  auth: 'none',
  capabilities: ['search'],
  sourceTier: 'aggregator',
  rateLimit: { rps: 1 },
  tosNote: 'GDELT Project DOC 2.0 API, keyless, public.',
  applicable(task) {
    const k = classifyOsintTarget(task.target).kind;
    return k === 'handle' || k === 'unknown';
  },
  async healthCheck(ua) {
    try {
      const r = await getText('https://api.gdeltproject.org/api/v2/doc/doc?query=test&mode=artlist&maxrecords=1&format=json', { userAgent: ua, timeoutMs: 8000, retries: 0 });
      return r.length > 0;
    } catch {
      return false;
    }
  },
  async run(task, ua): Promise<CollectResult> {
    const q = task.target.trim();
    const n = Math.min(Number(task.params?.limit ?? 25), 75);
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=${n}&format=json&sort=datedesc`;
    // GDELT asks for max one request every 5 seconds.
    const raw = await getText(url, { userAgent: ua, minIntervalMs: 5500, timeoutMs: 15000 });
    const prov = provenance('gdelt', url, raw, 'GDELT Project, public');
    if (raw.includes('limit requests to one every')) {
      return { connector: 'gdelt', domain: 'media', target: q, items: [], provenance: prov, warning: 'GDELT rate limit (one request per 5 seconds); try again shortly.' };
    }
    let data: { articles?: { url: string; title: string; seendate: string; domain: string; language: string; sourcecountry: string }[] } = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return { connector: 'gdelt', domain: 'media', target: q, items: [], provenance: prov, warning: 'non-JSON (no results or rate-limited)' };
    }
    const items: RawItem[] = (data.articles ?? []).map((a) => ({
      kind: 'news_article',
      data: { title: a.title, url: a.url, seendate: a.seendate, domain: a.domain, language: a.language, country: a.sourcecountry },
      provenance: prov,
    }));
    return { connector: 'gdelt', domain: 'media', target: q, items, provenance: prov };
  },
};
