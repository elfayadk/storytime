/**
 * Hero illustration: scattered public sources on the left flowing along thin
 * connectors into a single vertical timeline on the right. States the whole
 * product in one image. Decorative, so hidden from assistive tech.
 * Colors come from CSS classes so both themes resolve correctly.
 */
const SOURCES = [
  { x: 40, y: 70 },
  { x: 96, y: 150 },
  { x: 30, y: 232 },
  { x: 110, y: 300 },
  { x: 54, y: 372 },
  { x: 140, y: 108 },
  { x: 150, y: 210 },
  { x: 128, y: 400 },
];
const RAIL_X = 360;
const RAIL = [64, 118, 172, 226, 280, 334, 388];

export function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 420 440" fill="none" aria-hidden preserveAspectRatio="xMidYMid meet">
      {SOURCES.map((s, i) => {
        const ry = RAIL[i % RAIL.length];
        const cx = (s.x + RAIL_X) / 2;
        const hot = i % 3 === 0;
        return (
          <path
            key={i}
            className={`link${hot ? ' hot' : ''}`}
            d={`M ${s.x} ${s.y} C ${cx} ${s.y}, ${cx} ${ry}, ${RAIL_X} ${ry}`}
            strokeWidth="1"
          />
        );
      })}

      <line className="rail" x1={RAIL_X} y1="48" x2={RAIL_X} y2="404" strokeWidth="1.5" />
      {RAIL.map((y, i) => (
        <circle key={y} className={`dot${i === 3 ? ' hot' : ''}`} cx={RAIL_X} cy={y} r={i === 3 ? 6 : 4} strokeWidth="1.5" />
      ))}

      {SOURCES.map((s, i) => (
        <g key={`s${i}`}>
          <circle className="snode" cx={s.x} cy={s.y} r="9" strokeWidth="1" />
          <circle className={`score${i % 3 === 0 ? ' hot' : ''}`} cx={s.x} cy={s.y} r="2.4" />
        </g>
      ))}
    </svg>
  );
}
