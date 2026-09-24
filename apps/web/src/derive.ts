import type { SerializedEvent, Stats } from './types';

export interface DateRange {
  from?: string; // yyyy-mm-dd
  to?: string; // yyyy-mm-dd
}

export function inRange(iso: string, range: DateRange): boolean {
  const day = iso.slice(0, 10);
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

export function filterByRange(events: SerializedEvent[], range: DateRange): SerializedEvent[] {
  if (!range.from && !range.to) return events;
  return events.filter((e) => inRange(e.timestamp, range));
}

/** Recompute the simple aggregate stats over a filtered event set. */
export function recomputeStats(events: SerializedEvent[], base: Stats): Stats {
  const byPlatform: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  const sentiment = { positive: 0, negative: 0, neutral: 0 };
  const topicCounts = new Map<string, number>();
  let start: string | null = null;
  let end: string | null = null;

  for (const e of events) {
    byPlatform[e.platform] = (byPlatform[e.platform] ?? 0) + 1;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
    const day = e.timestamp.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + 1;
    if (e.sentiment) sentiment[e.sentiment.label]++;
    if (!start || e.timestamp < start) start = e.timestamp;
    if (!end || e.timestamp > end) end = e.timestamp;
    for (const t of e.topics ?? []) topicCounts.set(t, (topicCounts.get(t) ?? 0) + 1);
  }

  const topTopics = [...topicCounts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return {
    totalEvents: events.length,
    byPlatform,
    byCategory,
    byDay,
    sentiment,
    topEntities: base.topEntities,
    topTopics: topTopics.length ? topTopics : base.topTopics,
    dateRange: { start, end },
  };
}

/** Full inclusive day bounds of an event set, as yyyy-mm-dd. */
export function bounds(events: SerializedEvent[]): { min: string; max: string } | null {
  if (events.length === 0) return null;
  let min = events[0].timestamp.slice(0, 10);
  let max = min;
  for (const e of events) {
    const d = e.timestamp.slice(0, 10);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return { min, max };
}
