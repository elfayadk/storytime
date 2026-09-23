/**
 * Activity rhythm: when an account publishes, aggregated over hour-of-day and
 * weekday. Surfaces the account's active window at a glance. Deterministic.
 */
import type { ActivityRhythm, TimelineEvent } from '../types.js';

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function computeRhythm(events: TimelineEvent[]): ActivityRhythm {
  const byHour = new Array(24).fill(0);
  const byWeekday = new Array(7).fill(0);
  const grid: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  for (const e of events) {
    const h = e.timestamp.hour;
    const d = e.timestamp.weekday % 7; // luxon: 1=Mon..7=Sun -> 0=Sun..6=Sat
    if (h >= 0 && h < 24) {
      byHour[h]++;
      grid[d][h]++;
    }
    byWeekday[d]++;
  }

  const total = events.length;
  const peakHour = argmax(byHour);
  const peakWeekday = argmax(byWeekday);
  const activeWindow = busiestWindow(byHour, 8);

  const summary = total
    ? `Most active between ${pad(activeWindow.startHour)}:00 and ${pad(activeWindow.endHour)}:00, ` +
      `peaking around ${pad(peakHour)}:00 on ${DOW[peakWeekday]}s`
    : 'No activity to profile yet';

  return { byHour, byWeekday, grid, peakHour, peakWeekday, activeWindow, summary, total };
}

/** Find the contiguous window of `len` hours (wrapping midnight) with most events. */
function busiestWindow(byHour: number[], len: number): { startHour: number; endHour: number } {
  let best = -1;
  let bestStart = 0;
  for (let start = 0; start < 24; start++) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += byHour[(start + i) % 24];
    if (sum > best) {
      best = sum;
      bestStart = start;
    }
  }
  return { startHour: bestStart, endHour: (bestStart + len) % 24 };
}

function argmax(xs: number[]): number {
  let idx = 0;
  for (let i = 1; i < xs.length; i++) if (xs[i] > xs[idx]) idx = i;
  return idx;
}
function pad(n: number): string {
  return String(n).padStart(2, '0');
}
