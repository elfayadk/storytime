import type { CollectResult } from './types.js';

/**
 * Cross-source entity resolution (memo T8). Records pulled from different
 * sources that name the same real-world organization or person are collapsed
 * into one resolved entity. Two mentions are linked HARD when they share a
 * strong identifier (an LEI, a ticker, a domain) regardless of surface name,
 * and SOFT when their normalized names match or are highly similar. Everything
 * here is deterministic and dependency-free, so a resolution is reproducible.
 */
export interface EntityMention {
  name: string;
  norm: string;
  source: string; // connector id
  role: string; // 'organization' | 'person' | 'filer' | 'litigant' | 'author'
  identifiers: Record<string, string>; // lei, ticker, cik, domain
  attributes: Record<string, string>; // country, city, status, ...
  url?: string;
}

export interface ResolvedEntity {
  id: string;
  canonicalName: string;
  aliases: string[];
  role: string;
  identifiers: Record<string, string>;
  attributes: Record<string, string>;
  sources: string[];
  mentions: number;
  confidence: number; // 0..1: how strongly the cluster is bound
  links: { by: 'identifier' | 'name' | 'similarity'; detail: string }[];
}

const LEGAL_SUFFIX = /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|llc|l\.?l\.?c|plc|gmbh|ag|sa|s\.?a|nv|bv|ab|oyj|as|spa|srl|pty|group|holdings?|technologies|labs?|systems)\b/gi;

/** Normalize a name for matching: fold case and diacritics, drop legal suffixes and punctuation. */
export function normalizeEntityName(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(LEGAL_SUFFIX, ' ')
    .replace(/[^a-z0-9؀-ۿ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jaro-Winkler similarity in [0,1], self-contained. Good for short entity names. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const md = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aM = new Array(a.length).fill(false);
  const bM = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const lo = Math.max(0, i - md);
    const hi = Math.min(i + md + 1, b.length);
    for (let j = lo; j < hi; j++) {
      if (!bM[j] && a[i] === b[j]) {
        aM[i] = bM[j] = true;
        matches++;
        break;
      }
    }
  }
  if (matches === 0) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (aM[i]) {
      while (!bM[k]) k++;
      if (a[i] !== b[k]) t++;
      k++;
    }
  }
  t /= 2;
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - t) / m) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, a.length, b.length); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

function tokenSetSim(a: string, b: string): number {
  const sa = new Set(a.split(' ').filter(Boolean));
  const sb = new Set(b.split(' ').filter(Boolean));
  if (!sa.size || !sb.size) return 0;
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  return inter / (sa.size + sb.size - inter); // Jaccard
}


// ---- mention extraction -----------------------------------------------------

function tickerFrom(d: Record<string, unknown>): string | undefined {
  const t = d.ticker ?? d.tickers;
  if (Array.isArray(t) && t.length) return String(t[0]).toUpperCase();
  if (typeof t === 'string' && t) return t.toUpperCase();
  return undefined;
}

/** Pull entity mentions out of a recon/investigation's collected results. */
export function extractMentions(results: CollectResult[]): EntityMention[] {
  const out: EntityMention[] = [];
  const add = (name: string | undefined, source: string, role: string, identifiers: Record<string, string | undefined>, attributes: Record<string, string | undefined>, url?: string) => {
    if (!name || !String(name).trim()) return;
    const clean = String(name).trim();
    const ids: Record<string, string> = {};
    for (const [k, v] of Object.entries(identifiers)) if (v) ids[k] = String(v);
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(attributes)) if (v) attrs[k] = String(v);
    out.push({ name: clean, norm: normalizeEntityName(clean), source, role, identifiers: ids, attributes: attrs, url });
  };

  for (const r of results) {
    for (const it of r.items) {
      const d = it.data as Record<string, any>;
      switch (r.connector) {
        case 'gleif':
          add(d.legalName ?? d.lei, 'gleif', 'organization', { lei: d.lei }, { country: d.country, city: d.city, status: d.status }, d.url);
          break;
        case 'sec':
          add(d.filer, 'sec', 'filer', { cik: d.cik, ticker: tickerFrom(d) }, { form: d.form, fileDate: d.fileDate }, d.url);
          break;
        case 'opensanctions':
          add(d.caption, 'opensanctions', (d.schema === 'Person' ? 'person' : 'organization'), {}, { schema: d.schema, countries: (d.countries ?? []).join(', '), topics: (d.topics ?? []).join(', ') }, d.url);
          break;
        case 'courtlistener':
          add(d.caseName, 'courtlistener', 'litigant', {}, { court: d.court, dateFiled: d.dateFiled }, d.url);
          break;
        case 'openalex':
          for (const a of (d.authors ?? []).slice(0, 3)) add(a, 'openalex', 'author', {}, { work: d.title }, d.url);
          break;
        default:
          break;
      }
    }
  }
  return out;
}

// ---- union-find clustering --------------------------------------------------

class DSU {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
}

const SIM_THRESHOLD = 0.9;

/**
 * Resolve mentions into entities. Hard-links share a strong identifier; soft
 * links share a normalized name or clear a similarity threshold. Person names
 * are only linked by exact normalized name (fuzzy person matching is unsafe).
 */
