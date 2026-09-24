import { useEffect, useState } from 'react';
import { SearchBar } from './components/SearchBar';
import { Dossier } from './components/Dossier';
import { Signals } from './components/Signals';
import { Rhythm } from './components/Rhythm';
import { Trends } from './components/Trends';
import { Findings } from './components/Findings';
import { Explore } from './components/Explore';
import { Timeline } from './components/Timeline';
import { MapPanel } from './components/MapPanel';
import { Graph } from './components/Graph';
import { buildTimeline, exportUrl, getHealth, type BuildParams, type Health } from './api';
import type { Progress, TimelineResult } from './types';

const FORMATS = ['md', 'json', 'csv', 'xml', 'html'];

function getInitialTheme(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem('storytime-theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    /* ignore */
  }
  return 'dark';
}

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [result, setResult] = useState<TimelineResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('storytime-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
    // Shareable deep link: /?q=torvalds auto-runs a trace on load.
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) run({ target: q, platforms: ['github', 'mastodon', 'bluesky', 'hackernews'], limit: 50 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (params: BuildParams) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress({ phase: 'ingest', message: 'Reaching out to public sources' });
    try {
      setResult(await buildTimeline(params, setProgress));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  return (
    <>
      <div className="topbar">
        <span className="wordmark">
          Storytime<span className="dot">.</span>
        </span>
        <span className="tag">public activity, one timeline</span>
        <span className="spacer" />
        {health ? (
          <span className="tag" style={{ marginRight: 4 }}>
            {health.ai.reachable ? 'local AI ready' : `v${health.version}`}
          </span>
        ) : null}
        <button className="icon-btn" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} aria-label="Toggle theme">
          {theme === 'dark' ? '◑' : '◐'}
        </button>
      </div>

      <div className="wrap">
        {!result && !loading ? (
          <section className="hero">
            <svg className="hero-motif" viewBox="0 0 900 520" fill="none" aria-hidden preserveAspectRatio="xMidYMin slice">
              {[70, 140, 210, 280, 350, 420].map((r) => (
                <circle key={r} cx="450" cy="120" r={r} stroke="var(--signal)" strokeOpacity="0.10" />
              ))}
            </svg>
            <h1>
              Trace anyone's <em>public</em> story across the open web.
            </h1>
            <p className="lede">
              Give Storytime a username or handle. It assembles that account's public activity from
              GitHub, Mastodon, Bluesky, Hacker News, Dev.to and more into a single timeline, then reads
              the patterns in it. No paid keys, nothing to sign up for.
            </p>
            <SearchBar onSubmit={run} loading={loading} aiAvailable={!!health?.ai.reachable} />
          </section>
        ) : (
          <div style={{ padding: '20px 0 4px' }}>
            <SearchBar onSubmit={run} loading={loading} aiAvailable={!!health?.ai.reachable} compact />
          </div>
        )}

        {loading ? (
          <div className="progress">
            <div className="bar">
              <span />
            </div>
            <div className="msg">{progress?.message ?? 'Working'}</div>
          </div>
        ) : null}

        {error ? <div className="error" style={{ margin: '20px 0' }}>{error}</div> : null}

        {result ? (
          <div className="stack">
            <Dossier result={result} />

            {result.narrative ? (
              <section className="panel fade-up">
                <h2 className="section-title">Brief</h2>
                <p style={{ margin: 0, lineHeight: 1.65 }}>{result.narrative}</p>
              </section>
            ) : null}

            <Signals result={result} />

            {result.id ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="tag" style={{ alignSelf: 'center', marginRight: 4 }}>Export</span>
                {FORMATS.map((f) => (
                  <a key={f} className="pill" href={exportUrl(result.id!, f)} target="_blank" rel="noopener">
                    {f}
                  </a>
                ))}
              </div>
            ) : null}

            {result.id && result.stats.totalEvents > 0 ? <Explore timelineId={result.id} /> : null}

            <Findings clusters={result.clusters} insights={result.insights} />

            {result.rhythm ? <Rhythm rhythm={result.rhythm} /> : null}

            {result.stats.totalEvents > 0 ? <Trends stats={result.stats} /> : null}

            {result.graph ? (
              <Graph nodes={result.graph.nodes} edges={result.graph.edges} subject={result.target} />
            ) : null}

            <MapPanel events={result.events} />

            <Timeline events={result.events} />
          </div>
        ) : null}

        {!result && !loading && !error ? (
          <div className="center-note" style={{ paddingTop: 20 }}>
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>
              try torvalds, Gargron@mastodon.social, or bsky.app
            </span>
          </div>
        ) : null}
      </div>
    </>
  );
}
