import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DateTime } from 'luxon';
import { analyzeSentiment } from '../src/processors/sentiment.js';
import { extractEntities } from '../src/processors/entities.js';
import { classifyTarget, stripHtml } from '../src/ingesters/base.js';
import { buildNetwork } from '../src/processors/network.js';
import { computeStats } from '../src/processors/stats.js';
import { exportTimeline } from '../src/exporters/index.js';
import { hashEmbed } from '../src/ai/embeddings.js';
import { cosine, clusterVectors, rankBySimilarity } from '../src/processors/semantic.js';
import { simhash, hammingDistance, fuseCrossPosts } from '../src/processors/dedup.js';
import { detectAnomalies } from '../src/processors/anomaly.js';
import { fingerprint } from '../src/processors/stylometry.js';
import { computeRhythm } from '../src/processors/rhythm.js';
import { bocpd } from '../src/processors/bocpd.js';
import { coordination, type Action } from '../src/processors/coordination.js';
import { detectLang } from '../src/util/lang.js';
import { buildArcs } from '../src/processors/arcs.js';
import { buildFacts } from '../src/processors/facts.js';
import { loadConfig } from '../src/config.js';
import { createLogger } from '../src/util/logger.js';
import { classifyOsintTarget, sha256, provenance } from '../src/connectors/index.js';
import { crtshConnector } from '../src/connectors/crtsh.js';
import { internetdbConnector } from '../src/connectors/internetdb.js';
import type { ClusterSummary, TimelineEvent, TimelineResult } from '../src/types.js';

function ev(partial: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: 'x:1',
    platform: 'github',
    category: 'post',
    timestamp: DateTime.fromISO('2026-01-01T12:00:00Z'),
    originalTimestamp: '2026-01-01T12:00:00Z',
    title: 'Title',
    content: 'Content',
    url: 'https://example.com',
    username: 'alice',
    metadata: {},
    ...partial,
  };
}

test('classifyTarget distinguishes identifier kinds', () => {
  assert.equal(classifyTarget('#infosec').kind, 'hashtag');
  assert.equal(classifyTarget('https://a.b/c').kind, 'url');
  // user@host.tld is a Mastodon-style handle here, not an email.
  assert.equal(classifyTarget('user@mastodon.social').kind, 'handle');
  assert.equal(classifyTarget('user@mastodon.social').value, 'user@mastodon.social');
  assert.equal(classifyTarget('jay.bsky.team').kind, 'handle');
  assert.equal(classifyTarget('torvalds').kind, 'username');
  assert.equal(classifyTarget('@torvalds').value, 'torvalds');
});

test('sentiment: positive vs negative vs neutral', () => {
  assert.equal(analyzeSentiment('I love this, it is wonderful and great').label, 'positive');
  assert.equal(analyzeSentiment('this is terrible awful horrible and bad').label, 'negative');
  assert.equal(analyzeSentiment('').label, 'neutral');
});

test('entities: extracts urls, mentions, hashtags, emails', () => {
  const ents = extractEntities('Hey @bob check https://x.io #devops mail me a@b.com');
  const types = new Set(ents.map((e) => e.type));
  assert.ok(types.has('mention'));
  assert.ok(types.has('url'));
  assert.ok(types.has('hashtag'));
  assert.ok(types.has('email'));
});

test('stripHtml removes tags and decodes entities', () => {
  assert.equal(stripHtml('<p>hi &amp; bye</p>'), 'hi & bye');
});

test('buildNetwork creates mention edges', () => {
  const events = [
    ev({ username: 'alice', entities: [{ value: 'bob', type: 'mention', confidence: 1 }] }),
  ];
  const g = buildNetwork(events);
  assert.ok(g.nodes.find((n) => n.id === 'alice'));
  assert.ok(g.edges.find((e) => e.source === 'alice' && e.target === 'bob'));
});

test('computeStats aggregates by platform and sentiment', () => {
  const events = [
    ev({ platform: 'github', sentiment: { score: 0.5, label: 'positive' } }),
    ev({ id: 'x:2', platform: 'mastodon', sentiment: { score: -0.5, label: 'negative' } }),
  ];
  const stats = computeStats(events, []);
  assert.equal(stats.totalEvents, 2);
  assert.equal(stats.byPlatform.github, 1);
  assert.equal(stats.byPlatform.mastodon, 1);
  assert.equal(stats.sentiment.positive, 1);
  assert.equal(stats.sentiment.negative, 1);
});

test('exporters produce non-empty output in every format', () => {
  const result: TimelineResult = {
    target: 'alice',
    generatedAt: '2026-01-01T12:00:00Z',
    events: [ev({ topics: ['ci'], sentiment: { score: 0.2, label: 'positive' } })],
    stats: computeStats([ev({})], [{ topic: 'ci', count: 1 }]),
    graph: { nodes: [], edges: [] },
  };
  for (const fmt of ['json', 'csv', 'md', 'xml', 'html'] as const) {
    const out = exportTimeline(result, fmt);
    assert.ok(out.length > 0, `${fmt} empty`);
  }
  assert.ok(exportTimeline(result, 'json').includes('"target": "alice"'));
  assert.ok(exportTimeline(result, 'html').includes('<!doctype html>'));
});

