import type { TimelineResult } from '../types.js';

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function toXML(result: TimelineResult): string {
  const out: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  out.push(`<timeline target="${esc(result.target)}" generatedAt="${esc(result.generatedAt)}" count="${result.events.length}">`);
  for (const e of result.events) {
    out.push('  <event>');
    out.push(`    <id>${esc(e.id)}</id>`);
    out.push(`    <platform>${esc(e.platform)}</platform>`);
    out.push(`    <category>${esc(e.category)}</category>`);
    out.push(`    <timestamp>${esc(e.timestamp.toISO())}</timestamp>`);
    out.push(`    <username>${esc(e.username)}</username>`);
    out.push(`    <title>${esc(e.title)}</title>`);
    out.push(`    <content>${esc(e.content)}</content>`);
    out.push(`    <url>${esc(e.url)}</url>`);
    if (e.sentiment) out.push(`    <sentiment score="${e.sentiment.score}">${esc(e.sentiment.label)}</sentiment>`);
    if (e.topics?.length) out.push(`    <topics>${e.topics.map((t) => `<topic>${esc(t)}</topic>`).join('')}</topics>`);
    if (e.location) out.push(`    <location lat="${e.location.lat}" lng="${e.location.lng}">${esc(e.location.name)}</location>`);
    out.push('  </event>');
  }
  out.push('</timeline>');
  return out.join('\n');
}
