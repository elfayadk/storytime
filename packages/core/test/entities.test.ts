import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEntityName, jaroWinkler, resolveEntities, extractMentions } from '../src/connectors/entities.js';
import type { CollectResult, Domain } from '../src/connectors/types.js';

function result(connector: string, items: Record<string, unknown>[], domain: Domain = 'records'): CollectResult {
  const prov = { connector, sourceUrl: `https://src/${connector}`, fetchedAt: '', sha256: '', licenseNote: '' };
  return { connector, domain, target: 't', items: items.map((data) => ({ kind: 'x', data, provenance: prov })), provenance: prov };
}

test('normalizeEntityName folds case, diacritics and legal suffixes', () => {
  assert.equal(normalizeEntityName('TESLA, INC.'), 'tesla');
  assert.equal(normalizeEntityName('Nestlé S.A.'), 'nestle');
  assert.equal(normalizeEntityName('Acme Holdings Ltd'), 'acme');
  assert.equal(normalizeEntityName('AT&T Corp'), 'at and t');
});

test('jaroWinkler rewards a shared prefix', () => {
  assert.equal(jaroWinkler('tesla', 'tesla'), 1);
  assert.ok(jaroWinkler('tesla', 'tezla') > 0.85);
  assert.ok(jaroWinkler('tesla', 'toyota') < 0.7);
});

test('records naming the same org collapse into one entity across sources', () => {
  const results = [
    result('gleif', [{ legalName: 'TESLA, INC.', lei: '54930043XZGB27CTOV49', country: 'US', url: 'g' }]),
    result('sec', [{ filer: 'Tesla, Inc.', form: '10-K', url: 's' }]),
    result('courtlistener', [{ caseName: 'Doe v. Tesla, Inc.', court: 'CA', url: 'c' }]),
  ];
  const ents = resolveEntities(results);
  const tesla = ents.find((e) => e.canonicalName.toLowerCase().includes('tesla'));
  assert.ok(tesla, 'a Tesla entity resolves');
  // gleif + sec share the normalized name "tesla"; courtlistener caseName differs.
  assert.ok(tesla!.sources.includes('gleif') && tesla!.sources.includes('sec'));
  assert.equal(tesla!.identifiers.lei, '54930043XZGB27CTOV49');
  assert.ok(tesla!.confidence >= 0.8, 'identifier-bound multi-source cluster is high confidence');
});

test('a shared identifier links entities even when names differ', () => {
  const results = [
    result('gleif', [{ legalName: 'Alphabet Inc', lei: '5493006MHB84DD0ZWV18' }]),
    result('sec', [{ filer: 'GOOGLE LLC', cik: '1652044', ticker: 'GOOGL' }]),
    result('sec', [{ filer: 'Alphabet', cik: '1652044' }]), // same CIK as GOOGLE row
  ];
  const ents = resolveEntities(results);
  // The two CIK-1652044 rows must be one entity regardless of name.
  const byCik = ents.filter((e) => e.identifiers.cik === '1652044');
  assert.equal(byCik.length, 1);
  assert.ok(byCik[0].links.some((l) => l.by === 'identifier'));
});

test('same name but conflicting LEIs stay separate (different legal entities)', () => {
  const results = [
    result('gleif', [{ legalName: 'ALPHABET, INC.', lei: 'AAA0000000000000AAAA' }]),
    result('gleif', [{ legalName: 'Alphabet Inc', lei: 'BBB0000000000000BBBB' }]),
    result('gleif', [{ legalName: 'Alphabet Energy Inc', lei: 'CCC0000000000000CCCC' }]),
  ];
  const ents = resolveEntities(results);
  const alphabets = ents.filter((e) => e.canonicalName.toLowerCase().includes('alphabet'));
  assert.equal(alphabets.length, 3, 'three distinct LEIs remain three entities');
});

test('similar person names are NOT fuzzily merged', () => {
  const results = [
    result('openalex', [{ authors: ['John Smith'], title: 'A' }]),
    result('openalex', [{ authors: ['Jon Smyth'], title: 'B' }]),
  ];
  const ents = resolveEntities(results);
  const people = ents.filter((e) => e.role === 'author' || e.role === 'person');
  assert.equal(people.length, 2, 'distinct people stay distinct');
});

test('extractMentions ignores connectors without entity records', () => {
  const results = [result('dns', [{ type: 'A', value: '1.2.3.4' }], 'infra')];
  assert.equal(extractMentions(results).length, 0);
});
