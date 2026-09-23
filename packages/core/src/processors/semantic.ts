/**
 * Vector-space operations over embeddings. Pure and deterministic - no model,
 * no network, unit-testable. Works with any provider's normalized vectors.
 */

export function cosine(a: Float32Array, b: Float32Array): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot; // inputs are L2-normalized, so dot == cosine similarity
}

export interface Cluster {
  id: number;
  members: number[]; // indices into the input array
  centroid: Float32Array;
}

/**
 * Single-pass online cosine clustering (leader algorithm): each vector joins the
 * most similar existing cluster above `threshold`, else seeds a new one. O(n·k).
 * Deterministic given input order. Good enough for timeline-scale (hundreds).
 */
export function clusterVectors(vectors: Float32Array[], threshold = 0.55): Cluster[] {
  const clusters: Cluster[] = [];
  vectors.forEach((v, i) => {
    let best = -1;
    let bestSim = threshold;
    for (const c of clusters) {
      const sim = cosine(v, c.centroid);
      if (sim > bestSim) {
        bestSim = sim;
        best = c.id;
      }
    }
    if (best === -1) {
      clusters.push({ id: clusters.length, members: [i], centroid: Float32Array.from(v) });
    } else {
      const c = clusters[best];
      c.members.push(i);
      // incremental centroid update, then renormalize
      const k = c.members.length;
      for (let d = 0; d < c.centroid.length; d++) {
        c.centroid[d] = (c.centroid[d] * (k - 1) + v[d]) / k;
      }
      renormalize(c.centroid);
    }
  });
  return clusters.sort((a, b) => b.members.length - a.members.length);
}

/** Rank item indices by cosine similarity to a query vector (desc). */
export function rankBySimilarity(
  query: Float32Array,
  vectors: Float32Array[],
  topK = vectors.length,
): { index: number; score: number }[] {
  return vectors
    .map((v, index) => ({ index, score: cosine(query, v) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

function renormalize(v: Float32Array): void {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
}