test('hashEmbed is deterministic, normalized, and semantically sensible', () => {
  const a1 = hashEmbed('deploying the kubernetes cluster today');
  const a2 = hashEmbed('deploying the kubernetes cluster today');
  const b = hashEmbed('deploying the kubernetes cluster today');
  const far = hashEmbed('i had pizza and watched a movie');
  // deterministic
  assert.deepEqual(Array.from(a1), Array.from(a2));
  // normalized (unit length)
  const mag = Math.sqrt(Array.from(a1).reduce((s, x) => s + x * x, 0));
  assert.ok(Math.abs(mag - 1) < 1e-5);
  // same text → cosine 1; unrelated text → much lower
  assert.ok(cosine(a1, b) > 0.99);
  assert.ok(cosine(a1, far) < cosine(a1, b));
});

test('clusterVectors groups similar vectors', () => {
  const vecs = [
    hashEmbed('rust memory safety borrow checker'),
    hashEmbed('rust ownership and borrow checker semantics'),
    hashEmbed('baking sourdough bread at home'),
  ];
  const clusters = clusterVectors(vecs, 0.4);
  // the two rust vectors should share a cluster; bread stands apart
  const rustCluster = clusters.find((c) => c.members.includes(0));
  assert.ok(rustCluster?.members.includes(1));
  assert.ok(!rustCluster?.members.includes(2));
});

test('rankBySimilarity puts the closest vector first', () => {
  const query = hashEmbed('open source security vulnerability');
  const vecs = [
    hashEmbed('my cat is very fluffy'),
    hashEmbed('a security vulnerability in the open source library'),
  ];
  const ranked = rankBySimilarity(query, vecs);
  assert.equal(ranked[0].index, 1);
});

test('simhash: near-identical text has small Hamming distance', () => {
  const a = simhash('The quick brown fox jumps over the lazy dog every morning');
  const b = simhash('The quick brown fox jumps over the lazy dog every evening');
  const c = simhash('Completely unrelated content about database indexing strategies');
  assert.ok(hammingDistance(a, b) <= 6);
  assert.ok(hammingDistance(a, c) > hammingDistance(a, b));
});

test('fuseCrossPosts merges the same post across platforms', () => {
  const text = 'Just shipped a big open-source release with better docs and tests!';
  const events = [
    ev({ id: 'mastodon:1', platform: 'mastodon', content: text, url: 'https://m/1',
      timestamp: DateTime.fromISO('2026-01-01T10:00:00Z') }),
    ev({ id: 'bluesky:1', platform: 'bluesky', content: text, url: 'https://b/1',
      timestamp: DateTime.fromISO('2026-01-01T10:05:00Z') }),
  ];
  const fused = fuseCrossPosts(events);
  assert.equal(fused.length, 1);
  assert.equal((fused[0].metadata as any).crossPostCount, 2);
});

test('detectAnomalies flags an activity burst', () => {
  const events: TimelineEvent[] = [];
  // baseline: 1/day for 5 days
  for (let d = 1; d <= 5; d++) {
    events.push(ev({ id: `b${d}`, timestamp: DateTime.fromISO(`2026-01-0${d}T09:00:00Z`) }));
  }
  // burst: 8 on day 6
  for (let i = 0; i < 8; i++) {
    events.push(ev({ id: `x${i}`, timestamp: DateTime.fromISO(`2026-01-06T${10 + i}:00:00Z`) }));
  }
  const insights = detectAnomalies(events);
  assert.ok(insights.some((i) => i.type === 'burst' && i.date === '2026-01-06'));
});

test('computeRhythm builds a 7x24 grid and finds the peak hour', () => {
  const events: TimelineEvent[] = [];
  // 5 events at 15:00 UTC, 1 at 03:00 UTC
  for (let i = 0; i < 5; i++) {
    events.push(ev({ id: `p${i}`, timestamp: DateTime.fromISO(`2026-03-0${i + 1}T15:00:00Z`, { zone: 'utc' }) }));
  }
  events.push(ev({ id: 'q', timestamp: DateTime.fromISO('2026-03-06T03:00:00Z', { zone: 'utc' }) }));
  const r = computeRhythm(events);
  assert.equal(r.grid.length, 7);
  assert.equal(r.grid[0].length, 24);
  assert.equal(r.peakHour, 15);
  assert.equal(r.total, 6);
  assert.equal(r.byHour[15], 5);
});

