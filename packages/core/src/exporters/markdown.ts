import type { TimelineResult } from '../types.js';

const EMOJI: Record<string, string> = { positive: '🟢', negative: '🔴', neutral: '⚪' };
const PLATFORM_ICON: Record<string, string> = {
  github: '💻',
  reddit: '👽',
  rss: '📰',
  mastodon: '🐘',
  bluesky: '🦋',
  pastebin: '📋',
};

export function toMarkdown(result: TimelineResult): string {
  const { target, stats, events, narrative } = result;
  const lines: string[] = [];
  lines.push(`# Activity Timeline - ${target}`);
  lines.push('');
  lines.push(`_Generated ${result.generatedAt} · ${stats.totalEvents} events_`);
  lines.push('');

  if (narrative) {
    lines.push('## Summary');
    lines.push('');
    lines.push(narrative);
    lines.push('');
  }

  lines.push('## Overview');
  lines.push('');
  lines.push(
    `- **Platforms:** ${Object.entries(stats.byPlatform).map(([p, n]) => `${PLATFORM_ICON[p] ?? ''} ${p} (${n})`).join(', ')}`,
  );
  lines.push(
    `- **Sentiment:** 🟢 ${stats.sentiment.positive} · ⚪ ${stats.sentiment.neutral} · 🔴 ${stats.sentiment.negative}`,
  );
  if (stats.topTopics.length) {
    lines.push(`- **Top topics:** ${stats.topTopics.slice(0, 8).map((t) => `\`${t.topic}\``).join(', ')}`);
  }
  if (stats.dateRange.start) {
    lines.push(`- **Range:** ${stats.dateRange.start} → ${stats.dateRange.end}`);
  }
  if (result.embeddingProvider) {
    lines.push(`- **Semantic engine:** ${result.embeddingProvider}`);
  }
  lines.push('');

  if (result.clusters?.length) {
    lines.push('## Themes');
    lines.push('');
    for (const c of result.clusters.slice(0, 8)) {
      lines.push(`- **${c.label}** - ${c.size} events${c.summary ? `: ${c.summary}` : ''}`);
    }
    lines.push('');
  }

  if (result.insights?.length) {
    lines.push('## Notable moments');
    lines.push('');
    for (const i of result.insights.slice(0, 8)) {
      const icon = i.type === 'burst' ? '📈' : i.type === 'sentiment_shift' ? '💬' : '🔕';
      lines.push(`- ${icon} **${i.date}** - ${i.detail}`);
    }
    lines.push('');
  }

  lines.push('## Timeline');
  lines.push('');
  let lastDay = '';
  for (const e of events) {
    const day = e.timestamp.toISODate() ?? '';
    if (day !== lastDay) {
      lines.push(`### ${day}`);
      lines.push('');
      lastDay = day;
    }
    const icon = PLATFORM_ICON[e.platform] ?? '•';
    const mood = e.sentiment ? EMOJI[e.sentiment.label] : '';
    const time = e.timestamp.toFormat('HH:mm');
    lines.push(`- **${time}** ${icon} ${mood} [${e.title}](${e.url})`);
    if (e.summary) lines.push(`  - _${e.summary}_`);
    else if (e.content) lines.push(`  - ${e.content.replace(/\s+/g, ' ').slice(0, 200)}`);
    if (e.topics?.length) lines.push(`  - topics: ${e.topics.map((t) => `\`${t}\``).join(', ')}`);
    lines.push('');
  }

  return lines.join('\n');
}
