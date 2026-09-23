import type {
  GraphEdge,
  GraphNode,
  NetworkGraph,
  TimelineEvent,
} from '../types.js';

/**
 * Build an interaction graph: nodes are users, edges are @-mentions, replies,
 * boosts/reposts and shared-entity references between the target and others.
 */
export function buildNetwork(events: TimelineEvent[]): NetworkGraph {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();

  const addNode = (id: string, platform?: TimelineEvent['platform']) => {
    if (!id) return;
    const key = id.toLowerCase();
    const existing = nodes.get(key);
    if (existing) existing.weight++;
    else nodes.set(key, { id: key, label: id, platform, weight: 1 });
  };
  const addEdge = (source: string, target: string, type: GraphEdge['type']) => {
    if (!source || !target || source.toLowerCase() === target.toLowerCase()) return;
    const s = source.toLowerCase();
    const t = target.toLowerCase();
    const key = `${s}->${t}:${type}`;
    const existing = edges.get(key);
    if (existing) existing.weight++;
    else edges.set(key, { source: s, target: t, type, weight: 1 });
  };

  for (const e of events) {
    addNode(e.username, e.platform);

    // @-mentions become mention edges.
    for (const ent of e.entities ?? []) {
      if (ent.type === 'mention') {
        addNode(ent.value);
        addEdge(e.username, ent.value, 'mention');
      }
    }
    // Reply / quote relations.
    for (const rel of e.relations ?? []) {
      const other = rel.context || rel.targetId;
      if (rel.type === 'reply_to' || rel.type === 'quote') {
        addEdge(e.username, other, rel.type);
      }
    }
    // Boost/repost author (stored in title as "Boosted @x" / "Reposted @x").
    const m = e.title.match(/(?:Boosted|Reposted)\s+@?([A-Za-z0-9_.@]+)/);
    if (m) {
      addNode(m[1]);
      addEdge(e.username, m[1], 'reference');
    }
  }

  return {
    nodes: [...nodes.values()].sort((a, b) => b.weight - a.weight),
    edges: [...edges.values()].sort((a, b) => b.weight - a.weight),
  };
}