test('bocpd finds a change point when the activity regime shifts', () => {
  // 20 days at ~1/day, then 20 days at ~10/day.
  const counts = [...Array(20).fill(1), ...Array(20).fill(10)];
  const cps = bocpd(counts);
  assert.ok(cps.length > 0);
  assert.ok(cps.some((c) => c.index >= 18 && c.index <= 25), `change points at ${cps.map((c) => c.index)}`);
});

test('coordination clusters accounts that repeatedly co-share a key', () => {
  const actions: Action[] = [];
  const url = 'http://x/1';
  // three accounts post the same url within 10s, repeated 4 times
  for (let round = 0; round < 4; round++) {
    const base = round * 100000;
    for (const author of ['a', 'b', 'c']) actions.push({ author, key: url, ts: base + Math.random() * 5000 });
  }
  // plus noise from many other authors on other keys
  for (let i = 0; i < 20; i++) actions.push({ author: `n${i}`, key: `k${i}`, ts: i * 1000 });
  const clusters = coordination(actions, 60000, 3, 0.9);
  assert.ok(clusters.some((c) => c.size >= 3 && c.members.includes('a') && c.members.includes('b')));
});

test('detectLang flags Arabic as RTL and English as LTR', () => {
  assert.deepEqual(detectLang('مرحبا بالعالم هذا اختبار'), { lang: 'ar', rtl: true });
  assert.equal(detectLang('hello world this is a test').rtl, false);
});

test('buildArcs turns a cluster into a dated arc', () => {
  const events: TimelineEvent[] = [
    ev({ id: 'a', timestamp: DateTime.fromISO('2026-01-01T12:00:00Z', { zone: 'utc' }) }),
    ev({ id: 'b', timestamp: DateTime.fromISO('2026-01-05T12:00:00Z', { zone: 'utc' }) }),
    ev({ id: 'c', timestamp: DateTime.fromISO('2026-01-10T12:00:00Z', { zone: 'utc' }) }),
  ];
  const clusters: ClusterSummary[] = [{ id: 0, label: 'rust migration', size: 3, keywords: ['rust'], eventIds: ['a', 'b', 'c'] }];
  const arcs = buildArcs(events, clusters);
  assert.equal(arcs.length, 1);
  assert.equal(arcs[0].from, '2026-01-01');
  assert.equal(arcs[0].to, '2026-01-10');
  assert.ok(arcs[0].keyMoments.length >= 2);
});

test('buildFacts derives a works_on fact from a github push (no AI)', async () => {
  const events: TimelineEvent[] = [
    ev({ id: 'github:1', platform: 'github', category: 'code_push', username: 'alice', metadata: { repo: 'alice/proj' } }),
  ];
  const facts = await buildFacts(events, loadConfig(), createLogger('silent'), false);
  const f = facts.find((x) => x.predicate === 'works_on');
  assert.ok(f, 'expected a works_on fact');
  assert.equal(f!.object, 'alice/proj');
  assert.equal(f!.evidence[0].eventId, 'github:1');
});

test('classifyOsintTarget distinguishes domain, ip, url', () => {
  assert.equal(classifyOsintTarget('github.com').kind, 'domain');
  assert.equal(classifyOsintTarget('1.1.1.1').kind, 'ip');
  assert.equal(classifyOsintTarget('https://example.com/x').kind, 'url');
  assert.equal(classifyOsintTarget('a@b.com').kind, 'email');
});

test('provenance produces a stable sha256 envelope', () => {
  assert.equal(sha256('hello'), sha256('hello'));
  assert.notEqual(sha256('hello'), sha256('world'));
  const p = provenance('crtsh', 'https://crt.sh/x', '{"a":1}', 'public');
  assert.equal(p.connector, 'crtsh');
  assert.equal(p.sha256.length, 64);
  assert.ok(p.fetchedAt);
});

test('connectors declare correct applicability and metadata', () => {
  assert.equal(crtshConnector.domain, 'infra');
  assert.equal(crtshConnector.auth, 'none');
  assert.ok(crtshConnector.applicable({ target: 'example.com' }));
  assert.ok(!crtshConnector.applicable({ target: '1.1.1.1' }));
  assert.ok(internetdbConnector.applicable({ target: '8.8.8.8' }));
  assert.ok(!internetdbConnector.applicable({ target: 'example.com' }));
});

test('fingerprint produces a normalized style vector', () => {
  const events = [
    ev({ content: 'OMG this is amazing!!! 🎉🎉 #win @friend' }),
    ev({ content: 'Cannot believe it worked!!! 🚀 so hyped @team' }),
  ];
  const fp = fingerprint('alice', events);
  const mag = Math.sqrt(Array.from(fp.vector).reduce((s, x) => s + x * x, 0));
  assert.ok(Math.abs(mag - 1) < 1e-5);
  assert.ok(fp.features.emojiRate > 0);
  assert.ok(fp.features.exclaimRate > 0);
});
