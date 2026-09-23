import natural from 'natural';
import type { TimelineEvent } from '../types.js';

const { TfIdf, WordTokenizer, stopwords } = natural;
const tokenizer = new WordTokenizer();
const STOP = new Set([...(stopwords as string[]), 'https', 'http', 'com', 'www', 'amp']);

/**
 * Corpus-level topic tagging via TF-IDF (local, free). Mutates events in place,
 * assigning each event up to `perEvent` topic keywords, and returns global top
 * topics. A lightweight stand-in for LDA that needs no model download.
 */
export function assignTopics(
  events: TimelineEvent[],
  perEvent = 3,
): { topic: string; count: number }[] {
  if (events.length === 0) return [];
  const tfidf = new TfIdf();
  const docs = events.map((e) => normalize(`${e.title} ${e.content}`));
  docs.forEach((d) => tfidf.addDocument(d));

  const globalCounts = new Map<string, number>();
  events.forEach((event, i) => {
    const terms = tfidf
      .listTerms(i)
      .filter((t) => t.term.length > 2 && !STOP.has(t.term) && !/^\d+$/.test(t.term))
      .slice(0, perEvent)
      .map((t) => t.term);
    if (terms.length) {
      event.topics = terms;
      for (const t of terms) globalCounts.set(t, (globalCounts.get(t) ?? 0) + 1);
    }
  });

  return [...globalCounts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);
}

function normalize(text: string): string {
  const tokens = (tokenizer.tokenize(text.toLowerCase()) ?? []).filter(
    (w) => w.length > 2 && !STOP.has(w),
  );
  return tokens.join(' ');
}
