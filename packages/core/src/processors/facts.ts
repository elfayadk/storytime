/**
 * Extract bi-temporal facts from events. Rule-based signals always run (no AI
 * needed); when a local model is available, it also reads free-text posts for
 * additional facts. Each fact carries validity (valid_from/valid_to), a
 * confidence, a stance, and the events that evidence it.
 */
import { DateTime } from 'luxon';
import type { StorytimeConfig } from '../config.js';
import type { Logger } from '../util/logger.js';
import type { Fact, TimelineEvent } from '../types.js';
import { extractFactsAI } from '../ai/extract.js';

const FUNCTIONAL = new Set(['located_in', 'role', 'works_on_primary']);

export async function buildFacts(
  events: TimelineEvent[],
  config: StorytimeConfig,
  logger: Logger,
  useAI: boolean,
): Promise<Fact[]> {
  const now = DateTime.now().toISO()!;
  const byKey = new Map<string, Fact>();

  const add = (f: Omit<Fact, 'id' | 'ingestedAt'> & { id?: string }) => {
    const key = `${f.subject.toLowerCase()}|${f.predicate}|${(f.object ?? '').toLowerCase()}`;
    const existing = byKey.get(key);
    if (existing) {
      for (const ev of f.evidence) if (!existing.evidence.some((e) => e.eventId === ev.eventId)) existing.evidence.push(ev);
      if (f.validFrom < existing.validFrom) existing.validFrom = f.validFrom;
      return;
    }
    byKey.set(key, { id: f.id ?? `fact:${byKey.size}`, ingestedAt: now, ...f });
  };

  // Rule-based facts from structured platform signals.
  for (const e of events) {
    const ts = e.timestamp.toISO()!;
    const ev = [{ eventId: e.id, url: e.url }];
    const repo = String((e.metadata as any)?.repo ?? '');
    switch (e.platform) {
      case 'github':
      case 'gitlab':
        if (repo && (e.category === 'code_push' || e.category === 'code_pr' || e.category === 'code_issue' || e.category === 'code_create')) {
          add({ subject: e.username, subjectKind: 'person', predicate: 'works_on', object: repo, objectKind: 'project', validFrom: ts, confidence: 0.9, stance: 'asserted', extractor: 'rule', evidence: ev });
        }
        break;
      case 'npm':
        add({ subject: e.username, subjectKind: 'person', predicate: 'released', object: e.title.replace(/^Published /, ''), objectKind: 'project', validFrom: ts, confidence: 0.95, stance: 'asserted', extractor: 'rule', evidence: ev });
        break;
      case 'devto':
      case 'medium':
      case 'rss':
        add({ subject: e.username, subjectKind: 'person', predicate: 'wrote', object: e.title, objectKind: 'topic', validFrom: ts, confidence: 0.9, stance: 'asserted', extractor: 'rule', evidence: ev });
        break;
      case 'stackexchange':
        add({ subject: e.username, subjectKind: 'person', predicate: 'answered_on', object: (e.metadata as any)?.site ?? 'stackoverflow', objectKind: 'topic', validFrom: ts, confidence: 0.8, stance: 'asserted', extractor: 'rule', evidence: ev });
        break;
      case 'wikipedia':
        add({ subject: e.username, subjectKind: 'person', predicate: 'edited', object: e.title.replace(/^Edited "?/, '').replace(/".*$/, ''), objectKind: 'topic', validFrom: ts, confidence: 0.85, stance: 'asserted', extractor: 'rule', evidence: ev });
        break;
    }
    // Place mentions become location facts (mentions only, low confidence).
    for (const ent of e.entities ?? []) {
      if (ent.type === 'place') {
        add({ subject: e.username, subjectKind: 'person', predicate: 'mentioned_place', object: ent.value, objectKind: 'place', validFrom: ts, confidence: 0.4, stance: 'asserted', extractor: 'rule', evidence: ev });
      }
    }
  }

  // Optional local-LLM extraction over post text.
  if (useAI) {
    const posts = events.filter((e) => (e.category === 'post' || e.category === 'comment' || e.category === 'article') && e.content.length > 30).slice(0, 40);
    for (const e of posts) {
      const extracted = await extractFactsAI(config, e.content, e.timestamp.toISO()!).catch(() => null);
      if (!extracted) continue;
      for (const f of extracted) {
        add({
          subject: f.subject || e.username,
          subjectKind: f.subjectKind,
          predicate: f.predicate,
          object: f.object ?? undefined,
          objectKind: f.objectKind ?? undefined,
          validFrom: f.validFrom ?? e.timestamp.toISO()!,
          validTo: f.validTo,
          confidence: f.confidence,
          stance: f.stance,
          extractor: `ollama:${config.ai.model}`,
          evidence: [{ eventId: e.id, url: e.url, quote: f.quote }],
        });
      }
    }
    logger.info(`facts: AI extraction over ${posts.length} posts`);
  }

  const facts = [...byKey.values()];
  settleFunctional(facts);
  return facts.sort((a, b) => b.validFrom.localeCompare(a.validFrom));
}

/** For functional predicates, a newer value ends the previous one's validity. */
function settleFunctional(facts: Fact[]): void {
  const groups = new Map<string, Fact[]>();
  for (const f of facts) {
    if (!FUNCTIONAL.has(f.predicate)) continue;
    const k = `${f.subject.toLowerCase()}|${f.predicate}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(f);
  }
  for (const g of groups.values()) {
    g.sort((a, b) => a.validFrom.localeCompare(b.validFrom));
    for (let i = 0; i < g.length - 1; i++) if (!g[i].validTo) g[i].validTo = g[i + 1].validFrom;
  }
}
