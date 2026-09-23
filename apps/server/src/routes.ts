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
  createLogger,
  type Platform,
  type ExportFormat,
  type BuildOptions,
  type EmbedProvider,
  type SerializedEvent,
} from '@storytime/core';
import type { Store } from './db.js';

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
async function semanticSearch(
  store: Store,
  id: string,
  query: string,
  k: number,
): Promise<{ score: number; event: SerializedEvent }[] | null> {
  const row = store.get(id);
  if (!row) return null;
  const vectors = store.getVectors(id);
  if (vectors.length === 0) return [];

  const cfg = loadConfig();
  const embedder = await createEmbedder(cfg, createLogger('silent'), row.embedding_provider as EmbedProvider | undefined);
  if (row.embedding_dim && embedder.dimension !== row.embedding_dim) {
    // Provider changed since indexing; can't compare across dimensions.
    return [];
  }
  const [qVec] = await embedder.embed([query]);
  const ranked = rankBySimilarity(qVec, vectors.map((v) => v.vec), k);
  const byId = new Map(row.data.events.map((e) => [e.id, e]));
  return ranked
    .map((r) => ({ score: Number(r.score.toFixed(4)), event: byId.get(vectors[r.index].eventId)! }))
    .filter((r) => r.event);
}
