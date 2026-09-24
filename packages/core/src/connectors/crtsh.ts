import { getText } from '../util/http.js';
import { provenance } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type CollectionTask, type Connector, type RawItem } from './types.js';

interface CrtRow {
  name_value: string;
  common_name?: string;
  issuer_name?: string;
  not_before?: string;
  not_after?: string;
  id?: number;
}

/**
 * crt.sh: subdomains and certificates from public Certificate Transparency logs
 * (RFC 6962). Keyless. Finds dev/staging/internal hosts that wordlists miss.
 */
export const crtshConnector: Connector = {
  id: 'crtsh',
  domain: 'infra',
  auth: 'none',
  capabilities: ['search'],
  sourceTier: 'primary',
  rateLimit: { rps: 1 },
  tosNote: 'Public CT logs (RFC 6962). Keyless. Be polite: 1 request/second.',
  applicable(task) {
    return classifyOsintTarget(task.target).kind === 'domain';
  },
  async healthCheck(ua) {
    try {
      // crt.sh is slow; a HEAD-like liveness check on the homepage is enough.
      const r = await getText('https://crt.sh/', { userAgent: ua, timeoutMs: 12000, retries: 0 });
      return r.length > 0;
    } catch {
      return false;
    }
  },
  async run(task, ua): Promise<CollectResult> {
    const domain = classifyOsintTarget(task.target).value;
    const url = `https://crt.sh/?q=${encodeURIComponent('%.' + domain)}&output=json`;
    const raw = await getText(url, { userAgent: ua, minIntervalMs: 1000, timeoutMs: 25000 });
    const prov = provenance('crtsh', url, raw, 'Public CT logs (RFC 6962), no restriction');

    let rows: CrtRow[] = [];
    try {
      rows = JSON.parse(raw) as CrtRow[];
    } catch {
      return { connector: 'crtsh', domain: 'infra', target: domain, items: [], provenance: prov, warning: 'crt.sh returned non-JSON (rate-limited or empty)' };
    }

    const subs = new Map<string, { firstSeen?: string; issuers: Set<string> }>();
    for (const r of rows) {
      for (const name of String(r.name_value ?? '').split(/\n+/)) {
        const host = name.trim().toLowerCase().replace(/^\*\./, '');
        if (!host || !host.endsWith(domain)) continue;
        const cur = subs.get(host) ?? { issuers: new Set<string>() };
        if (r.issuer_name) cur.issuers.add(r.issuer_name.slice(0, 80));
        if (r.not_before && (!cur.firstSeen || r.not_before < cur.firstSeen)) cur.firstSeen = r.not_before;
        subs.set(host, cur);
      }
    }

    const items: RawItem[] = [...subs.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([host, info]) => ({
        kind: 'subdomain',
        data: { host, firstSeen: info.firstSeen, issuers: [...info.issuers].slice(0, 3) },
        provenance: prov,
      }));

    return { connector: 'crtsh', domain: 'infra', target: domain, items, provenance: prov };
  },
};
