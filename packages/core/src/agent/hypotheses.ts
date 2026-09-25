import type { CollectResult } from '../connectors/types.js';
import type { Hypothesis } from './types.js';

/**
 * Analysis of Competing Hypotheses (memo T2). Rather than confirm one story, we
 * state several mutually-exclusive hypotheses and score each against the SAME
 * body of collected evidence: how many independent signals are consistent with
 * it (support) versus inconsistent (disconfirm). Heuer's discipline: the
 * surviving hypothesis is the one with the fewest inconsistencies, not the most
 * confirmations. Scoring is deterministic and derived from the evidence, so it
 * is reproducible and cannot be hallucinated.
 */
interface Signals {
  liveDns: boolean;
  dnsChecked: boolean;
  dnsEmpty: boolean;
  openPorts: number;
  knownCves: number;
  subdomains: number;
  waybackCount: number;
  waybackRecent: boolean;
  sanctions: number;
  lei: number;
  sec: number;
  court: number;
  news: number;
  scholar: number;
  osm: number;
  aircraft: number;
}

function extract(results: CollectResult[]): Signals {
  const by = (id: string) => results.find((r) => r.connector === id);
  const dns = by('dns');
  const idb = (by('internetdb')?.items[0]?.data ?? {}) as { ports?: unknown[]; vulns?: unknown[] };
  const wb = by('wayback');
  const thisYear = new Date().getFullYear();
  const waybackRecent = (wb?.items ?? []).some((it) => {
    const ts = String((it.data as { timestamp?: string }).timestamp ?? '');
    const y = Number(ts.slice(0, 4));
    return y >= thisYear - 2;
  });
  const dnsAddrs = (dns?.items ?? []).filter((it) => {
    const t = (it.data as { type?: string }).type;
    return t === 'A' || t === 'AAAA';
  }).length;
  return {
    liveDns: dnsAddrs > 0,
    dnsChecked: !!dns && !dns.warning,
    dnsEmpty: !!dns && !dns.warning && dnsAddrs === 0,
    openPorts: (idb.ports ?? []).length,
    knownCves: (idb.vulns ?? []).length,
    subdomains: by('crtsh')?.items.length ?? 0,
    waybackCount: wb?.items.length ?? 0,
    waybackRecent,
    sanctions: by('opensanctions')?.items.length ?? 0,
    lei: by('gleif')?.items.length ?? 0,
    sec: by('sec')?.items.length ?? 0,
    court: by('courtlistener')?.items.length ?? 0,
    news: by('gdelt')?.items.length ?? 0,
    scholar: by('openalex')?.items.length ?? 0,
    osm: by('overpass')?.items.length ?? 0,
    aircraft: by('adsb')?.items.length ?? 0,
  };
}

type Kind = 'infra' | 'entity' | 'geo';
function domainKind(results: CollectResult[]): Kind {
  const domains = new Set(results.map((r) => r.domain));
  if (domains.has('geoint')) return 'geo';
  if (domains.has('records') || domains.has('media')) return 'entity';
  return 'infra';
}

/** A hypothesis with its scored evidence tallies. */
function score(statement: string, support: number, disconfirm: number, note: string): Omit<Hypothesis, 'id'> {
  return { statement, support, disconfirm, note };
}

export function buildHypotheses(results: CollectResult[]): Hypothesis[] {
  const s = extract(results);
  const kind = domainKind(results);
  let raw: Omit<Hypothesis, 'id'>[] = [];

  if (kind === 'infra') {
    const active = (s.liveDns ? 2 : 0) + (s.openPorts > 0 ? 1 : 0) + (s.waybackRecent ? 1 : 0) + (s.subdomains > 0 ? 1 : 0);
    const activeNo = (s.dnsEmpty ? 2 : 0) + (s.dnsChecked && s.waybackCount === 0 ? 1 : 0);
    raw = [
      score('The infrastructure is actively operated',
        active, activeNo,
        s.liveDns ? `Live DNS${s.openPorts ? `, ${s.openPorts} open ports` : ''}${s.waybackRecent ? ', recent snapshots' : ''}.` : 'No live resolution observed.'),
      score('The infrastructure is dormant, parked, or abandoned',
        (s.dnsEmpty ? 2 : 0) + (s.waybackCount === 0 ? 1 : 0), (s.liveDns ? 2 : 0) + (s.openPorts > 0 ? 1 : 0),
        s.dnsEmpty ? 'DNS resolved no addresses.' : 'Contradicted by live resolution.'),
      score('The infrastructure exposes services meriting security review',
        (s.openPorts > 0 ? 1 : 0) + (s.knownCves > 0 ? 2 : 0), (s.dnsChecked && s.openPorts === 0 ? 1 : 0),
        s.knownCves > 0 ? `${s.knownCves} known CVEs on exposed services.` : s.openPorts > 0 ? `${s.openPorts} open ports, no catalogued CVEs.` : 'No exposed services observed.'),
    ];
  } else if (kind === 'entity') {
    const registered = (s.lei > 0 ? 2 : 0) + (s.sec > 0 ? 2 : 0);
    raw = [
      score('A legitimately registered organization',
        registered, (s.lei === 0 && s.sec === 0 ? 1 : 0),
        s.lei > 0 || s.sec > 0 ? `${[s.lei && 'LEI registration', s.sec && 'SEC filings'].filter(Boolean).join(' and ')}.` : 'No corporate registration matched.'),
      score('Carries legal, regulatory, or sanctions risk',
        (s.sanctions > 0 ? 3 : 0) + (s.court > 0 ? 1 : 0), (s.sanctions === 0 && s.court === 0 ? 2 : 0),
        s.sanctions > 0 ? `${s.sanctions} sanctions/PEP/watchlist matches (verify identity).` : s.court > 0 ? `${s.court} court records.` : 'Sanctions and litigation screens are clear.'),
      score('Primarily an individual or a limited public footprint',
        (s.scholar > 0 ? 1 : 0) + (s.lei === 0 && s.sec === 0 ? 1 : 0), (s.lei > 0 ? 1 : 0) + (s.sec > 0 ? 1 : 0),
        s.scholar > 0 ? `${s.scholar} scholarly works; no corporate registration.` : 'Sparse corporate footprint.'),
    ];
  } else {
    raw = [
      score('An active public venue or built-up area',
        (s.osm > 3 ? 2 : 0) + (s.aircraft > 0 ? 1 : 0), (s.osm <= 1 ? 1 : 0),
        s.osm > 0 ? `${s.osm} named places nearby${s.aircraft ? `, ${s.aircraft} aircraft overhead` : ''}.` : 'Few mapped features nearby.'),
      score('A low-activity or residential location',
        (s.osm <= 1 ? 2 : 0), (s.osm > 3 ? 2 : 0) + (s.aircraft > 0 ? 1 : 0),
        s.osm <= 1 ? 'Sparse public features.' : 'Contradicted by dense features nearby.'),
    ];
  }

  return raw
    .map((h, i) => ({ id: `H${i + 1}`, ...h }))
    .sort((a, b) => (b.support - b.disconfirm) - (a.support - a.disconfirm));
}
