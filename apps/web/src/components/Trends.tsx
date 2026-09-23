import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Stats } from '../types';

const GOLD = '#f0b24a';

export function Trends({ stats }: { stats: Stats }) {
  const data = Object.entries(stats.byDay)
    .map(([day, count]) => ({ day: day.slice(5), count }))
    .sort((a, b) => a.day.localeCompare(b.day));

  const s = stats.sentiment;
  const total = Math.max(1, s.positive + s.neutral + s.negative);

  return (
    <section className="panel">
      <h2 className="section-title">Publishing trend</h2>
      <ResponsiveContainer width="100%" height={190}>
        <AreaChart data={data} margin={{ top: 6, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GOLD} stopOpacity={0.35} />
              <stop offset="100%" stopColor={GOLD} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#8390a6' }} tickLine={false} axisLine={{ stroke: 'rgba(226,232,240,0.12)' }} minTickGap={24} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#8390a6' }} tickLine={false} axisLine={false} width={34} />
          <Tooltip
            cursor={{ stroke: 'rgba(226,232,240,0.2)' }}
            contentStyle={{ background: 'var(--raised)', border: '1px solid var(--line-strong)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'var(--muted)' }}
          />
          <Area type="monotone" dataKey="count" stroke={GOLD} strokeWidth={1.6} fill="url(#trendFill)" />
        </AreaChart>
      </ResponsiveContainer>

      <div style={{ marginTop: 18 }}>
        <div className="section-title" style={{ marginBottom: 8 }}>Tone</div>
        <div style={{ display: 'flex', height: 10, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--line)' }}>
          <span style={{ width: `${(s.positive / total) * 100}%`, background: 'var(--pos)' }} />
          <span style={{ width: `${(s.neutral / total) * 100}%`, background: 'var(--neu)', opacity: 0.5 }} />
          <span style={{ width: `${(s.negative / total) * 100}%`, background: 'var(--neg)' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
          <span>positive {s.positive}</span>
          <span>neutral {s.neutral}</span>
          <span>critical {s.negative}</span>
        </div>
      </div>
    </section>
  );
}
