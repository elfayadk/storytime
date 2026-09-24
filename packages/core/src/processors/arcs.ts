/**
 * Story arcs: turn semantic clusters into time-ordered narrative threads. Each
 * arc spans a date range, carries its key moments, and links every moment to its
 * source event. Deterministic; an optional narrative can be layered on later.
 */
import type { ClusterSummary, StoryArc, TimelineEvent } from '../types.js';

export function buildArcs(events: TimelineEvent[], clusters: ClusterSummary[]): StoryArc[] {
  const byId = new Map(events.map((e) => [e.id, e]));

  return clusters
    .filter((c) => c.size >= 3)
    .map((c, i) => {
      const evs = c.eventIds
        .map((id) => byId.get(id))
        .filter((e): e is TimelineEvent => !!e)
        .sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
      if (evs.length < 3) return null;

      const from = evs[0].timestamp.toISODate()!;
      const to = evs[evs.length - 1].timestamp.toISODate()!;
      const keyMoments = pickSpread(evs, 5).map((e) => ({
        date: e.timestamp.toISODate()!,
        title: e.title,
        url: e.url,
      }));

      return {
        id: i,
        label: c.label,
        from,
        to,
        size: evs.length,
        eventIds: evs.map((e) => e.id),
        keyMoments,
      } as StoryArc;
    })
    .filter((a): a is StoryArc => a !== null)
    .sort((a, b) => b.size - a.size)
    .slice(0, 8);
}

/** Pick up to `n` items spread evenly across the (time-sorted) list. */
function pickSpread<T>(xs: T[], n: number): T[] {
  if (xs.length <= n) return xs;
  const step = (xs.length - 1) / (n - 1);
  const out: T[] = [];
  for (let i = 0; i < n; i++) out.push(xs[Math.round(i * step)]);
  return out;
}
