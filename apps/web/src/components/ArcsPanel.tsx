import type { StoryArc } from '../types';

function fmt(d: string): string {
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ArcsPanel({ arcs }: { arcs: StoryArc[] }) {
  if (!arcs || arcs.length === 0) return null;
  return (
    <section className="panel">
      <h2 className="section-title">Story arcs</h2>
      {arcs.map((a) => (
        <div key={a.id} className="arc">
          <div className="arc-head">
            <span className="arc-label">{a.label}</span>
            <span className="arc-span">
              {fmt(a.from)} to {fmt(a.to)}, {a.size} events
            </span>
          </div>
          {a.narrative ? <p className="arc-narr">{a.narrative}</p> : null}
          <div className="arc-moments">
            {a.keyMoments.map((m, i) => (
              <a key={i} className="arc-moment" href={m.url} target="_blank" rel="noopener">
                <span className="arc-date">{fmt(m.date)}</span>
                <span className="arc-title">{m.title}</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
