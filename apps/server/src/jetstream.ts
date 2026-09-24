import WebSocket from 'ws';
import type { SerializedEvent } from '@storytime/core';

const HOSTS = ['jetstream2.us-east.bsky.network', 'jetstream1.us-west.bsky.network'];

/** Resolve a Bluesky handle to a DID via the public AppView (no auth). */
export async function resolveDid(handle: string): Promise<string | null> {
  const actor = handle.startsWith('did:')
    ? handle
    : handle.includes('.')
      ? handle
      : `${handle}.bsky.social`;
  try {
    const res = await fetch(
      `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { did?: string };
    return data.did ?? null;
  } catch {
    return null;
  }
}

/**
 * Subscribe to the Bluesky Jetstream firehose (public, JSON over WebSocket).
 * Auto-reconnects with backoff and a short cursor rewind. Yields raw commit events.
 */
export async function* jetstream(
  opts: { dids?: string[]; collections: string[]; cursorUs?: number },
  signal: AbortSignal,
): AsyncIterable<any> {
  let cursor = opts.cursorUs;
  let attempt = 0;
  while (!signal.aborted) {
    const q = new URLSearchParams();
    opts.collections.forEach((c) => q.append('wantedCollections', c));
    opts.dids?.forEach((d) => q.append('wantedDids', d));
    if (cursor) q.set('cursor', String(cursor - 5_000_000));
    const ws = new WebSocket(`wss://${HOSTS[attempt % HOSTS.length]}/subscribe?${q}`);
    const queue: any[] = [];
    let wake: (() => void) | null = null;
    let closed = false;
    ws.on('message', (b: WebSocket.RawData) => {
      try {
        queue.push(JSON.parse(b.toString()));
        wake?.();
      } catch {
        /* ignore malformed frame */
      }
    });
    ws.on('close', () => {
      closed = true;
      wake?.();
    });
    ws.on('error', () => ws.close());
    const onAbort = () => ws.close();
    signal.addEventListener('abort', onAbort, { once: true });

    try {
      while (!closed || queue.length) {
        if (signal.aborted) return;
        if (!queue.length) {
          await new Promise<void>((r) => (wake = r));
          wake = null;
          continue;
        }
        const ev = queue.shift();
        if (typeof ev?.time_us === 'number') cursor = ev.time_us;
        if (ev?.kind === 'commit' && ev.commit?.operation !== 'delete') {
          attempt = 0;
          yield ev;
        }
      }
    } finally {
      signal.removeEventListener('abort', onAbort);
    }
    if (signal.aborted) return;
    attempt++;
    await new Promise((r) => setTimeout(r, Math.min(30_000, 500 * 2 ** attempt)));
  }
}

/**
 * Live-stream normalized post events for a Bluesky handle or #hashtag.
 * A handle resolves to a DID (filtered firehose); a hashtag tails the whole
 * post firehose and matches the tag locally.
 */
export async function* streamBluesky(
  target: string,
  signal: AbortSignal,
): AsyncIterable<SerializedEvent> {
  const isHashtag = target.startsWith('#');
  let dids: string[] | undefined;
  let handleForUrl: string | undefined;

  if (!isHashtag) {
    const did = await resolveDid(target.replace(/^@/, ''));
    if (!did) return;
    dids = [did];
    handleForUrl = target.replace(/^@/, '');
  }
  const tag = isHashtag ? target.slice(1).toLowerCase() : null;

  for await (const ev of jetstream({ dids, collections: ['app.bsky.feed.post'] }, signal)) {
    const rec = ev.commit?.record;
    if (!rec || rec.$type !== 'app.bsky.feed.post') continue;
    const text: string = rec.text ?? '';

    if (tag) {
      const facetTags: string[] = (rec.facets ?? [])
        .flatMap((f: any) => f.features ?? [])
        .filter((ft: any) => ft.$type === 'app.bsky.richtext.facet#tag')
        .map((ft: any) => String(ft.tag).toLowerCase());
      const inlineTag = new RegExp(`(^|\\s)#${tag}\\b`, 'i').test(text);
      if (!facetTags.includes(tag) && !inlineTag) continue;
    }

    const did: string = ev.did;
    const rkey: string = ev.commit.rkey;
    const handle = handleForUrl ?? did;
    yield {
      id: `bluesky:at://${did}/app.bsky.feed.post/${rkey}`,
      platform: 'bluesky',
      category: rec.reply ? 'comment' : 'post',
      timestamp: rec.createdAt ?? new Date().toISOString(),
      originalTimestamp: rec.createdAt ?? new Date().toISOString(),
      title: text.slice(0, 80) || 'Post',
      content: text,
      url: `https://bsky.app/profile/${handle}/post/${rkey}`,
      username: handle,
      metadata: { did, live: true },
    };
  }
}
