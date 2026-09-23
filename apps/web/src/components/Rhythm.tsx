import type { ActivityRhythm } from '../types';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Rhythm({ rhythm }: { rhythm: ActivityRhythm }) {
  if (!rhythm || rhythm.total === 0) return null;
  const max = Math.max(1, ...rhythm.grid.flat());

  return (
    <section className="panel">
      <h2 className="section-title">Activity rhythm</h2>
      <div className="heat">
        <div className="heat-rowlabels">
          {DOW.map((d) => (
            <div className="heat-rowlabel" key={d}>
              {d}
            </div>
          ))}
        </div>
        <div className="heat-grid">
          {rhythm.grid.map((row, d) => (
            <div className="heat-row" key={d}>
              {row.map((count, h) => {
                const intensity = count === 0 ? 0 : 0.14 + (count / max) * 0.86;
                return (
                  <div
                    key={h}
                    className="heat-cell"
                    style={{ opacity: intensity }}
                    title={`${DOW[d]} ${String(h).padStart(2, '0')}:00 - ${count} event${count === 1 ? '' : 's'}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="heat-axis">
        {Array.from({ length: 24 }, (_, h) => (
          <span key={h}>{h % 6 === 0 ? h : ''}</span>
        ))}
      </div>
      <div className="meta" style={{ marginTop: 12, color: 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 12 }}>
        {rhythm.summary}
      </div>
    </section>
  );
}
