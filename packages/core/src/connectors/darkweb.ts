import { getText } from '../util/http.js';
import { provenance } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type Connector, type RawItem } from './types.js';

/**
 * Dark-web index search (upgrade pack P8) via Ahmia's CLEARNET index of Tor
 * hidden services. This surfaces which .onion services mention a term without
 * routing through Tor: honest scope, and honest about the limit. Reading the
 * actual content of an onion service still requires a Tor circuit (and its own
 * authorization); this connector only searches the public index and returns the
 * service titles, onion addresses and snippets. Nothing here fetches an onion.
 */
const ONION_RE = /https?:\/\/[a-z2-7]{16,56}\.onion[^\s"'<>]*/gi;

export const darkwebConnector: Connector = {
  id: 'darkweb',
  domain: 'darkweb',
  auth: 'none',
  capabilities: ['search'],
  sourceTier: 'aggregator',
  rateLimit: { rps: 1 },
  tosNote: 'Ahmia clearnet index of Tor hidden services. Index search only; content fetch needs Tor.',
  applicable(task) {
    const k = classifyOsintTarget(task.target).kind;
    return k === 'domain' || k === 'email' || k === 'handle' || k === 'unknown';
  },
  async healthCheck(ua) {
    try {
      const r = await getText('https://ahmia.fi/search/?q=test', { userAgent: ua, timeoutMs: 10000, retries: 0 });
      return r.includes('onion') || r.includes('result');
    } catch {
      return false;
    }
  },
  async run(task, ua): Promise<CollectResult> {
    const q = task.target.trim();
    const url = `https://ahmia.fi/search/?q=${encodeURIComponent(q)}`;
    let raw: string;
    try {
      raw = await getText(url, { userAgent: ua, timeoutMs: 8000, minIntervalMs: 1000 });
    } catch (err) {
      const prov = provenance('darkweb', url, '', 'Ahmia hidden-service index');
      return { connector: 'darkweb', domain: 'darkweb', target: q, items: [], provenance: prov, warning: `${(err as Error).message} (Ahmia index unreachable)` };
    }
    const prov = provenance('darkweb', url, raw, 'Ahmia hidden-service index');

    // Ahmia wraps each hit in an <li class="result"> with a redirect link that
    // carries the real onion URL, an <h4> title and a snippet <p>. Parse those,
    // and fall back to a raw onion-address scan so a layout change still yields
    // results rather than a silent zero.
    const items: RawItem[] = [];
    const seen = new Set<string>();
    const blocks = raw.split(/<li[^>]*class="[^"]*result[^"]*"[^>]*>/i).slice(1);
    for (const b of blocks.slice(0, 25)) {
      const onion = decodeURIComponent((b.match(/redirect_url=([^"'&]+)/i)?.[1] ?? b.match(ONION_RE)?.[0] ?? ''));
      if (!onion) continue;
      const host = onion.match(/[a-z2-7]{16,56}\.onion/i)?.[0] ?? onion;
      if (seen.has(host)) continue;
      seen.add(host);
      const title = stripTags(b.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i)?.[1] ?? '').trim();
      const snippet = stripTags(b.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '').trim().slice(0, 240);
      const seenDate = (b.match(/last seen[^0-9]*([0-9]{4}-[0-9]{2}-[0-9]{2})/i)?.[1]) ?? undefined;
      items.push({
        kind: 'onion_service',
        data: { title: title || host, onion: host, url: onion, snippet, lastSeen: seenDate },
        provenance: prov,
      });
    }
    // Fallback scan, but only on a genuine results page (real hits carry
    // redirect_url links). This avoids treating a redirect to Ahmia's homepage,
    // whose footer holds Ahmia's own onion, as a match.
    const looksLikeResults = raw.includes('redirect_url');
    if (items.length === 0 && looksLikeResults) {
      for (const m of raw.match(ONION_RE) ?? []) {
        const host = m.match(/[a-z2-7]{16,56}\.onion/i)?.[0] ?? m;
        if (seen.has(host)) continue;
        seen.add(host);
        items.push({ kind: 'onion_service', data: { title: host, onion: host, url: m, snippet: '' }, provenance: prov });
        if (items.length >= 25) break;
      }
    }

    // No result listing at all: distinguish "nothing indexed" from a network
    // that Ahmia is redirecting or rate-limiting (its search 302s some egress
    // IPs to the homepage). Never invent a hit from the homepage footer.
    let warning: string | undefined;
    if (items.length === 0) {
      warning = looksLikeResults
        ? 'No indexed hidden services mention this term.'
        : 'Ahmia returned no result listing from this network (its index redirects or rate-limits some egress IPs; it works from an unblocked network or Tor). Reading onion content itself requires a Tor circuit.';
    }
    return { connector: 'darkweb', domain: 'darkweb', target: q, items, provenance: prov, warning };
  },
};

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ');
}
