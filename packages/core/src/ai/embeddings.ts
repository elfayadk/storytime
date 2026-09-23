/**
 * Embedding provider chain (all free, all local). Picks the best AVAILABLE
 * engine at init and exposes a uniform `embed()` returning L2-normalized
 * Float32 vectors. Nothing here is required - tier 3 always works with zero deps.
 *
 *   1. Ollama   (nomic-embed-text)         - if local AI is enabled + reachable
 *   2. Transformers.js (all-MiniLM-L6-v2)  - in-process ONNX, no server
 *   3. Hashed lexical embedding            - dependency-free deterministic fallback
 */
import type { StorytimeConfig } from '../config.js';
import type { Logger } from '../util/logger.js';

export type EmbedProvider = 'ollama' | 'transformers' | 'hashed';

export interface Embedder {
  provider: EmbedProvider;
  dimension: number;
  embed(texts: string[]): Promise<Float32Array[]>;
}

/** Resolve the best available embedder. Never throws. */
export async function createEmbedder(
  config: StorytimeConfig,
  logger: Logger,
  prefer?: EmbedProvider,
): Promise<Embedder> {
  const order: EmbedProvider[] =
    prefer ? [prefer, 'ollama', 'transformers', 'hashed'] : ['ollama', 'transformers', 'hashed'];

  for (const p of [...new Set(order)]) {
    if (p === 'ollama') {
      const e = await tryOllama(config, logger);
      if (e) return e;
    } else if (p === 'transformers') {
      const e = await tryTransformers(logger);
      if (e) return e;
    } else {
      return hashedEmbedder();
    }
  }
  return hashedEmbedder();
}

// ── Tier 1: Ollama ───────────────────────────────────────────────────────────
async function tryOllama(config: StorytimeConfig, logger: Logger): Promise<Embedder | null> {
  if (!config.ai.enabled) return null;
  const model = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
  try {
    const probe = await fetch(`${config.ai.endpoint}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input: 'ping' }),
      signal: AbortSignal.timeout(4000),
    });
    if (!probe.ok) return null;
    const first = (await probe.json()) as { embeddings?: number[][] };
    const dim = first.embeddings?.[0]?.length;
    if (!dim) return null;
    logger.info(`embeddings: ollama/${model} (${dim}d)`);
    return {
      provider: 'ollama',
      dimension: dim,
      async embed(texts) {
        const res = await fetch(`${config.ai.endpoint}/api/embed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, input: texts }),
          signal: AbortSignal.timeout(120000),
        });
        const data = (await res.json()) as { embeddings: number[][] };
        return data.embeddings.map((v) => normalize(Float32Array.from(v)));
      },
    };
  } catch {
    return null;
  }
}

// ── Tier 2: Transformers.js (optional dependency) ────────────────────────────
async function tryTransformers(logger: Logger): Promise<Embedder | null> {
  try {
    // Optional dep - only loaded if installed. A non-literal specifier keeps
    // TypeScript from requiring the module to be present at compile time.
    const spec = '@huggingface/transformers';
    const mod: any = await import(spec).catch(() => null);
    if (!mod?.pipeline) return null;
    const model = process.env.TRANSFORMERS_EMBED_MODEL || 'Xenova/all-MiniLM-L6-v2';
    const extractor = await mod.pipeline('feature-extraction', model);
    logger.info(`embeddings: transformers.js/${model} (384d)`);
    return {
      provider: 'transformers',
      dimension: 384,
      async embed(texts) {
        const out = await extractor(texts, { pooling: 'mean', normalize: true });
        const list: number[][] = out.tolist();
        return list.map((v) => Float32Array.from(v));
      },
    };
  } catch (err) {
    logger.debug(`transformers.js unavailable: ${(err as Error).message}`);
    return null;
  }
}

// ── Tier 3: Hashed lexical embedding (always available, zero deps) ───────────
const HASH_DIM = 384;

export function hashedEmbedder(dim = HASH_DIM): Embedder {
  return {
    provider: 'hashed',
    dimension: dim,
    async embed(texts) {
      return texts.map((t) => hashEmbed(t, dim));
    },
  };
}

/** Feature-hashing bag-of-words: signed hashed token counts, L2-normalized. */
export function hashEmbed(text: string, dim = HASH_DIM): Float32Array {
  const v = new Float32Array(dim);
  const tokens = (text.toLowerCase().match(/[a-z0-9]{2,}/g) ?? []).slice(0, 400);
  for (const tok of tokens) {
    const h = fnv1a(tok);
    const idx = h % dim;
    const sign = (fnv1a('s' + tok) & 1) === 0 ? 1 : -1;
    v[idx] += sign;
  }
  // include char bigrams for a little sub-word signal
  for (let i = 0; i < tokens.length; i++) {
    const bg = tokens[i].slice(0, 3);
    v[fnv1a('b' + bg) % dim] += 0.5;
  }
  return normalize(v);
}

function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function normalize(v: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const norm = Math.sqrt(sum) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= norm;
  return v;
}
