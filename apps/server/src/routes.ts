import type { Express, Request, Response } from 'express';
import {
  buildTimeline,
  loadConfig,
  serializeResult,
  deserializeEvent,
  exportTimeline,
  EXPORT_EXT,
  PLATFORMS,
  OllamaClient,
  createEmbedder,
  rankBySimilarity,
  capabilityMatrix,
  runConnector,
  reconTarget,
  createLogger,
  type Platform,
  type ExportFormat,
  type BuildOptions,
  type EmbedProvider,
  type SerializedEvent,
} from '@storytime/core';
import type { Store } from './db.js';
import { streamBluesky } from './jetstream.js';
import { streamNostr } from './nostr.js';

const CONTENT_TYPE: Record<string, string> = {
  json: 'application/json',
  csv: 'text/csv',
  md: 'text/markdown',
  xml: 'application/xml',
  html: 'text/html',
};

function parseRequest(src: Record<string, unknown>): {
  target: string;
  options: BuildOptions;
} {
  const target = String(src.target ?? '').trim();
  const platforms = (Array.isArray(src.platforms) ? src.platforms : String(src.platforms ?? '').split(','))
    .map((s) => String(s).trim())
    .filter((s): s is Platform => (PLATFORMS as string[]).includes(s));
  const rssFeeds = toList(src.rss);
  const pastebinIds = toList(src.pastebin);
  if (rssFeeds.length && !platforms.includes('rss')) platforms.push('rss');
  if (pastebinIds.length && !platforms.includes('pastebin')) platforms.push('pastebin');

  const ai = src.ai === true || src.ai === 'true';
  const config = loadConfig({
    platforms: platforms.length ? platforms : undefined,
    limitPerPlatform: src.limit ? Number(src.limit) : undefined,
    since: src.since ? String(src.since) : undefined,
    until: src.until ? String(src.until) : undefined,
    rssFeeds,
    pastebinIds,
    ...(src.mastodonInstance ? { mastodon: { instance: String(src.mastodonInstance) } } : {}),
    ai: { ...loadConfig().ai, enabled: ai },
  });
  return { target, options: { config, enrich: { ai }, logger: createLogger('warn') } };
}

function toList(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
}

