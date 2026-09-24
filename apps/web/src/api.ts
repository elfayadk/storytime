import type { AskResponse, Progress, SearchHit, TimelineResult } from './types';

export interface BuildParams {
  target: string;
  platforms: string[];
  limit: number;
  rss?: string;
  pastebin?: string;
  mastodonInstance?: string;
  ai?: boolean;
  since?: string;
  until?: string;
}

export interface Health {
  ok: boolean;
  version: string;
  platforms: string[];
  ai: { configured: boolean; reachable: boolean };
}

export async function getHealth(): Promise<Health> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('server unreachable');
  return res.json();
}

/**
 * Build a timeline with live progress via SSE. Falls back to a plain POST if
 * EventSource is unavailable. Resolves with the final result.
 */
export function buildTimeline(
  params: BuildParams,
  onProgress: (p: Progress) => void,
): Promise<TimelineResult> {
  const qs = new URLSearchParams();
  qs.set('target', params.target);
  qs.set('platforms', params.platforms.join(','));
  qs.set('limit', String(params.limit));
  if (params.rss) qs.set('rss', params.rss);
  if (params.pastebin) qs.set('pastebin', params.pastebin);
  if (params.mastodonInstance) qs.set('mastodonInstance', params.mastodonInstance);
  if (params.ai) qs.set('ai', 'true');
  if (params.since) qs.set('since', params.since);
  if (params.until) qs.set('until', params.until);

  return new Promise((resolve, reject) => {
    const es = new EventSource(`/api/timeline/stream?${qs.toString()}`);
    let settled = false;
    es.addEventListener('progress', (e) => onProgress(JSON.parse((e as MessageEvent).data)));
    es.addEventListener('result', (e) => {
      settled = true;
      resolve(JSON.parse((e as MessageEvent).data));
      es.close();
    });
    es.addEventListener('error', (e) => {
      const data = (e as MessageEvent).data;
      if (!settled) {
        reject(new Error(data ? JSON.parse(data).message : 'stream failed'));
      }
      es.close();
    });
  });
}

/** Build synchronously (no progress stream). Used by the comparison view. */
export async function buildTimelineSync(params: BuildParams): Promise<TimelineResult> {
  const res = await fetch('/api/timeline', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      target: params.target,
      platforms: params.platforms,
      limit: params.limit,
      ai: params.ai,
    }),
  });
  if (!res.ok) throw new Error(`build failed for ${params.target}`);
  return res.json();
}

export async function listTimelines(): Promise<
  { id: string; target: string; created_at: string; event_count: number }[]
> {
  const res = await fetch('/api/timelines');
  return res.ok ? res.json() : [];
}

export async function getTimeline(id: string): Promise<TimelineResult> {
  const res = await fetch(`/api/timelines/${id}`);
  if (!res.ok) throw new Error('not found');
  return res.json();
}

export function exportUrl(id: string, fmt: string): string {
  return `/api/timelines/${id}/export.${fmt}`;
}

// ---- OSINT connectors (v2) ----
export interface Provenance {
  connector: string;
  sourceUrl: string;
  fetchedAt: string;
  sha256: string;
  licenseNote: string;
  waybackUrl?: string;
}
export interface RawItem {
  kind: string;
  data: Record<string, unknown>;
  provenance: Provenance;
}
export interface CollectResult {
  connector: string;
  domain: string;
  target: string;
  items: RawItem[];
  provenance: Provenance;
  warning?: string;
}
export interface ConnectorInfo {
  id: string;
  domain: string;
  auth: string;
  capabilities: string[];
  sourceTier: string;
  rateLimit: { rps: number };
  tosNote: string;
  available: boolean;
}
export interface Corroboration {
  value: string;
  sources: { connector: string; tier: string }[];
  count: number;
}
export interface ReconResponse {
  results: CollectResult[];
  corroboration: Corroboration[];
}

export async function reconTarget(target: string): Promise<ReconResponse> {
  const res = await fetch('/api/v2/recon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'recon failed');
  const d = await res.json();
  return { results: d.results ?? [], corroboration: d.corroboration ?? [] };
}

export function reconBundleUrl(): string {
  return '/api/v2/recon/bundle';
}

export async function getSources(): Promise<ConnectorInfo[]> {
  const res = await fetch('/api/v2/sources');
  return res.ok ? (await res.json()).connectors ?? [] : [];
}

/** Open a live Bluesky stream for a handle or #hashtag. Returns a stop function. */
export function openLive(
  target: string,
  onEvent: (e: import('./types').SerializedEvent) => void,
  onStatus?: (state: string) => void,
  source: 'bluesky' | 'nostr' = 'bluesky',
): () => void {
  const es = new EventSource(`/api/live?target=${encodeURIComponent(target)}&source=${source}`);
  es.addEventListener('event.added', (e) => onEvent(JSON.parse((e as MessageEvent).data)));
  es.addEventListener('status', (e) => onStatus?.(JSON.parse((e as MessageEvent).data).state));
  es.addEventListener('error', () => onStatus?.('reconnecting'));
  return () => es.close();
}

export async function searchTimeline(id: string, q: string, k = 10): Promise<SearchHit[]> {
  const res = await fetch(`/api/timelines/${id}/search?q=${encodeURIComponent(q)}&k=${k}`);
  if (!res.ok) throw new Error('search failed');
  return (await res.json()).results ?? [];
}

export async function askTimeline(id: string, question: string): Promise<AskResponse> {
  const res = await fetch(`/api/timelines/${id}/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error('ask failed');
  return res.json();
}
