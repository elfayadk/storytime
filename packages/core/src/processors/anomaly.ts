/**
 * Temporal anomaly detection: activity regime changes (Bayesian online
 * change-point detection over a dense daily series), single-day spikes, and
 * sentiment change-points. Deterministic, no ML.
 */
import { DateTime } from 'luxon';
import { bocpd } from './bocpd.js';
import type { Insight, TimelineEvent } from '../types.js';
export type { Insight };

export function detectAnomalies(events: TimelineEvent[]): Insight[] {
  if (events.length < 6) return [];
  const insights: Insight[] = [];
  const seenDates = new Set<string>();

  // Group by ISO day.
  const days = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const d = e.timestamp.toISODate();
    if (!d) continue;
    (days.get(d) ?? days.set(d, []).get(d)!).push(e);
  }
  const dayKeys = [...days.keys()].sort();
  if (dayKeys.length < 2) return [];

  // Dense daily counts from first to last active day (fill gaps with 0).
  const start = DateTime.fromISO(dayKeys[0]);
  const end = DateTime.fromISO(dayKeys[dayKeys.length - 1]);
  const span = Math.min(Math.round(end.diff(start, 'days').days) + 1, 730);
  const denseDates: string[] = [];
  const denseCounts: number[] = [];
  for (let i = 0; i < span; i++) {
    const d = start.plus({ days: i }).toISODate()!;
    denseDates.push(d);
    denseCounts.push(days.get(d)?.length ?? 0);
  }
  const baseline = denseCounts.reduce((a, b) => a + b, 0) / denseCounts.length;

  // BOCPD regime changes.
  for (const cp of bocpd(denseCounts)) {
    const date = denseDates[Math.min(cp.index, denseDates.length - 1)];
    if (!date || seenDates.has(date)) continue;
    seenDates.add(date);
    const c = denseCounts[cp.index] ?? 0;
    insights.push({
      type: 'burst',
      date,
      score: cp.confidence,
      detail: `Activity shifted around this day (${c} events vs a ${baseline.toFixed(1)}/day baseline, ${(cp.confidence * 100).toFixed(0)}% confidence)`,
    });
  }

  // Single-day spikes the change-point model may smooth over.
  const mean = avg(denseCounts);
  const sd = stddev(denseCounts, mean);
  if (sd > 0) {
    denseDates.forEach((d, i) => {
      const z = (denseCounts[i] - mean) / sd;
      if (z >= 2.0 && denseCounts[i] >= 3 && !seenDates.has(d)) {
        seenDates.add(d);
        insights.push({
          type: 'burst',
          date: d,
          score: Number(z.toFixed(2)),
          detail: `Activity spike: ${denseCounts[i]} events (${z.toFixed(1)} sigma above the ${mean.toFixed(1)}/day baseline)`,
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
        detail: `Mood ${delta > 0 ? 'lifted' : 'dropped'} sharply (${prev.toFixed(2)} to ${cur.toFixed(2)})`,
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