export function setupRoutes(app: Express, store: Store): void {
  app.get('/api/health', async (_req, res) => {
    const cfg = loadConfig();
    const ollama = new OllamaClient({ ...cfg, ai: { ...cfg.ai, enabled: true } }, createLogger('silent'));
    res.json({
      ok: true,
      version: '2.0.0',
      platforms: PLATFORMS,
      ai: { configured: cfg.ai.enabled, reachable: await ollama.available() },
    });
  });

  // Synchronous build + persist.
  app.post('/api/timeline', async (req: Request, res: Response) => {
    const { target, options } = parseRequest(req.body ?? {});
    if (!target) return res.status(400).json({ error: 'target is required' });
    try {
      const result = await buildTimeline(target, options);
      const serialized = serializeResult(result);
      const stored = store.save(serialized, result.embeddings, result.embeddingProvider, result.embeddingDim);
      res.json({ id: stored.id, ...serialized });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Live build with Server-Sent Events progress, then the final result + id.
  app.get('/api/timeline/stream', async (req: Request, res: Response) => {
    const { target, options } = parseRequest(req.query as Record<string, unknown>);
    if (!target) return res.status(400).json({ error: 'target is required' });

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    try {
      const result = await buildTimeline(target, {
        ...options,
        onProgress: (p) => send('progress', p),
      });
      const serialized = serializeResult(result);
      const stored = store.save(serialized, result.embeddings, result.embeddingProvider, result.embeddingDim);
      send('result', { id: stored.id, ...serialized });
      send('done', { id: stored.id });
    } catch (err) {
      send('error', { message: (err as Error).message });
    } finally {
      res.end();
    }
  });

  // Live Bluesky firehose (Jetstream) for a handle or #hashtag, streamed over SSE.
  app.get('/api/live', async (req, res) => {
    const target = String(req.query.target ?? '').trim();
    if (!target) return res.status(400).json({ error: 'target is required' });
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(`event: status\ndata: ${JSON.stringify({ state: 'connected', target })}\n\n`);

    const ctrl = new AbortController();
    const heartbeat = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => {
      ctrl.abort();
      clearInterval(heartbeat);
    });
    const source = String(req.query.source ?? 'bluesky');
    const stream = source === 'nostr' ? streamNostr(target, ctrl.signal) : streamBluesky(target, ctrl.signal);
    try {
      for await (const ev of stream) {
        res.write(`event: event.added\ndata: ${JSON.stringify(ev)}\n\n`);
      }
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: (err as Error).message })}\n\n`);
    } finally {
      clearInterval(heartbeat);
      res.end();
    }
  });

  // ---- OSINT connector API (upgrade pack doc 06) ----
  // Capability matrix: which connectors are reachable now.
  app.get('/api/v2/sources', async (_req, res) => {
    try {
      res.json({ connectors: await capabilityMatrix(loadConfig().userAgent) });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Run one connector against a target.
  app.post('/api/v2/collect/:connectorId', async (req, res) => {
    const target = String(req.body?.target ?? '').trim();
    if (!target) return res.status(400).json({ error: 'target is required' });
    try {
      res.json(await runConnector(req.params.connectorId, { target, params: req.body?.params }, loadConfig().userAgent));
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Recon sweep: run every applicable connector against a domain/IP/URL.
  app.post('/api/v2/recon', async (req, res) => {
    const target = String(req.body?.target ?? '').trim();
    if (!target) return res.status(400).json({ error: 'target is required' });
    try {
      const results = await reconTarget(target, loadConfig().userAgent);
      res.json({ target, results });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.get('/api/timelines', (_req, res) => {
    res.json(store.list());
  });

  app.get('/api/timelines/:id', (req, res) => {
    const row = store.get(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    res.json({ id: row.id, ...row.data });
  });

  app.delete('/api/timelines/:id', (req, res) => {
    res.json({ deleted: store.delete(req.params.id) });
  });

  // Export a stored timeline in any format.
  app.get('/api/timelines/:id/export.:fmt', (req, res) => {
    const row = store.get(req.params.id);
    if (!row) return res.status(404).json({ error: 'not found' });
    const fmt = req.params.fmt as ExportFormat;
    if (!EXPORT_EXT[fmt]) return res.status(400).json({ error: `bad format: ${fmt}` });
    // Rehydrate luxon DateTime for exporters that call luxon methods.
    const result = {
      ...row.data,
      events: row.data.events.map((e) => deserializeEvent(e)),
    };
    const body = exportTimeline(result, fmt);
    res.type(CONTENT_TYPE[EXPORT_EXT[fmt]] ?? 'text/plain').send(body);
  });

  // Semantic search over a stored timeline's event vectors.
  app.get('/api/timelines/:id/search', async (req, res) => {
    const q = String(req.query.q ?? '').trim();
    const k = Math.min(Number(req.query.k || 10), 50);
    if (!q) return res.status(400).json({ error: 'q is required' });
    const ranked = await semanticSearch(store, req.params.id, q, k);
    if (ranked === null) return res.status(404).json({ error: 'not found' });
    res.json({ query: q, results: ranked });
  });

  // Ask-your-timeline: retrieval-augmented answer grounded in the timeline (local Ollama).
  app.post('/api/timelines/:id/ask', async (req, res) => {
    const question = String(req.body?.question ?? '').trim();
    if (!question) return res.status(400).json({ error: 'question is required' });
    const ranked = await semanticSearch(store, req.params.id, question, 8);
    if (ranked === null) return res.status(404).json({ error: 'not found' });

    const cfg = loadConfig({ ai: { ...loadConfig().ai, enabled: true } });
    const ollama = new OllamaClient(cfg, createLogger('silent'));
    const context = ranked.map((r) => ({
      title: r.event.title,
      content: r.event.content,
      platform: r.event.platform,
      timestamp: r.event.timestamp,
    }));
    const answer = (await ollama.available())
      ? await ollama.answer(question, context)
      : null;
    res.json({
      question,
      answer,
      grounded: !!answer,
      note: answer
        ? undefined
        : 'Local Ollama not reachable - returning the most relevant events instead. Enable Ollama for a synthesized answer.',
      sources: ranked,
    });
  });
}

/** Embed the query with the timeline's provider and rank events by cosine. */
/**
 * Hybrid retrieval: fuse BM25 keyword search (FTS5) and vector KNN with
 * reciprocal rank fusion (RRF, k=60). Either retriever alone still works.
 */
async function semanticSearch(
  store: Store,
  id: string,
  query: string,
  k: number,
): Promise<{ score: number; event: SerializedEvent }[] | null> {
  const row = store.get(id);
  if (!row) return null;
  const byId = new Map(row.data.events.map((e) => [e.id, e]));

  // 1. keyword ranking (FTS5 BM25)
  const keywordIds = store.ftsSearch(id, query, 50);

  // 2. vector ranking (cosine KNN)
  let vectorIds: string[] = [];
  const vectors = store.getVectors(id);
  if (vectors.length) {
    const cfg = loadConfig();
    const embedder = await createEmbedder(cfg, createLogger('silent'), row.embedding_provider as EmbedProvider | undefined);
    if (!row.embedding_dim || embedder.dimension === row.embedding_dim) {
      const [qVec] = await embedder.embed([query]);
      vectorIds = rankBySimilarity(qVec, vectors.map((v) => v.vec), 50).map((r) => vectors[r.index].eventId);
    }
  }

  // 3. reciprocal rank fusion
  const RRF_K = 60;
  const fused = new Map<string, number>();
  for (const list of [keywordIds, vectorIds]) {
    list.forEach((eid, i) => fused.set(eid, (fused.get(eid) ?? 0) + 1 / (RRF_K + i + 1)));
  }
  if (fused.size === 0) return [];

  return [...fused.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([eid, score]) => ({ score: Number(score.toFixed(4)), event: byId.get(eid)! }))
    .filter((r) => r.event);
}
