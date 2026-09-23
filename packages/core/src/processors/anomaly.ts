/**
 * Temporal anomaly detection over a timeline: activity bursts (z-score on daily
 * volume) and sentiment change-points. Deterministic, no ML. Surfaces the
 * "something happened here" moments a flat feed hides.
 */
import type { Insight, TimelineEvent } from '../types.js';
export type { Insight };

export function detectAnomalies(events: TimelineEvent[]): Insight[] {
  if (events.length < 6) return [];
  const insights: Insight[] = [];

  // Group by ISO day.
  const days = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const d = e.timestamp.toISODate();
    if (!d) continue;
    (days.get(d) ?? days.set(d, []).get(d)!).push(e);
  }
  const dayKeys = [...days.keys()].sort();
  const counts = dayKeys.map((d) => days.get(d)!.length);

  // Volume bursts via z-score.
  const mean = avg(counts);
  const sd = stddev(counts, mean);
  if (sd > 0) {
    dayKeys.forEach((d, i) => {
      const z = (counts[i] - mean) / sd;
      if (z >= 2 && counts[i] >= 3) {
        insights.push({
          type: 'burst',
          date: d,
          score: Number(z.toFixed(2)),
          detail: `Activity burst: ${counts[i]} events (${z.toFixed(1)}σ above the ${mean.toFixed(1)}/day baseline)`,
        });
      }
    });
  }

  // Sentiment change-points between consecutive active days.
  const daySent = dayKeys.map((d) => {
    const evs = days.get(d)!.filter((e) => e.sentiment);
    return evs.length ? avg(evs.map((e) => e.sentiment!.score)) : null;
  });
  for (let i = 1; i < dayKeys.length; i++) {
    const prev = daySent[i - 1];
    const cur = daySent[i];
    if (prev == null || cur == null) continue;
    const delta = cur - prev;
    if (Math.abs(delta) >= 0.5) {
      insights.push({
        type: 'sentiment_shift',
        date: dayKeys[i],
        score: Number(delta.toFixed(2)),
        detail: `Mood ${delta > 0 ? 'lifted' : 'dropped'} sharply (${prev.toFixed(2)} → ${cur.toFixed(2)})`,
      });
    }
  }

  return insights.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)).slice(0, 12);
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function stddev(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}
