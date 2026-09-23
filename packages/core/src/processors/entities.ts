import nlp from 'compromise';
import type { Entity } from '../types.js';

const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/gi;
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
const HASHTAG_RE = /(?:^|\s)#([A-Za-z0-9_]{2,})/g;
const MENTION_RE = /(?:^|\s)@([A-Za-z0-9_.]{2,})/g;

/** Extract named + structural entities. Local via compromise + regex. Free. */
export function extractEntities(text: string): Entity[] {
  const out: Entity[] = [];
  const seen = new Set<string>();
  const push = (value: string, type: Entity['type'], confidence: number) => {
    const key = `${type}:${value.toLowerCase()}`;
    if (!value || seen.has(key)) return;
    seen.add(key);
    out.push({ value, type, confidence });
  };

  const clean = (text || '').slice(0, 10000);
  if (!clean.trim()) return out;

  // Structural entities via regex (deterministic, high confidence).
  for (const m of clean.matchAll(URL_RE)) push(m[0], 'url', 0.99);
  for (const m of clean.matchAll(EMAIL_RE)) push(m[0], 'email', 0.99);
  for (const m of clean.matchAll(HASHTAG_RE)) push(m[1], 'hashtag', 0.95);
  for (const m of clean.matchAll(MENTION_RE)) push(m[1], 'mention', 0.9);

  // Named entities via compromise NER.
  try {
    const doc = nlp(clean);
    (doc.people().out('array') as string[]).forEach((v) => push(v, 'person', 0.7));
    (doc.organizations().out('array') as string[]).forEach((v) => push(v, 'organization', 0.7));
    (doc.places().out('array') as string[]).forEach((v) => push(v, 'place', 0.7));
  } catch {
    /* compromise never throws in practice; ignore defensively */
  }

  return out;
}
