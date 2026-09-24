import { useEffect, useRef, useState } from 'react';
import { openLive } from '../api';
import type { SerializedEvent } from '../types';

export function LivePanel({ initialTarget }: { initialTarget: string }) {
  const [target, setTarget] = useState(initialTarget);
  const [live, setLive] = useState(false);
  const [status, setStatus] = useState<string>('idle');
  const [events, setEvents] = useState<SerializedEvent[]>([]);
  const [count, setCount] = useState(0);
  const stopRef = useRef<(() => void) | null>(null);

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
    setLive(false);
    setStatus('idle');
  };

  const start = () => {
    if (!target.trim()) return;
    setEvents([]);
    setCount(0);
    setLive(true);
    setStatus('connecting');
    stopRef.current = openLive(
      target.trim(),
      (e) => {
        setEvents((cur) => [e, ...cur].slice(0, 50));
        setCount((c) => c + 1);
      },
      setStatus,
    );
  };

  useEffect(() => () => stopRef.current?.(), []);

  return (
    <section className="panel">
      <h2 className="section-title">
        <span className={`livedot ${live ? 'on' : ''}`} /> Live monitor
        {live ? <span className="livecount">{count} received</span> : null}
      </h2>
      <div className="field" style={{ marginBottom: live ? 14 : 0 }}>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (live ? stop() : start())}
          placeholder="A Bluesky handle or #hashtag to watch in real time"
          disabled={live}
        />
        <button className={`btn ${live ? '' : 'btn-primary'}`} onClick={live ? stop : start} disabled={!target.trim()}>
          {live ? 'Stop' : 'Go live'}
        </button>
      </div>

      {live ? (
        <div>
          <div className="note" style={{ marginBottom: 8 }}>
            {status === 'connected' || status === 'connecting'
              ? 'Watching the Bluesky firehose. New matching posts appear here as they are published.'
              : `stream: ${status}`}
          </div>
          {events.length === 0 ? (
            <div className="center-note" style={{ padding: '18px 0' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>waiting for the next matching post</span>
            </div>
          ) : (
            <div className="rail">
              {events.map((e) => (
                <article className="rail-entry" key={e.id} data-mood="neutral">
                  <span className="node livenode" />
                  <div className="entry-head">
                    <span className="entry-time">{new Date(e.timestamp).toLocaleTimeString()}</span>
                    <span className="entry-plat">@{e.username}</span>
                  </div>
                  <a className="entry-title" href={e.url} target="_blank" rel="noopener">
                    {e.title}
                  </a>
                  {e.content && e.content !== e.title ? <p className="entry-body">{e.content.slice(0, 280)}</p> : null}
                </article>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="note" style={{ marginTop: 10 }}>
          Tail Bluesky in real time. Watch this account, or type a hashtag like #news to see live activity.
        </div>
      )}
    </section>
  );
}
