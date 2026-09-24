/**
 * Coordination detection (CooRnet / CooRTweet style): link accounts that perform
 * the same action within a short window, and keep pairs that repeat it. Actions
 * are shared URLs, near-identical text (SimHash bucket) or identical hashtag
 * sequences. Deterministic. Coordination is labelled as such, never as "bots":
 * research finds many coordinated networks are benign (newsrooms, fan campaigns).
 */
export interface Action {
  author: string;
  key: string; // url | simhash-bucket | tag-sequence
  ts: number; // epoch ms
}

export interface CoordCluster {
  members: string[];
  size: number;
  pairEdges: number;
}

function groupBy<T>(xs: T[], f: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = f(x);
    (m.get(k) ?? m.set(k, []).get(k)!).push(x);
  }
  return m;
}

function connectedComponents(edges: [string, string][]): Set<string>[] {
  const adj = new Map<string, Set<string>>();
  const add = (a: string, b: string) => (adj.get(a) ?? adj.set(a, new Set()).get(a)!).add(b);
  for (const [a, b] of edges) {
    add(a, b);
    add(b, a);
  }
  const seen = new Set<string>();
  const comps: Set<string>[] = [];
  for (const node of adj.keys()) {
    if (seen.has(node)) continue;
    const comp = new Set<string>();
    const stack = [node];
    while (stack.length) {
      const n = stack.pop()!;
      if (comp.has(n)) continue;
      comp.add(n);
      seen.add(n);
      for (const nb of adj.get(n) ?? []) if (!comp.has(nb)) stack.push(nb);
    }
    comps.push(comp);
  }
  return comps;
}

export function coordination(
  actions: Action[],
  windowMs = 60_000,
  minRepeats = 3,
  maxKeyShare = 0.5,
): CoordCluster[] {
  const authors = new Set(actions.map((a) => a.author)).size;
  if (authors < 3) return [];
  const byKey = groupBy(actions, (a) => a.key);
  const pairCount = new Map<string, number>();

  for (const [, acts] of byKey) {
    // Ignore keys that are simply popular (a major news link shared widely).
    if (new Set(acts.map((a) => a.author)).size > authors * maxKeyShare) continue;
    acts.sort((a, b) => a.ts - b.ts);
    for (let i = 0; i < acts.length; i++) {
      for (let j = i + 1; j < acts.length && acts[j].ts - acts[i].ts <= windowMs; j++) {
        if (acts[i].author === acts[j].author) continue;
        const k = [acts[i].author, acts[j].author].sort().join('|');
        pairCount.set(k, (pairCount.get(k) ?? 0) + 1);
      }
    }
  }
  const edges = [...pairCount].filter(([, n]) => n >= minRepeats).map(([k]) => k.split('|') as [string, string]);

  return connectedComponents(edges)
    .filter((c) => c.size >= 3)
    .map((c) => ({
      members: [...c],
      size: c.size,
      pairEdges: edges.filter(([a, b]) => c.has(a) && c.has(b)).length,
    }))
    .sort((a, b) => b.size - a.size);
}
