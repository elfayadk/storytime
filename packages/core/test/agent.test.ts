import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toolCatalog, applicableTools } from '../src/agent/tools.js';
import { buildHypotheses } from '../src/agent/hypotheses.js';
import { planInvestigation } from '../src/agent/planner.js';
import type { CollectResult, Domain } from '../src/connectors/types.js';

function result(connector: string, domain: Domain, items: Record<string, unknown>[], warning?: string): CollectResult {
  const prov = { connector, sourceUrl: `https://src/${connector}`, fetchedAt: '', sha256: 'a'.repeat(64), licenseNote: '' };
  return { connector, domain, target: 't', items: items.map((data) => ({ kind: 'x', data, provenance: prov })), provenance: prov, warning };
}

test('toolCatalog exposes one tool per connector, no drift', () => {
  const cat = toolCatalog();
  assert.equal(cat.length, 13);
  assert.ok(cat.every((t) => t.name && t.description && t.domain));
  assert.ok(cat.find((t) => t.name === 'gleif'));
});

test('applicableTools gates by target shape', () => {
  const dom = applicableTools('example.com').map((t) => t.name);
  assert.ok(dom.includes('dns') && dom.includes('wayback') && dom.includes('crtsh'));
  assert.ok(!dom.includes('adsb') && !dom.includes('overpass'));

  const geo = applicableTools('40.7,-74.0').map((t) => t.name);
  assert.ok(geo.includes('adsb') && geo.includes('overpass'));
  assert.ok(!geo.includes('dns'));
});

test('ACH ranks "actively operated" for live infra', () => {
  const results = [
    result('dns', 'infra', [{ type: 'A', value: '1.2.3.4' }]),
    result('internetdb', 'infra', [{ ports: [80, 443], vulns: [] }]),
    result('crtsh', 'infra', [{ host: 'a.example.com' }]),
  ];
  const h = buildHypotheses(results);
  assert.equal(h[0].statement, 'The infrastructure is actively operated');
  assert.ok(h[0].support > h[0].disconfirm);
});

test('ACH ranks "dormant" when DNS resolves nothing', () => {
  const results = [result('dns', 'infra', [])]; // checked, no A records, no warning
  const h = buildHypotheses(results);
  assert.equal(h[0].statement, 'The infrastructure is dormant, parked, or abandoned');
});

test('ACH ranks "registered organization" when an LEI exists', () => {
  const results = [
    result('gleif', 'records', [{ legalName: 'ACME', lei: '5493...' }]),
    result('opensanctions', 'records', []),
  ];
  const h = buildHypotheses(results);
  assert.equal(h[0].statement, 'A legitimately registered organization');
});

test('ACH surfaces sanctions risk as the leading hypothesis on a hit', () => {
  const results = [
    result('opensanctions', 'records', [{ caption: 'Someone', topics: ['sanction'] }]),
    result('gleif', 'records', []),
  ];
  const h = buildHypotheses(results);
  assert.equal(h[0].statement, 'Carries legal, regulatory, or sanctions risk');
});

test('planner falls back to deterministic order without a model', async () => {
  const tools = applicableTools('example.com');
  const plan = await planInvestigation('objective', 'example.com', tools); // no ai
  assert.equal(plan.usedAI, false);
  assert.deepEqual([...plan.order].sort(), [...tools.map((t) => t.name)].sort());
  // cheapest-first: dns before crtsh
  assert.ok(plan.order.indexOf('dns') < plan.order.indexOf('crtsh'));
});
