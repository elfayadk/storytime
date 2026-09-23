/**
 * Lightweight stylometry: a per-author writing-style fingerprint from cheap,
 * language-agnostic features. Used to gauge whether two handles are plausibly
 * the same author across platforms. Deterministic, no ML.
 */
import type { TimelineEvent } from '../types.js';

const FUNCTION_WORDS = [
  'the', 'and', 'to', 'of', 'a', 'in', 'that', 'it', 'is', 'was', 'for', 'on',
  'with', 'as', 'but', 'be', 'this', 'i', 'you', 'not', 'are', 'have', 'so',
];

export interface StyleFingerprint {
  handle: string;
  events: number;
  features: {
    avgWords: number;
    avgWordLen: number;
    emojiRate: number;
    hashtagRate: number;
    mentionRate: number;
    exclaimRate: number;
    questionRate: number;
    uppercaseRate: number;
    lexicalDiversity: number;
    functionWordRate: number;
  };
  vector: Float32Array; // normalized feature vector for cosine comparison
}

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

export function fingerprint(handle: string, events: TimelineEvent[]): StyleFingerprint {
  const texts = events.map((e) => e.content || e.title).filter(Boolean);
  const joined = texts.join(' ');
  const words = joined.toLowerCase().match(/[a-z']+/g) ?? [];
  const totalWords = words.length || 1;
  const uniq = new Set(words).size;

  const perText = texts.map((t) => (t.match(/\S+/g) ?? []).length);
  const f = {
    avgWords: avg(perText),
    avgWordLen: words.reduce((a, w) => a + w.length, 0) / totalWords,
    emojiRate: (joined.match(EMOJI_RE)?.length ?? 0) / totalWords,
    hashtagRate: (joined.match(/#/g)?.length ?? 0) / totalWords,
    mentionRate: (joined.match(/@/g)?.length ?? 0) / totalWords,
    exclaimRate: (joined.match(/!/g)?.length ?? 0) / totalWords,
    questionRate: (joined.match(/\?/g)?.length ?? 0) / totalWords,
    uppercaseRate: (joined.match(/[A-Z]/g)?.length ?? 0) / (joined.length || 1),
    lexicalDiversity: uniq / totalWords,
    functionWordRate:
      words.filter((w) => FUNCTION_WORDS.includes(w)).length / totalWords,
  };

  // Feature vector (scaled so no single feature dominates), then L2-normalize.
  const raw = Float32Array.from([
    Math.min(f.avgWords / 50, 1),
    Math.min(f.avgWordLen / 10, 1),
    Math.min(f.emojiRate * 20, 1),
    Math.min(f.hashtagRate * 20, 1),
    Math.min(f.mentionRate * 20, 1),
    Math.min(f.exclaimRate * 20, 1),
    Math.min(f.questionRate * 20, 1),
    Math.min(f.uppercaseRate * 5, 1),
    f.lexicalDiversity,
    f.functionWordRate * 2,
  ]);
  let s = 0;
  for (const x of raw) s += x * x;
  const norm = Math.sqrt(s) || 1;
  for (let i = 0; i < raw.length; i++) raw[i] /= norm;

  return { handle, events: events.length, features: f, vector: raw };
}

/** Fingerprint every distinct author in the event set. */
export function fingerprintAuthors(events: TimelineEvent[]): StyleFingerprint[] {
  const byAuthor = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const key = e.username || 'unknown';
    (byAuthor.get(key) ?? byAuthor.set(key, []).get(key)!).push(e);
  }
  return [...byAuthor.entries()]
    .filter(([, evs]) => evs.length >= 2)
    .map(([handle, evs]) => fingerprint(handle, evs));
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
