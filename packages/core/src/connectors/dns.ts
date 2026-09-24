import { getText } from '../util/http.js';
import { provenance } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type CollectionTask, type Connector, type RawItem } from './types.js';

const TYPES = ['A', 'AAAA', 'MX', 'TXT', 'NS'] as const;
const TYPE_NAME: Record<number, string> = { 1: 'A', 28: 'AAAA', 15: 'MX', 16: 'TXT', 2: 'NS', 5: 'CNAME', 6: 'SOA' };

/** DNS records over HTTPS (Cloudflare DoH). Keyless. */
export const dnsConnector: Connector = {
  id: 'dns',
  domain: 'infra',
  auth: 'none',
  capabilities: ['lookup'],
  sourceTier: 'primary',
  rateLimit: { rps: 5 },
  tosNote: 'Cloudflare DNS-over-HTTPS, keyless, public resolver.',
  applicable(task) {
    return classifyOsintTarget(task.target).kind === 'domain';
  },
  async healthCheck(ua) {
    try {
      const r = await getText('https://cloudflare-dns.com/dns-query?name=example.com&type=A', {
        userAgent: ua,
        headers: { Accept: 'application/dns-json' },
        timeoutMs: 6000,
        retries: 0,
      });
      return r.includes('Status');
    } catch {
      return false;
    }
  },
  async run(task, ua): Promise<CollectResult> {
    const domain = classifyOsintTarget(task.target).value;
    const items: RawItem[] = [];
    const urls: string[] = [];
    let combinedRaw = '';

    for (const type of TYPES) {
      const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`;
      urls.push(url);
      try {
        const raw = await getText(url, { userAgent: ua, headers: { Accept: 'application/dns-json' }, minIntervalMs: 200, timeoutMs: 8000 });
        combinedRaw += raw;
        const data = JSON.parse(raw) as { Answer?: { name: string; type: number; TTL: number; data: string }[] };
        for (const a of data.Answer ?? []) {
          items.push({
            kind: 'dns_record',
            data: { name: a.name, type: TYPE_NAME[a.type] ?? String(a.type), ttl: a.TTL, value: a.data },
            provenance: provenance('dns', url, raw, 'Cloudflare DoH, public'),
          });
        }
      } catch {
        /* skip this record type */
      }
    }

    const prov = provenance('dns', urls[0], combinedRaw, 'Cloudflare DoH, public');
    return { connector: 'dns', domain: 'infra', target: domain, items, provenance: prov };
  },
};
