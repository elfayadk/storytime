import { PLATFORM_META, type Platform, type TimelineResult } from '../types';

export function Signals({ result }: { result: TimelineResult }) {
  const { stats, rhythm, clusters } = result;
  const primary = Object.entries(stats.byPlatform).sort((a, b) => b[1] - a[1])[0];
  const window = rhythm ? `${pad(rhythm.activeWindow.startHour)} to ${pad(rhythm.activeWindow.endHour)}` : 'n/a';
  const topTheme = clusters?.[0]?.label ?? stats.topTopics[0]?.topic ?? 'n/a';

  return (
    <div className="signals">
      <div className="signal">
        <div className="num">{stats.totalEvents}</div>
        <div className="lbl">events across {Object.keys(stats.byPlatform).length} platforms</div>
      </div>
      <div className="signal">
        <div className="num sm">{window}</div>
        <div className="lbl">most active hours</div>
      </div>
      <div className="signal">
        <div className="num sm">
          {primary ? `${PLATFORM_META[primary[0] as Platform]?.label}` : 'n/a'}
        </div>
        <div className="lbl">primary platform</div>
      </div>
      <div className="signal">
        <div className="num sm">{topTheme}</div>
        <div className="lbl">leading theme</div>
      </div>
    </div>
  );
}

function pad(n: number): string {
  return `${String(n).padStart(2, '0')}:00`;
}
