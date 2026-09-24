import { getText } from '../util/http.js';
import { provenance } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type CollectionTask, type Connector } from './types.js';

/**
 * Shodan InternetDB: open ports, hostnames, CPEs, known CVEs and tags for an IP.
 * Keyless, no published rate limit, weekly refresh. Non-commercial use.
 */
export const internetdbConnector: Connector = {
  id: 'internetdb',
  domain: 'infra',
  auth: 'none',
  capabilities: ['lookup'],
  rateLimit: { rps: 2 },
  tosNote: 'Shodan InternetDB, keyless, free for non-commercial use.',
  applicable(task) {
    return classifyOsintTarget(task.target).kind === 'ip';
  },
  async healthCheck(ua) {
    try {
      const r = await getText('https://internetdb.shodan.io/1.1.1.1', { userAgent: ua, timeoutMs: 6000, retries: 0 });
      return r.includes('ip');
    } catch {
      return false;
    }
  },
  async run(task, ua): Promise<CollectResult> {
    const ip = classifyOsintTarget(task.target).value;
    const url = `https://internetdb.shodan.io/${encodeURIComponent(ip)}`;
    let raw: string;
    try {
      raw = await getText(url, { userAgent: ua, minIntervalMs: 500, timeoutMs: 10000 });
    } catch (err) {
      const prov = provenance('internetdb', url, '', 'Shodan InternetDB');
      return { connector: 'internetdb', domain: 'infra', target: ip, items: [], provenance: prov, warning: `no data (${(err as Error).message})` };
    }
    const prov = provenance('internetdb', url, raw, 'Shodan InternetDB, non-commercial');
    let d: { ip?: string; ports?: number[]; hostnames?: string[]; cpes?: string[]; vulns?: string[]; tags?: string[] } = {};
    try {
      d = JSON.parse(raw);
    } catch {
      return { connector: 'internetdb', domain: 'infra', target: ip, items: [], provenance: prov, warning: 'non-JSON response' };
    }
    return {
      connector: 'internetdb',
      domain: 'infra',
      target: ip,
      items: [
        {
          kind: 'ip_intel',
          data: {
            ip: d.ip ?? ip,
            ports: d.ports ?? [],
            hostnames: d.hostnames ?? [],
            cpes: d.cpes ?? [],
            vulns: d.vulns ?? [],
            tags: d.tags ?? [],
          },
          provenance: prov,
        },
      ],
      provenance: prov,
    };
  },
};
