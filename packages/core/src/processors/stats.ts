import type { EntityType, TimelineEvent, TimelineStats } from '../types.js';

/** Compute aggregate statistics over enriched events. */
export function computeStats(
  events: TimelineEvent[],
  topTopics: { topic: string; count: number }[],
): TimelineStats {
  const byPlatform: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  const sentiment = { positive: 0, negative: 0, neutral: 0 };
  const entityCounts = new Map<string, { value: string; type: EntityType; count: number }>();

  let start: string | null = null;
  let end: string | null = null;

  for (const e of events) {
    byPlatform[e.platform] = (byPlatform[e.platform] ?? 0) + 1;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;

    const day = e.timestamp.toISODate();
    if (day) byDay[day] = (byDay[day] ?? 0) + 1;

    if (e.sentiment) sentiment[e.sentiment.label]++;

    const iso = e.timestamp.toISO();
    if (iso) {
      if (!start || iso < start) start = iso;
      if (!end || iso > end) end = iso;
    }

    for (const ent of e.entities ?? []) {
      if (ent.type === 'url' || ent.type === 'email') continue;
      const key = `${ent.type}:${ent.value.toLowerCase()}`;
      const cur = entityCounts.get(key);
      if (cur) cur.count++;
      else entityCounts.set(key, { value: ent.value, type: ent.type, count: 1 });
    }
  }

  const topEntities = [...entityCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  return {
    totalEvents: events.length,
    byPlatform,
    byCategory,
    byDay,
    sentiment,
    topEntities,
    topTopics,
    dateRange: { start, end },
  };
}
