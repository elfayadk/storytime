import { PLATFORM_META, type Platform, type TimelineResult } from '../types';
import { Sparkline } from './Sparkline';

export function Dossier({ result }: { result: TimelineResult }) {
  const { stats } = result;
  const span =
    stats.dateRange.start && stats.dateRange.end
      ? `${fmt(stats.dateRange.start)} to ${fmt(stats.dateRange.end)}`
      : 'no dated activity';
  const platforms = Object.entries(stats.byPlatform).sort((a, b) => b[1] - a[1]);

  return (
    <header className="dossier fade-up">
      <h1 className="subject">{result.target}</h1>
      <div className="sources">
        {platforms.map(([p, n]) => (
          <span className="source-badge" key={p}>
            {PLATFORM_META[p as Platform]?.icon} {PLATFORM_META[p as Platform]?.label} <b>{n}</b>
          </span>
        ))}
      </div>
      <div className="meta">
        {stats.totalEvents} events traced, {span}
        {result.embeddingProvider ? `, semantic index: ${result.embeddingProvider}` : ''}
      </div>
      <Sparkline byDay={stats.byDay} />
    </header>
  );
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
