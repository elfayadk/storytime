import type { StorytimeConfig } from '../config.js';
import type { Logger } from '../util/logger.js';
import type { ClusterSummary, TimelineEvent } from '../types.js';
import { analyzeSentiment } from './sentiment.js';
import { extractEntities } from './entities.js';
import { detectLang } from '../util/lang.js';
import { assignTopics } from './topics.js';
import { geocodeEvents } from './geo.js';
import { fuseCrossPosts } from './dedup.js';
import { clusterVectors } from './semantic.js';
import { createEmbedder } from '../ai/embeddings.js';
import { OllamaClient } from '../ai/ollama.js';

export interface EnrichOptions {
  sentiment?: boolean;
  entities?: boolean;
  topics?: boolean;
  geo?: boolean;
  ai?: boolean;
  dedup?: boolean;
  embed?: boolean;
}

export interface EnrichResult {
  events: TimelineEvent[];
  topTopics: { topic: string; count: number }[];
  clusters: ClusterSummary[];
  embeddings: Record<string, number[]>;
  embeddingProvider?: string;
  embeddingDim?: number;
}

/**
 * Deduplicate, fuse cross-posts, sort (newest first), enrich with NLP + optional
 * AI, embed, and cluster. Returns everything the builder needs.
 */
export async function enrich(
  input: TimelineEvent[],
  config: StorytimeConfig,
  logger: Logger,
  opts: EnrichOptions = {},
): Promise<EnrichResult> {
  const flags = {
    sentiment: opts.sentiment ?? true,
    entities: opts.entities ?? true,
    topics: opts.topics ?? true,
    geo: opts.geo ?? true,
    ai: opts.ai ?? config.ai.enabled,
    dedup: opts.dedup ?? true,
    embed: opts.embed ?? true,
  };

  // Dedupe by id, sort newest-first.
  const byId = new Map<string, TimelineEvent>();
  for (const e of input) {
    const key = e.id || `${e.platform}:${e.url}`;
    if (!byId.has(key)) byId.set(key, e);
  }
  let events = [...byId.values()].sort(
    (a, b) => b.timestamp.toMillis() - a.timestamp.toMillis(),
  );

  // Cross-platform near-duplicate fusion (SimHash).
  if (flags.dedup) {
    const before = events.length;
    events = fuseCrossPosts(events);
    if (events.length < before) {
      logger.info(`dedup: fused ${before - events.length} cross-post duplicate(s)`);
    }
  }

  // Per-event local NLP.
  for (const e of events) {
    const text = `${e.title}\n${e.content}`;
    if (flags.entities) e.entities = extractEntities(text);
    if (flags.sentiment) e.sentiment = analyzeSentiment(text);
    if (!e.language) e.language = detectLang(text).lang;
  }

  let topTopics: { topic: string; count: number }[] = [];
  if (flags.topics) topTopics = assignTopics(events);

  if (flags.geo) {
    try {
      await geocodeEvents(events, config, logger);
    } catch (err) {
      logger.warn(`geo: ${(err as Error).message}`);
    }
  }

  // Embeddings + semantic clustering.
  const embeddings: Record<string, number[]> = {};
  let clusters: ClusterSummary[] = [];
  let embeddingProvider: string | undefined;
  let embeddingDim: number | undefined;
  if (flags.embed && events.length) {
    try {
      const embedder = await createEmbedder(config, logger);
      embeddingProvider = embedder.provider;
      embeddingDim = embedder.dimension;
      const vecs = await embedder.embed(events.map((e) => `${e.title}\n${e.content}`.slice(0, 2000)));
      vecs.forEach((v, i) => {
        embeddings[events[i].id] = Array.from(v);
      });
      clusters = summarizeClusters(clusterVectors(vecs), events);
    } catch (err) {
      logger.warn(`embeddings: ${(err as Error).message}`);
    }
  }

  // Optional local LLM per-event summaries.
  if (flags.ai) {
    const ollama = new OllamaClient(config, logger);
    if (await ollama.available()) {
      logger.info(`ollama: enriching with ${config.ai.model}`);
      for (const e of events.slice(0, 60)) {
        const s = await ollama.summarizeEvent(e);
        if (s) e.summary = s;
      }
    } else if (config.ai.enabled) {
      logger.warn('ollama: enabled but not reachable - skipping AI summaries');
    }
  }

  return { events, topTopics, clusters, embeddings, embeddingProvider, embeddingDim };
}

/** Turn raw vector clusters into labeled theme summaries using event topics. */
function summarizeClusters(
  clusters: { id: number; members: number[] }[],
  events: TimelineEvent[],
): ClusterSummary[] {
  return clusters
    .filter((c) => c.members.length >= 2)
    .map((c) => {
      const termCounts = new Map<string, number>();
      for (const idx of c.members) {
        for (const t of events[idx].topics ?? []) {
          termCounts.set(t, (termCounts.get(t) ?? 0) + 1);
        }
      }
      const keywords = [...termCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([t]) => t);
      return {
        id: c.id,
        label: keywords.slice(0, 3).join(' / ') || `Theme ${c.id + 1}`,
        size: c.members.length,
        keywords,
        eventIds: c.members.map((i) => events[i].id),
      };
    });
}
