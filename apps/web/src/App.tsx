import { useEffect, useMemo, useState } from 'react';
import { SearchBar } from './components/SearchBar';
import { Dossier } from './components/Dossier';
import { ProfileCard } from './components/ProfileCard';
import { Signals } from './components/Signals';
import { Rhythm } from './components/Rhythm';
import { Trends } from './components/Trends';
import { Findings } from './components/Findings';
import { Explore } from './components/Explore';
import { Timeline } from './components/Timeline';
import { MapPanel } from './components/MapPanel';
import { Graph } from './components/Graph';
import { HeroArt } from './components/HeroArt';
import { DateFilter } from './components/DateFilter';
import { Compare } from './components/Compare';
import { LivePanel } from './components/LivePanel';
import { buildTimeline, exportUrl, getHealth, type BuildParams, type Health } from './api';
import { bounds, filterByRange, recomputeStats, type DateRange } from './derive';
import type { Progress, TimelineResult } from './types';

const FORMATS = ['md', 'json', 'csv', 'xml', 'html'];

function getInitialTheme(): 'dark' | 'light' {
  const param = new URLSearchParams(window.location.search).get('theme');
  if (param === 'dark' || param === 'light') return param;
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
  const [mode, setMode] = useState<'single' | 'compare'>('single');
  const [range, setRange] = useState<DateRange>({});

  const ranged = !!(range.from || range.to);
  const eventBounds = useMemo(() => (result ? bounds(result.events) : null), [result]);
  const view = useMemo<TimelineResult | null>(() => {
    if (!result) return null;
    if (!range.from && !range.to) return result;
    const events = filterByRange(result.events, range);
    return { ...result, events, stats: recomputeStats(events, result.stats) };
  }, [result, range]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('storytime-theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const compareInit = useMemo(() => {
    const c = params.get('compare');
    if (!c) return null;
    const [a, b] = c.split(',').map((s) => s.trim());
    return a && b ? { a, b } : null;
  }, [params]);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth(null));
    if (compareInit) {
      setMode('compare');
      return;
    }
    // Shareable deep link: /?q=torvalds auto-runs a trace, with optional ?from=&to= range.
    const q = params.get('q');
    if (q) {
      run({ target: q, platforms: ['github', 'mastodon', 'bluesky', 'hackernews'], limit: 50 }).then(() => {
        const from = params.get('from') || undefined;
        const to = params.get('to') || undefined;
        if (from || to) setRange({ from, to });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (params: BuildParams) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setRange({});
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
        <span className="tag hide-sm">public activity, one timeline</span>
        <span className="spacer" />
        <div className="modeswitch" style={{ marginRight: 10 }}>
          <button data-on={mode === 'single'} onClick={() => setMode('single')}>Trace</button>
          <button data-on={mode === 'compare'} onClick={() => setMode('compare')}>Compare</button>
        </div>
        {health ? (
          <span className="tag hide-sm" style={{ marginRight: 4 }}>
            {health.ai.reachable ? 'local AI ready' : `v${health.version}`}
          </span>
        ) : null}
        <button className="icon-btn" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))} aria-label="Toggle theme">
          {theme === 'dark' ? '◑' : '◐'}
        </button>
      </div>

      <div className="wrap">
        {mode === 'compare' ? (
          <Compare aiAvailable={!!health?.ai.reachable} initialA={compareInit?.a} initialB={compareInit?.b} />
        ) : (
          <>
            {!result && !loading ? (
              <section className="hero">
                <div className="hero-copy">
                  <h1>
                    Trace anyone's <em>public</em> story across the open web.
                  </h1>
                  <p className="lede">
                    Give Storytime a username or handle. It gathers that account's public activity from
                    fifteen sources into a single timeline, then reads the patterns in it. No paid keys,
                    nothing to sign up for.
                  </p>
                  <SearchBar onSubmit={run} loading={loading} aiAvailable={!!health?.ai.reachable} />
                </div>
                <HeroArt />
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

            {view ? (
              <div className="stack">
                <Dossier result={view} />

                {view.profile ? <ProfileCard profile={view.profile} /> : null}

                {view.brief || view.narrative ? (
                  <section className="panel">
                    <h2 className="section-title">Brief</h2>
                    <p style={{ margin: 0, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                      {view.brief ?? view.narrative}
                    </p>
                  </section>
                ) : null}

                <Signals result={view} />

                {eventBounds ? (
                  <DateFilter
                    range={range}
                    bounds={eventBounds}
                    onChange={setRange}
                    filtered={view.events.length}
                    total={result!.events.length}
                  />
                ) : null}

                {view.id ? (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <a className="btn btn-primary" href={exportUrl(view.id, 'dossier')} target="_blank" rel="noopener" style={{ textDecoration: 'none' }}>
                      Download dossier
                    </a>
                    <span className="tag" style={{ alignSelf: 'center', margin: '0 4px' }}>or raw data</span>
                    {FORMATS.map((f) => (
                      <a key={f} className="pill" href={exportUrl(view.id!, f)} target="_blank" rel="noopener">
                        {f}
                      </a>
                    ))}
                  </div>
                ) : null}

                {view.id && view.stats.totalEvents > 0 ? <Explore timelineId={view.id} /> : null}

                {!ranged ? <LivePanel initialTarget={view.target} /> : null}

                {/* Whole-account analytics: shown for the full trace, hidden while a date range narrows the view. */}
                {!ranged ? <Findings clusters={view.clusters} insights={view.insights} /> : null}

                {!ranged && view.rhythm ? <Rhythm rhythm={view.rhythm} /> : null}

                {view.stats.totalEvents > 0 ? <Trends stats={view.stats} /> : null}

                {!ranged && view.graph ? (
                  <Graph nodes={view.graph.nodes} edges={view.graph.edges} subject={view.target} />
                ) : null}

                <MapPanel events={view.events} />

                <Timeline events={view.events} />
              </div>
            ) : null}

            {!result && !loading && !error ? (
              <div className="center-note" style={{ paddingTop: 20 }}>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12.5 }}>
                  try torvalds, Gargron@mastodon.social, or bsky.app
                </span>
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}