export function resolveMentions(mentions: EntityMention[]): ResolvedEntity[] {
  const n = mentions.length;
  const dsu = new DSU(n);

  // 1. hard link on a shared strong identifier.
  const byId = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    for (const [k, v] of Object.entries(mentions[i].identifiers)) {
      const key = `${k}:${v.toLowerCase()}`;
      if (byId.has(key)) dsu.union(byId.get(key)!, i);
      else byId.set(key, i);
    }
  }

  // A name-based merge is blocked when the two clusters hold conflicting values
  // for the same identifier: a different LEI (or CIK, ticker) is proof of a
  // different legal entity, whatever the names look like.
  const clusterIds = (root: number): Map<string, string> => {
    const m = new Map<string, string>();
    for (let k = 0; k < n; k++) if (dsu.find(k) === root) for (const [key, v] of Object.entries(mentions[k].identifiers)) m.set(key, v.toLowerCase());
    return m;
  };
  const idConflict = (i: number, j: number): boolean => {
    const a = clusterIds(dsu.find(i));
    const b = clusterIds(dsu.find(j));
    for (const [k, v] of a) if (b.has(k) && b.get(k) !== v) return true;
    return false;
  };

  // 2. soft link on name (exact normalized always; fuzzy only for non-persons),
  // never across an identifier conflict.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (dsu.find(i) === dsu.find(j)) continue;
      if (!mentions[i].norm || !mentions[j].norm) continue;
      const isPerson = mentions[i].role === 'person' || mentions[j].role === 'person' || mentions[i].role === 'author' || mentions[j].role === 'author';
      const exact = mentions[i].norm === mentions[j].norm;
      const fuzzy = !isPerson && tokenSetSim(mentions[i].norm, mentions[j].norm) >= SIM_THRESHOLD;
      if ((exact || fuzzy) && !idConflict(i, j)) dsu.union(i, j);
    }
  }

  // 3. gather clusters.
  const clusters = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = dsu.find(i);
    (clusters.get(root) ?? clusters.set(root, []).get(root)!).push(i);
  }

  const entities: ResolvedEntity[] = [];
  let eid = 0;
  for (const [root, idx] of clusters) {
    const ms = idx.map((i) => mentions[i]);
    const names = [...new Set(ms.map((m) => m.name))];
    // canonical = the longest name that still carries a legal form, else the most common.
    const canonical = pickCanonical(ms);
    const identifiers: Record<string, string> = {};
    const attributes: Record<string, string> = {};
    for (const m of ms) {
      for (const [k, v] of Object.entries(m.identifiers)) identifiers[k] = v;
      for (const [k, v] of Object.entries(m.attributes)) if (!attributes[k]) attributes[k] = v;
    }
    const sources = [...new Set(ms.map((m) => m.source))];
    const links = clusterLinks(ms);
    const hasId = Object.keys(identifiers).length > 0;
    // confidence: identifier-bound clusters are strong; single-source clusters weak.
    let confidence = sources.length >= 2 ? 0.75 : 0.5;
    if (hasId && sources.length >= 2) confidence = 0.95;
    else if (hasId) confidence = 0.8;
    if (idx.length === 1) confidence = Math.min(confidence, 0.55);
    entities.push({
      id: `E${++eid}`,
      canonicalName: canonical,
      aliases: names.filter((x) => x !== canonical),
      role: mode(ms.map((m) => m.role)),
      identifiers,
      attributes,
      sources,
      mentions: ms.length,
      confidence: Number(confidence.toFixed(2)),
      links,
    });
  }
  return entities.sort((a, b) => b.sources.length - a.sources.length || b.mentions - a.mentions);
}

/**
 * Explain why a cluster's members are one entity, derived from the members
 * themselves (robust to union order): a shared identifier, a shared normalized
 * name, or, failing both, name similarity.
 */
function clusterLinks(ms: EntityMention[]): { by: 'identifier' | 'name' | 'similarity'; detail: string }[] {
  if (ms.length < 2) return [];
  const links: { by: 'identifier' | 'name' | 'similarity'; detail: string }[] = [];
  const idCount = new Map<string, number>();
  for (const m of ms) for (const [k, v] of Object.entries(m.identifiers)) idCount.set(`${k}:${v}`, (idCount.get(`${k}:${v}`) ?? 0) + 1);
  for (const [key, c] of idCount) if (c >= 2) { const [k, v] = key.split(/:(.+)/); links.push({ by: 'identifier', detail: `${k.toUpperCase()} ${v}` }); }
  const nameCount = new Map<string, number>();
  for (const m of ms) if (m.norm) nameCount.set(m.norm, (nameCount.get(m.norm) ?? 0) + 1);
  for (const [name, c] of nameCount) if (c >= 2) { links.push({ by: 'name', detail: name }); break; }
  if (links.length === 0) links.push({ by: 'similarity', detail: [...new Set(ms.map((m) => m.norm))].join(' ~ ') });
  return links;
}

function pickCanonical(ms: EntityMention[]): string {
  const withForm = ms.filter((m) => LEGAL_SUFFIX.test(m.name));
  LEGAL_SUFFIX.lastIndex = 0;
  const pool = withForm.length ? withForm : ms;
  return pool.map((m) => m.name).sort((a, b) => b.length - a.length)[0];
}

function mode(xs: string[]): string {
  const c = new Map<string, number>();
  for (const x of xs) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'entity';
}

/** Convenience: extract + resolve in one call. */
export function resolveEntities(results: CollectResult[]): ResolvedEntity[] {
  return resolveMentions(extractMentions(results));
}
