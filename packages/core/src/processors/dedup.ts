/**
 * Near-duplicate detection & cross-post fusion via 64-bit SimHash.
 * When the same content is posted to multiple platforms (e.g. Mastodon + Bluesky),
 * fold them into a single event carrying every source link. Deterministic, no ML.
 */
import type { TimelineEvent } from '../types.js';

/** 64-bit SimHash of text, as a BigInt. */
export function simhash(text: string): bigint {
  const tokens = text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
  const bits = new Array<number>(64).fill(0);
  for (const tok of tokens) {
    const h = hash64(tok);
    for (let i = 0; i < 64; i++) {
      bits[i] += (h >> BigInt(i)) & 1n ? 1 : -1;
    }
  }
  let out = 0n;
  for (let i = 0; i < 64; i++) if (bits[i] > 0) out |= 1n << BigInt(i);
  return out;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let x = a ^ b;
  let count = 0;
  while (x) {
    x &= x - 1n;
    count++;
  }
  return count;
}

/** FNV-1a 64-bit. */
function hash64(s: string): bigint {
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < s.length; i++) {
    h ^= BigInt(s.charCodeAt(i));
    h = (h * prime) & mask;
  }
  return h;
}

export interface DedupOptions {
  /** Max Hamming distance to consider a near-duplicate (0..64). */
  maxDistance?: number;
  /** Max time gap (ms) between cross-posts to fuse. */
  windowMs?: number;
}

/**
 * Fuse cross-platform near-duplicates. Returns a new event list where duplicate
 * posts are merged into the earliest event, which gains
 * `metadata.crossPosts = [{platform, url}, …]`.
 */
export function fuseCrossPosts(
  events: TimelineEvent[],
  opts: DedupOptions = {},
): TimelineEvent[] {
  const maxDistance = opts.maxDistance ?? 3;
  const windowMs = opts.windowMs ?? 24 * 3600 * 1000;

  const withHash = events
    .filter((e) => (e.content?.trim().length ?? 0) >= 20) // only fuse substantive text
    .map((e) => ({ e, h: simhash(`${e.title} ${e.content}`) }));

  const consumed = new Set<string>();
  const result: TimelineEvent[] = [];

  // Preserve original order; merge later duplicates into the first-seen event.
  for (const event of events) {
    if (consumed.has(event.id)) continue;
    const self = withHash.find((w) => w.e.id === event.id);
    if (!self) {
      result.push(event);
      continue;
    }
    const dupes: TimelineEvent[] = [];
    for (const other of withHash) {
      if (other.e.id === event.id || consumed.has(other.e.id)) continue;
      if (other.e.platform === event.platform) continue; // only cross-platform
      const dt = Math.abs(other.e.timestamp.toMillis() - event.timestamp.toMillis());
      if (dt <= windowMs && hammingDistance(self.h, other.h) <= maxDistance) {
        dupes.push(other.e);
        consumed.add(other.e.id);
      }
    }
    if (dupes.length) {
      const all = [event, ...dupes];
      const crossPosts = all.map((e) => ({ platform: e.platform, url: e.url }));
      event.metadata = { ...event.metadata, crossPosts, crossPostCount: all.length };
      event.relations = [
        ...(event.relations ?? []),
        ...dupes.map((d) => ({ type: 'reference' as const, targetId: d.id, context: 'cross-post' })),
      ];
    }
    result.push(event);
  }
  return result;
}
