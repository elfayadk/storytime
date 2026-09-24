/**
 * Structured fact extraction from one post using a local Ollama model with
 * JSON-schema-constrained output. Fully optional: any failure returns []. The
 * cheapest hallucination filter is the quote check: a fact whose supporting
 * quote is not a verbatim substring of the post is dropped.
 */
import { DateTime } from 'luxon';
import type { StorytimeConfig } from '../config.js';

export interface ExtractedFact {
  subject: string;
  subjectKind: 'person' | 'org' | 'project' | 'place' | 'topic';
  predicate: string;
  object: string | null;
  objectKind: 'person' | 'org' | 'project' | 'place' | 'topic' | 'literal' | null;
  validFrom: string | null;
  validTo?: string;
  stance: 'asserted' | 'reported' | 'questioned' | 'denied';
  quote: string;
  confidence: number;
}

const PREDICATES = ['works_on', 'maintains', 'released', 'joined', 'left', 'announced', 'located_in', 'attended', 'said', 'reported', 'corrected', 'other'];

const SCHEMA = {
  type: 'object',
  properties: {
    facts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          subject: { type: 'string' },
          subject_kind: { type: 'string', enum: ['person', 'org', 'project', 'place', 'topic'] },
          predicate: { type: 'string', enum: PREDICATES },
          object: { type: ['string', 'null'] },
          object_kind: { type: ['string', 'null'], enum: ['person', 'org', 'project', 'place', 'topic', 'literal', null] },
          when_iso: { type: ['string', 'null'] },
          stance: { type: 'string', enum: ['asserted', 'reported', 'questioned', 'denied'] },
          quote: { type: 'string' },
          confidence: { type: 'number' },
        },
        required: ['subject', 'subject_kind', 'predicate', 'stance', 'quote', 'confidence'],
      },
    },
  },
  required: ['facts'],
};

const SYSTEM =
  'Extract factual statements from ONE social post. Only use information in the post. ' +
  'Copy "quote" verbatim from the post. If nothing factual is stated, return {"facts": []}. ' +
  'Use "reported" when the author relays someone else\'s claim. ' +
  'Set "when_iso" to an ISO date only if the post states one, else null.';

export async function extractFactsAI(
  config: StorytimeConfig,
  text: string,
  postedAt: string,
): Promise<ExtractedFact[]> {
  try {
    const res = await fetch(`${config.ai.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.ai.model,
        stream: false,
        format: SCHEMA,
        options: { temperature: 0 },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `Posted at: ${postedAt}\n---\n${text.slice(0, 4000)}` },
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { message?: { content?: string } };
    const parsed = JSON.parse(data.message?.content ?? '{"facts":[]}') as { facts?: any[] };
    const facts = Array.isArray(parsed.facts) ? parsed.facts : [];
    return facts
      .filter((f) => f && typeof f.quote === 'string' && text.includes(f.quote)) // quote check
      .map((f) => normalize(f, postedAt))
      .filter((f): f is ExtractedFact => f !== null);
  } catch {
    return [];
  }
}

function normalize(f: any, postedAt: string): ExtractedFact | null {
  if (!f.subject || !f.predicate) return null;
  const whenIso = typeof f.when_iso === 'string' && DateTime.fromISO(f.when_iso).isValid ? DateTime.fromISO(f.when_iso).toISO()! : null;
  return {
    subject: String(f.subject).slice(0, 120),
    subjectKind: f.subject_kind ?? 'topic',
    predicate: f.predicate,
    object: f.object != null ? String(f.object).slice(0, 200) : null,
    objectKind: f.object_kind ?? null,
    validFrom: whenIso ?? postedAt,
    stance: f.stance ?? 'asserted',
    quote: String(f.quote).slice(0, 200),
    confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0.5)),
  };
}
