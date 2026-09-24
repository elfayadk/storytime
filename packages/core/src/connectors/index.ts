import type { CollectResult, CollectionTask, Connector, Domain } from './types.js';
import { crtshConnector } from './crtsh.js';
import { internetdbConnector } from './internetdb.js';
import { waybackConnector } from './wayback.js';
import { dnsConnector } from './dns.js';

export const CONNECTORS: Connector[] = [crtshConnector, dnsConnector, internetdbConnector, waybackConnector];

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

export interface ConnectorInfo {
  id: string;
  domain: Domain;
  auth: string;
  capabilities: string[];
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
      rateLimit: c.rateLimit,
      tosNote: c.tosNote,
      available: await c.healthCheck(ua).catch(() => false),
    })),
  );
}

export * from './types.js';
export { sha256, provenance } from './provenance.js';
