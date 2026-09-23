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
import type { TimelineEvent, TimelineResult } from '../src/types.js';

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
