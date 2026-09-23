/** A compact activity sparkline drawn from the per-day counts. */
export function Sparkline({ byDay }: { byDay: Record<string, number> }) {
  const days = Object.keys(byDay).sort();
  if (days.length < 2) return null;
  const values = days.map((d) => byDay[d]);
  const max = Math.max(...values, 1);
  const W = 800;
  const H = 64;
  const step = W / (values.length - 1);

  const pts = values.map((v, i) => [i * step, H - (v / max) * (H - 8) - 4]);
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${W} ${H} L0 ${H} Z`;

  return (
    <svg className="sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--signal)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--signal)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkFill)" />
      <path d={line} fill="none" stroke="var(--signal)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
