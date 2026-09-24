import { useMemo, useState } from 'react';
import { PLATFORM_META, type Platform, type SerializedEvent } from '../types';

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function Timeline({ events }: { events: SerializedEvent[] }) {
  const [filter, setFilter] = useState<Platform | 'all'>('all');
  const platforms = useMemo(() => [...new Set(events.map((e) => e.platform))], [events]);
  const visible = filter === 'all' ? events : events.filter((e) => e.platform === filter);

  const groups = useMemo(() => {
    const map = new Map<string, SerializedEvent[]>();
    for (const e of visible) {
      const day = e.timestamp.slice(0, 10);
      (map.get(day) ?? map.set(day, []).get(day)!).push(e);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <section>
      <h2 className="section-title">Timeline</h2>
      <div className="filters">
        <button className="pill" data-on={filter === 'all'} onClick={() => setFilter('all')}>
          All {events.length}
        </button>
        {platforms.map((p) => (
          <button className="pill" data-on={filter === p} key={p} onClick={() => setFilter(p)}>
            {PLATFORM_META[p].icon} {PLATFORM_META[p].label}
          </button>
        ))}
      </div>

      <div className="rail">
        {groups.map(([day, evs]) => (
          <div key={day}>
            <div className="rail-day">{fmtDay(evs[0].timestamp)}</div>
            {evs.map((e) => (
              <article className="rail-entry" key={e.id} data-mood={e.sentiment?.label ?? 'neutral'}>
                <span className="node">{PLATFORM_META[e.platform].icon}</span>
                <div className="entry-head">
                  <span className="entry-time">{fmtTime(e.timestamp)}</span>
                  <span className="entry-plat">{PLATFORM_META[e.platform].label}</span>
                </div>
                <h3 className="entry-title" dir="auto">
                  <a href={e.url} target="_blank" rel="noopener">
                    {e.title}
                  </a>
                </h3>
                {e.summary ? <p className="entry-sum" dir="auto">{e.summary}</p> : null}
                {e.content ? (
                  <p className="entry-body" dir="auto">
                    {e.content.slice(0, 320)}
                    {e.content.length > 320 ? '...' : ''}
                  </p>
                ) : null}
                {(e.topics?.length || e.location) ? (
                  <div className="chips">
                    {(e.topics ?? []).slice(0, 5).map((t) => (
                      <span className="chip" key={t}>
                        {t}
                      </span>
                    ))}
                    {e.location?.name ? <span className="chip x">{e.location.name}</span> : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ))}
        {visible.length === 0 ? <div className="center-note">Nothing on this filter.</div> : null}
      </div>
    </section>
  );
}
