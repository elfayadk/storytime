#!/usr/bin/env node
// Verify a Storytime evidence bundle (memo T9). Dependency-free.
// Usage: node scripts/verify-bundle.mjs <bundle.evidence.json>
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const sha = (s) => createHash('sha256').update(s).digest('hex');
function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const keys = Object.keys(v).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
}
const leaf = (hex) => createHash('sha256').update(Buffer.concat([Buffer.from([0]), Buffer.from(hex, 'hex')])).digest('hex');
const node = (a, b) => createHash('sha256').update(Buffer.concat([Buffer.from([1]), Buffer.from(a, 'hex'), Buffer.from(b, 'hex')])).digest('hex');
function merkleRoot(hashes) {
  if (hashes.length === 0) return sha('');
  let level = [...hashes].sort().map(leaf);
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) next.push(i + 1 < level.length ? node(level[i], level[i + 1]) : level[i]);
    level = next;
  }
  return level[0];
}

const path = process.argv[2];
if (!path) {
  console.error('usage: node scripts/verify-bundle.mjs <bundle.evidence.json>');
  process.exit(2);
}
const bundle = JSON.parse(readFileSync(path, 'utf8'));
const byConnector = new Map(bundle.results.map((r) => [r.connector, r]));
const mismatches = [];
for (const e of bundle.manifest.entries) {
  const r = byConnector.get(e.connector);
  if (!r) { mismatches.push(`${e.connector}: result missing`); continue; }
  if (sha(canonical(r.items.map((i) => i.data))) !== e.itemsSha256) mismatches.push(`${e.connector}: itemsSha256 mismatch`);
  if (r.provenance.sha256 !== e.responseSha256) mismatches.push(`${e.connector}: responseSha256 mismatch`);
}
const root = merkleRoot(bundle.manifest.entries.flatMap((e) => [e.responseSha256, e.itemsSha256].filter(Boolean)));
const rootOk = root === bundle.manifest.merkleRoot;

console.log(`target: ${bundle.manifest.target}`);
console.log(`sealed: ${bundle.manifest.generatedAt} by ${bundle.manifest.tool} v${bundle.manifest.version}`);
console.log(`entries: ${bundle.manifest.entries.length}`);
console.log(`merkle root: ${rootOk ? 'OK' : 'MISMATCH'}`);
if (mismatches.length) mismatches.forEach((m) => console.log('  x ' + m));
const valid = rootOk && mismatches.length === 0;
console.log(valid ? '\nVERIFIED: nothing was added, removed, or altered.' : '\nFAILED: bundle has been tampered with.');
process.exit(valid ? 0 : 1);
