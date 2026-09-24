import { DateTime } from 'luxon';
import { loadConfig, type StorytimeConfig } from './config.js';
import { createLogger, type Logger } from './util/logger.js';
import { getIngesters, type IngestContext } from './ingesters/index.js';
import { enrich, type EnrichOptions } from './processors/pipeline.js';
import { computeStats } from './processors/stats.js';
import { buildNetwork } from './processors/network.js';
import { detectAnomalies } from './processors/anomaly.js';
import { computeRhythm } from './processors/rhythm.js';
import { buildFacts } from './processors/facts.js';
import { buildArcs } from './processors/arcs.js';
import { collectProfile, discoverFeed } from './processors/profile.js';
import { OllamaClient } from './ai/ollama.js';
import type { Platform, TimelineEvent, TimelineResult } from './types.js';

export interface BuildOptions {
  config?: Partial<StorytimeConfig>;
  logger?: Logger;
  enrich?: EnrichOptions;
  /** Progress events for UIs/SSE. */
  onProgress?: (p: BuildProgress) => void;
}

export interface BuildProgress {
  phase: 'ingest' | 'enrich' | 'analyze' | 'narrate' | 'done';
  platform?: Platform;
  message: string;
  count?: number;
}

/**
 * Build a full timeline for a target across the configured free/OSS platforms.
 * This is the single entry point used by the CLI and the server.
 */
export async function buildTimeline(
  target: string,
  options: BuildOptions = {},
): Promise<TimelineResult> {
  const config = loadConfig(options.config);
  const logger = options.logger ?? createLogger('info');
  const progress = options.onProgress ?? (() => {});

  const ctx: IngestContext = {
    config,
    logger,
    since: config.since ? DateTime.fromISO(config.since) : undefined,
    until: config.until ? DateTime.fromISO(config.until) : undefined,
  };

  // 0. Resolve the subject profile (GitHub / GitLab), and auto-discover their
  //    blog feed so it joins the RSS ingestion.
  progress({ phase: 'ingest', message: 'Resolving subject profile' });
  const profile = await collectProfile(target, config, logger);
  if (profile?.blog) {
    const feed = await discoverFeed(profile.blog, config, logger);
    if (feed && !config.rssFeeds.includes(feed)) {
      config.rssFeeds = [...config.rssFeeds, feed];
      if (!config.platforms.includes('rss')) config.platforms = [...config.platforms, 'rss'];
      logger.info(`discovered blog feed: ${feed}`);
    }
  }

  // 1. Ingest from every applicable platform, in parallel.
  const ingesters = getIngesters(config.platforms).filter((i) =>
    i.applicable(target, ctx),
  );
  progress({ phase: 'ingest', message: `Ingesting from ${ingesters.length} platform(s)` });

  const batches = await Promise.all(
    ingesters.map(async (ing) => {
      progress({ phase: 'ingest', platform: ing.platform, message: `Fetching ${ing.platform}` });
      try {
        const evs = await ing.ingest(target, ctx);
        progress({ phase: 'ingest', platform: ing.platform, message: `${ing.platform}: ${evs.length}`, count: evs.length });
        return evs;
      } catch (err) {
        logger.warn(`${ing.platform} ingest failed: ${(err as Error).message}`);
        return [] as TimelineEvent[];
      }
    }),
  );
  const rawEvents = batches.flat();

  // 2. Enrich (dedupe, fuse cross-posts, sentiment, entities, topics, geo,
  //    embeddings + semantic clusters, optional AI).
  progress({ phase: 'enrich', message: `Enriching ${rawEvents.length} events`, count: rawEvents.length });
  const { events, topTopics, clusters, embeddings, embeddingProvider, embeddingDim } =
    await enrich(rawEvents, config, logger, options.enrich);

  // 3. Analyze (stats + interaction graph + temporal anomalies).
  progress({ phase: 'analyze', message: 'Computing statistics, graph, and anomalies' });
  const stats = computeStats(events, topTopics);
  const graph = buildNetwork(events);
  const insights = detectAnomalies(events);
  const rhythm = computeRhythm(events);
  const arcs = buildArcs(events, clusters);
  const aiEnabled = options.enrich?.ai ?? config.ai.enabled;
  progress({ phase: 'analyze', message: 'Extracting facts (knowledge graph)' });
  const facts = await buildFacts(events, config, logger, aiEnabled);

  // 4. Optional AI narrative + written dossier brief over the whole timeline.
  let narrative: string | undefined;
  let brief: string | undefined;
  if ((options.enrich?.ai ?? config.ai.enabled) && events.length) {
    const ollama = new OllamaClient(config, logger);
    if (await ollama.available()) {
      progress({ phase: 'narrate', message: 'Writing the intelligence brief (Ollama)' });
      narrative = (await ollama.narrate(target, events, stats)) ?? undefined;
      brief = (await ollama.brief(target, { profile, stats, rhythm, clusters, insights, events })) ?? undefined;
    }
  }

  progress({ phase: 'done', message: `Timeline ready: ${events.length} events`, count: events.length });
  return {
    target,
    generatedAt: DateTime.now().toISO()!,
    profile,
    facts,
    arcs,
    brief,
    events,
    stats,
    graph,
    rhythm,
    narrative,
    insights,
    clusters,
    embeddingProvider,
    embeddingDim,
    embeddings,
  };
}
