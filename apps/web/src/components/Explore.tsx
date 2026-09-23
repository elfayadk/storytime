import { useState } from 'react';
import { askTimeline, searchTimeline } from '../api';
import { PLATFORM_META, type AskResponse, type Platform, type SearchHit } from '../types';

function Hit({ hit }: { hit: SearchHit }) {
  return (
    <div className="hit">
      <div className="score">{Math.round(hit.score * 100)}%</div>
      <div>
        <a className="h-title" href={hit.event.url} target="_blank" rel="noopener">
          {PLATFORM_META[hit.event.platform as Platform]?.icon} {hit.event.title}
        </a>
        {hit.event.content ? <div className="h-body">{hit.event.content.slice(0, 160)}</div> : null}
      </div>
    </div>
  );
}

export function Explore({ timelineId }: { timelineId: string }) {
  const [tab, setTab] = useState<'search' | 'ask'>('search');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [ask, setAsk] = useState<AskResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const run = async () => {
    if (!q.trim() || busy) return;
    setBusy(true);
    setErr(null);
    setHits(null);
    setAsk(null);
    try {
      if (tab === 'search') setHits(await searchTimeline(timelineId, q.trim(), 10));
      else setAsk(await askTimeline(timelineId, q.trim()));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="panel">
      <h2 className="section-title">Explore by meaning</h2>
      <div className="tabs">
        <button data-on={tab === 'search'} onClick={() => setTab('search')}>Search</button>
        <button data-on={tab === 'ask'} onClick={() => setTab('ask')}>Ask</button>
      </div>
      <div className="field">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder={tab === 'search' ? 'Find posts about a topic, in your own words' : 'Ask a question about this account'}
        />
        <button className="btn btn-primary" onClick={run} disabled={busy || !q.trim()}>
          {busy ? 'Working' : tab === 'search' ? 'Search' : 'Ask'}
        </button>
      </div>

      {err ? <div className="error" style={{ marginTop: 14 }}>{err}</div> : null}

      {hits ? (
        <div style={{ marginTop: 14 }}>
          {hits.length === 0 ? <div className="note">No matches for that.</div> : hits.map((h) => <Hit key={h.event.id} hit={h} />)}
        </div>
      ) : null}

      {ask ? (
        <div style={{ marginTop: 14 }}>
          {ask.answer ? <div className="answer">{ask.answer}</div> : <div className="note">{ask.note}</div>}
          <div className="section-title" style={{ marginBottom: 6 }}>Sources</div>
          {ask.sources.map((h) => (
            <Hit key={h.event.id} hit={h} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
