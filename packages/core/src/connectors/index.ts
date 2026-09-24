import type { CollectResult, CollectionTask, Connector, Domain } from './types.js';
import { crtshConnector } from './crtsh.js';
import { internetdbConnector } from './internetdb.js';
import { waybackConnector } from './wayback.js';
import { dnsConnector } from './dns.js';
import { gdeltConnector } from './gdelt.js';
import { openalexConnector } from './openalex.js';
import { opensanctionsConnector } from './opensanctions.js';
import { courtlistenerConnector } from './courtlistener.js';
import { gleifConnector } from './gleif.js';
import { secConnector } from './sec.js';
import { adsbConnector } from './adsb.js';
import { overpassConnector } from './overpass.js';

export const CONNECTORS: Connector[] = [
  crtshConnector,
  dnsConnector,
  internetdbConnector,
  waybackConnector,
  opensanctionsConnector,
  gleifConnector,
  secConnector,
  courtlistenerConnector,
  gdeltConnector,
  openalexConnector,
  adsbConnector,
  overpassConnector,
];

export function getConnector(id: string): Connector | undefined {
  return CONNECTORS.find((c) => c.id === id);
}

export async function runConnector(id: string, task: CollectionTask, ua: string): Promise<CollectResult> {
  const c = getConnector(id);
  if (!c) throw new Error(`unknown connector: ${id}`);
  if (!c.applicable(task)) {
    return { connector: id, domain: c.domain, target: task.target, items: [], provenance: { connector: id, sourceUrl: '', fetchedAt: new Date().toISOString(), sha256: '', licenseNote: c.tosNote }, warning: `${id} does not accept this target shape` };
  }
  return c.run(task, ua);
}

/** Run every applicable connector against a target (a recon sweep). */
export async function reconTarget(target: string, ua: string): Promise<CollectResult[]> {
  const task: CollectionTask = { target };
  const applicable = CONNECTORS.filter((c) => c.applicable(task));
  return Promise.all(
    applicable.map((c) =>
      c.run(task, ua).catch((err): CollectResult => ({
        connector: c.id,
        domain: c.domain,
        target,
        items: [],
        provenance: { connector: c.id, sourceUrl: '', fetchedAt: new Date().toISOString(), sha256: '', licenseNote: c.tosNote },
        warning: (err as Error).message,
      })),
    ),
  );
}

export function sourceTierOf(id: string): string {
  return getConnector(id)?.sourceTier ?? 'community';
}

/**
 * Cross-source corroboration (memo T1): a claim's confidence is a function of
 * how many INDEPENDENT sources attest it, not text plausibility. Collects the
 * hosts/IPs each connector reports and counts distinct attesting sources.
 */
export interface Corroboration {
  value: string;
  sources: { connector: string; tier: string }[];
  count: number;
}
export function corroborate(results: CollectResult[]): Corroboration[] {
  const byValue = new Map<string, Map<string, string>>();
  const note = (value: string, connector: string) => {
    const v = value.toLowerCase().trim();
    if (!v) return;
    const m = byValue.get(v) ?? byValue.set(v, new Map()).get(v)!;
    m.set(connector, sourceTierOf(connector));
  };
  for (const r of results) {
    for (const it of r.items) {
      const d = it.data as Record<string, unknown>;
      // infrastructure identifiers
      if (typeof d.host === 'string') note(d.host, r.connector);
      if (typeof d.value === 'string' && it.kind === 'dns_record' && (d.type === 'A' || d.type === 'AAAA')) note(d.value, r.connector);
      for (const h of (d.hostnames as string[] | undefined) ?? []) note(h, r.connector);
      // entity names across records sources
      if (typeof d.caption === 'string') note(d.caption, r.connector);
      if (typeof d.legalName === 'string') note(d.legalName, r.connector);
      if (typeof d.filer === 'string') note(d.filer, r.connector);
    }
  }
  return [...byValue.entries()]
    .map(([value, m]) => ({ value, sources: [...m.entries()].map(([connector, tier]) => ({ connector, tier })), count: m.size }))
    .filter((c) => c.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, 100);
}

export interface ConnectorInfo {
  id: string;
  domain: Domain;
  auth: string;
  capabilities: string[];
  sourceTier: string;
  rateLimit: { rps: number; burst?: number };
  tosNote: string;
  available: boolean;
}

/** Capability matrix: which connectors are reachable right now (doc 01.5). */
export async function capabilityMatrix(ua: string): Promise<ConnectorInfo[]> {
  return Promise.all(
    CONNECTORS.map(async (c) => ({
      id: c.id,
      domain: c.domain,
      auth: c.auth,
      capabilities: c.capabilities,
      sourceTier: c.sourceTier,
      rateLimit: c.rateLimit,
      tosNote: c.tosNote,
      available: await c.healthCheck(ua).catch(() => false),
    })),
  );
}

export * from './types.js';
export { sha256, provenance } from './provenance.js';
export { sealBundle, verifyBundle, merkleRoot, canonical } from './bundle.js';
export type { EvidenceBundle, BundleEntry, VerifyReport } from './bundle.js';
