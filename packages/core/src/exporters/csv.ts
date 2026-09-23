import type { TimelineResult } from '../types.js';

const COLUMNS = [
  'timestamp',
  'platform',
  'category',
  'username',
  'title',
  'content',
  'url',
  'sentiment',
  'sentimentScore',
  'topics',
  'entities',
  'location',
] as const;

function esc(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCSV(result: TimelineResult): string {
  const rows = [COLUMNS.join(',')];
  for (const e of result.events) {
    rows.push(
      [
        e.timestamp.toISO() ?? '',
        e.platform,
        e.category,
        e.username,
        e.title,
        e.content.replace(/\s+/g, ' ').slice(0, 500),
        e.url,
        e.sentiment?.label ?? '',
        e.sentiment?.score ?? '',
        (e.topics ?? []).join('|'),
        (e.entities ?? []).map((x) => `${x.type}:${x.value}`).join('|'),
        e.location ? `${e.location.lat},${e.location.lng}` : '',
      ]
        .map(esc)
        .join(','),
    );
  }
  return rows.join('\n');
}
