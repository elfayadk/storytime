import { useEffect, useMemo, useRef, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { buildTimelineSync } from '../api';
import { PLATFORM_META, type Platform, type TimelineResult } from '../types';

const COMPARE_PLATFORMS: Platform[] = ['github', 'gitlab', 'mastodon', 'bluesky', 'hackernews', 'devto', 'npm'];
const A_COLOR = '#f0b24a';
const B_COLOR = '#63b8c9';

function metrics(r: TimelineResult) {
  const primary = Object.entries(r.stats.byPlatform).sort((a, b) => b[1] - a[1])[0];
  const s = r.stats.sentiment;
  return {
    events: r.stats.totalEvents,
    hours: r.rhythm ? `${pad(r.rhythm.activeWindow.startHour)} to ${pad(r.rhythm.activeWindow.endHour)}` : 'n/a',
    primary: primary ? PLATFORM_META[primary[0] as Platform]?.label ?? primary[0] : 'n/a',
    tone: s.positive === s.negative ? 'even' : s.positive > s.negative ? 'positive' : 'critical',
    theme: r.clusters?.[0]?.label ?? r.stats.topTopics[0]?.topic ?? 'n/a',
    span:
      r.stats.dateRange.start && r.stats.dateRange.end
        ? `${r.stats.dateRange.start.slice(0, 10)} to ${r.stats.dateRange.end.slice(0, 10)}`
        : 'n/a',
    followers: r.profile?.followers,
  };
}
function pad(n: number) {
  return `${String(n).padStart(2, '0')}:00`;
}

function Head({ r, color }: { r: TimelineResult; color: string }) {
  return (
    <div className="cmp-head">
      {r.profile?.avatarUrl ? <img className="cmp-av" src={r.profile.avatarUrl} alt="" /> : <span className="cmp-dot" style={{ background: color }} />}
      <div>
        <div className="cmp-name">{r.profile?.displayName ?? r.target}</div>
        {r.profile ? <div className="cmp-sub">{r.profile.followers != null ? `${r.profile.followers} followers` : ''}{r.profile.repos != null ? ` · ${r.profile.repos} repos` : ''}</div> : null}
      </div>
    </div>
  );
}

export function Compare({
  aiAvailable,
  initialA,
  initialB,
}: {
  aiAvailable: boolean;
  initialA?: string;
  initialB?: string;
}) {
  const [a, setA] = useState(initialA ?? '');
  const [b, setB] = useState(initialB ?? '');
  const [ai, setAi] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ra, setRa] = useState<TimelineResult | null>(null);
  const [rb, setRb] = useState<TimelineResult | null>(null);
  const ran = useRef(false);

  const run = async () => {
    if (!a.trim() || !b.trim() || busy) return;
    setBusy(true);
    setErr(null);
    setRa(null);
    setRb(null);
    try {
      const [x, y] = await Promise.all([
        buildTimelineSync({ target: a.trim(), platforms: COMPARE_PLATFORMS, limit: 50, ai }),
        buildTimelineSync({ target: b.trim(), platforms: COMPARE_PLATFORMS, limit: 50, ai }),
      ]);
      setRa(x);
      setRb(y);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!ran.current && initialA && initialB) {
      ran.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartData = useMemo(() => {
    if (!ra || !rb) return [];
    const days = [...new Set([...Object.keys(ra.stats.byDay), ...Object.keys(rb.stats.byDay)])].sort();
    if (days.length === 0) return [];
    // Trim to the trailing 90 days so old outlier dates do not flatten the chart.
    const maxDay = days[days.length - 1];
    const cutoff = new Date(new Date(maxDay).getTime() - 90 * 86400000).toISOString().slice(0, 10);
    return days
      .filter((d) => d >= cutoff)
      .map((d) => ({ day: d.slice(5), a: ra.stats.byDay[d] ?? 0, b: rb.stats.byDay[d] ?? 0 }));
  }, [ra, rb]);

  const ma = ra ? metrics(ra) : null;
  const mb = rb ? metrics(rb) : null;
  const rows: { label: string; a: string | number; b: string | number }[] =
    ma && mb
      ? [
          { label: 'events', a: ma.events, b: mb.events },
          { label: 'active hours', a: ma.hours, b: mb.hours },
          { label: 'primary platform', a: ma.primary, b: mb.primary },
          { label: 'overall tone', a: ma.tone, b: mb.tone },
          { label: 'leading theme', a: ma.theme, b: mb.theme },
          { label: 'span', a: ma.span, b: mb.span },
        ]
      : [];

  return (
    <div style={{ padding: '24px 0 60px' }}>
      <div className="cmp-inputs">
        <div className="field">
          <input value={a} onChange={(e) => setA(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="First account" aria-label="First account" />
        </div>
        <span className="cmp-vs">vs</span>
        <div className="field">
          <input value={b} onChange={(e) => setB(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} placeholder="Second account" aria-label="Second account" />
        </div>
        <button className="btn btn-primary" onClick={run} disabled={busy || !a.trim() || !b.trim()}>
          {busy ? 'Comparing' : 'Compare'}
        </button>
      </div>
      <div className="pills" style={{ marginTop: 12 }}>
        <button className="pill" data-on={ai} aria-disabled={!aiAvailable} onClick={() => aiAvailable && setAi((v) => !v)}>
          <span className="dotmark" /> Local AI
        </button>
        <span className="tag" style={{ alignSelf: 'center' }}>comparing across GitHub, GitLab, Mastodon, Bluesky, Hacker News, Dev.to, npm</span>
      </div>

      {err ? <div className="error" style={{ marginTop: 20 }}>{err}</div> : null}
      {busy ? (
        <div className="progress" style={{ marginTop: 20 }}>
          <div className="bar"><span /></div>
          <div className="msg">Tracing both accounts</div>
        </div>
      ) : null}

      {ra && rb ? (
        <div className="stack" style={{ paddingTop: 24 }}>
          <div className="cmp-grid">
            <Head r={ra} color={A_COLOR} />
            <Head r={rb} color={B_COLOR} />
          </div>

          <section className="panel">
            <div className="cmp-rows">
              {rows.map((row) => (
                <div className="cmp-row" key={row.label}>
                  <span className="cmp-a">{row.a}</span>
                  <span className="cmp-lbl">{row.label}</span>
                  <span className="cmp-b">{row.b}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h2 className="section-title">
              Activity over time
              <span style={{ color: A_COLOR, fontFamily: 'var(--mono)', fontSize: 12, marginLeft: 8 }}>{ra.target}</span>
              <span style={{ color: B_COLOR, fontFamily: 'var(--mono)', fontSize: 12, marginLeft: 8 }}>{rb.target}</span>
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 6, right: 6, left: 2, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8390a6' }} tickLine={false} axisLine={{ stroke: 'rgba(226,232,240,0.12)' }} minTickGap={24} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#8390a6' }} tickLine={false} axisLine={false} width={30} />
                <Tooltip contentStyle={{ background: 'var(--raised)', border: '1px solid var(--line-strong)', borderRadius: 8, fontSize: 12 }} labelStyle={{ color: 'var(--muted)' }} />
                <Line type="monotone" dataKey="a" name={ra.target} stroke={A_COLOR} strokeWidth={1.7} dot={false} />
                <Line type="monotone" dataKey="b" name={rb.target} stroke={B_COLOR} strokeWidth={1.7} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </section>

          <div className="cmp-grid">
            <ThemeList r={ra} />
            <ThemeList r={rb} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ThemeList({ r }: { r: TimelineResult }) {
  return (
    <section className="panel">
      <h2 className="section-title">{r.target}: themes</h2>
      {(r.clusters ?? []).slice(0, 6).map((c) => (
        <div className="finding" key={c.id}>
          <div className="count">{c.size}</div>
          <div className="body">
            <b>{c.label}</b>
          </div>
        </div>
      ))}
      {(r.clusters ?? []).length === 0 ? <div className="note">No themes.</div> : null}
    </section>
  );
}
