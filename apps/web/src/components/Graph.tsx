import { useMemo, useState } from 'react';
import type { GraphEdge, GraphNode } from '../types';

/**
 * Interaction graph as a radial hub layout. The subject sits at the centre;
 * accounts they mention or reply to orbit it, sized by how often. Deterministic,
 * no physics library.
 */
export function Graph({
  nodes,
  edges,
  subject,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  subject: string;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const layout = useMemo(() => {
    if (nodes.length < 3 || edges.length === 0) return null;
    const W = 640;
    const H = 380;
    const cx = W / 2;
    const cy = H / 2;

    const subjKey = subject.toLowerCase().replace(/^@/, '');
    const hub =
      nodes.find((n) => n.id === subjKey) ??
      [...nodes].sort((a, b) => b.weight - a.weight)[0];

    const others = nodes.filter((n) => n.id !== hub.id).slice(0, 28);
    const maxW = Math.max(1, ...others.map((n) => n.weight));
    const R = Math.min(W, H) / 2 - 46;

    const pos = new Map<string, { x: number; y: number; r: number; label: string }>();
    pos.set(hub.id, { x: cx, y: cy, r: 12, label: hub.label });
    others.forEach((n, i) => {
      const a = (i / others.length) * Math.PI * 2 - Math.PI / 2;
      const ring = 0.7 + 0.3 * (1 - n.weight / maxW); // heavier nodes pulled inward
      pos.set(n.id, {
        x: cx + Math.cos(a) * R * ring,
        y: cy + Math.sin(a) * R * ring,
        r: 4 + (n.weight / maxW) * 7,
        label: n.label,
      });
    });

    const links = edges
      .filter((e) => pos.has(e.source) && pos.has(e.target))
      .slice(0, 120);

    // Only label the strongest few to avoid crowding.
    const labeled = new Set(others.slice(0, 8).map((n) => n.id));

    return { W, H, pos, links, hubId: hub.id, labeled };
  }, [nodes, edges, subject]);

  if (!layout) return null;
  const { W, H, pos, links, hubId, labeled } = layout;

  return (
    <section className="panel">
      <h2 className="section-title">Interactions</h2>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }} role="img" aria-label="interaction graph">
        {links.map((e, i) => {
          const a = pos.get(e.source)!;
          const b = pos.get(e.target)!;
          const active = hover === e.source || hover === e.target;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              style={{
                stroke: active ? 'var(--signal)' : 'rgba(226,232,240,0.10)',
                strokeWidth: active ? 1.4 : 0.8,
              }}
            />
          );
        })}
        {[...pos.entries()].map(([id, p]) => {
          const isHub = id === hubId;
          return (
            <g
              key={id}
              onMouseEnter={() => setHover(id)}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'default' }}
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={p.r}
                style={{
                  fill: isHub ? 'var(--signal)' : 'var(--raised)',
                  stroke: isHub ? 'var(--signal)' : 'rgba(226,232,240,0.25)',
                  strokeWidth: 1,
                }}
              />
              {(isHub || hover === id || labeled.has(id)) && (
                <text
                  x={p.x}
                  y={p.y - p.r - 4}
                  textAnchor="middle"
                  style={{
                    fontSize: isHub ? 13 : 10.5,
                    fontFamily: 'var(--mono)',
                    fill: isHub ? 'var(--text)' : 'var(--muted)',
                  }}
                >
                  {p.label.length > 18 ? p.label.slice(0, 17) + '…' : p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </section>
  );
}
