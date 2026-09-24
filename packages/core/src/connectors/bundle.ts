/**
 * Courtroom-grade evidence bundles (memo T9). A recon sweep is sealed into a
 * self-contained, re-verifiable bundle: every result's raw-response hash and a
 * canonical hash of its parsed items, bound together by a Merkle root. Anyone
 * can re-run the verifier and confirm nothing was added, removed, or altered.
 * Pure Node crypto, no dependencies. Provenance proves WHAT was collected WHEN;
 * corroboration (T1) argues whether it is real.
 */
import { createHash } from 'node:crypto';
import type { CollectResult } from './types.js';

/** Deterministic JSON: sorted keys, no whitespace. */
export function canonical(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const keys = Object.keys(v as object).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
}

const sha = (s: string | Buffer) => createHash('sha256').update(s).digest('hex');
const leaf = (hex: string) => createHash('sha256').update(Buffer.concat([Buffer.from([0]), Buffer.from(hex, 'hex')])).digest('hex');
const node = (a: string, b: string) => createHash('sha256').update(Buffer.concat([Buffer.from([1]), Buffer.from(a, 'hex'), Buffer.from(b, 'hex')])).digest('hex');

/** Order-independent Merkle root over a set of hex hashes. */
export function merkleRoot(hashes: string[]): string {
  if (hashes.length === 0) return sha('');
  let level = [...hashes].sort().map(leaf);
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? node(level[i], level[i + 1]) : level[i]);
    level = next;
  }
  return level[0];
}

export interface BundleEntry {
  connector: string;
  domain: string;
  sourceUrl: string;
  fetchedAt: string;
  responseSha256: string; // hash of the raw response (from provenance)
  itemsSha256: string; // hash of the canonical parsed items
  itemCount: number;
  license: string;
  sourceTier: string;
  warning?: string;
}

export interface EvidenceBundle {
  manifest: {
    tool: string;
    version: string;
    generatedAt: string;
    target: string;
    entries: BundleEntry[];
    merkleRoot: string;
    note: string;
  };
  results: CollectResult[];
}

export function sealBundle(target: string, results: CollectResult[], version: string, sourceTierOf: (id: string) => string): EvidenceBundle {
  const entries: BundleEntry[] = results.map((r) => {
    const itemsSha256 = sha(canonical(r.items.map((i) => i.data)));
    return {
      connector: r.connector,
      domain: r.domain,
      sourceUrl: r.provenance.sourceUrl,
      fetchedAt: r.provenance.fetchedAt,
      responseSha256: r.provenance.sha256,
      itemsSha256,
      itemCount: r.items.length,
      license: r.provenance.licenseNote,
      sourceTier: sourceTierOf(r.connector),
      warning: r.warning,
    };
  });
  const root = merkleRoot(entries.flatMap((e) => [e.responseSha256, e.itemsSha256].filter(Boolean)));
  return {
    manifest: {
      tool: 'storytime',
      version,
      generatedAt: new Date().toISOString(),
      target,
      entries,
      merkleRoot: root,
      note: 'Re-verify by recomputing each itemsSha256 (sha256 of canonical items[].data) and the Merkle root. Provenance proves what was collected when, not that the content is true.',
    },
    results,
  };
}

export interface VerifyReport {
  valid: boolean;
  merkleRootMatches: boolean;
  mismatches: { connector: string; field: string }[];
}

/** Recompute hashes and the Merkle root; report any tampering. */
export function verifyBundle(bundle: EvidenceBundle): VerifyReport {
  const mismatches: { connector: string; field: string }[] = [];
  const byConnector = new Map(bundle.results.map((r) => [r.connector, r]));
  for (const e of bundle.manifest.entries) {
    const r = byConnector.get(e.connector);
    if (!r) {
      mismatches.push({ connector: e.connector, field: 'missing result' });
      continue;
    }
    if (sha(canonical(r.items.map((i) => i.data))) !== e.itemsSha256) mismatches.push({ connector: e.connector, field: 'itemsSha256' });
    if (r.provenance.sha256 !== e.responseSha256) mismatches.push({ connector: e.connector, field: 'responseSha256' });
  }
  const root = merkleRoot(bundle.manifest.entries.flatMap((e) => [e.responseSha256, e.itemsSha256].filter(Boolean)));
  const merkleRootMatches = root === bundle.manifest.merkleRoot;
  return { valid: mismatches.length === 0 && merkleRootMatches, merkleRootMatches, mismatches };
}
