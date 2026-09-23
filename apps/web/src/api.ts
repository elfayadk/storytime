import type { AskResponse, Progress, SearchHit, TimelineResult } from './types';

export interface BuildParams {
  target: string;
  platforms: string[];
  limit: number;
  rss?: string;
  pastebin?: string;
  mastodonInstance?: string;
  ai?: boolean;
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
