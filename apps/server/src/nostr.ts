import WebSocket from 'ws';
import type { SerializedEvent } from '@storytime/core';

const RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net'];

/**
 * Live-stream Nostr notes (kind 1) for a #hashtag from public relays. Keyless;
 * every Nostr event is signed by its author. Deduplicates across relays by id.
 */
export async function* streamNostr(
  target: string,
  signal: AbortSignal,
): AsyncIterable<SerializedEvent> {
  const tag = target.replace(/^#/, '').toLowerCase();
  if (!tag) return;
  // Include the last few minutes so recent activity shows at once, then keep tailing.
  const since = Math.floor(Date.now() / 1000) - 300;
  const seen = new Set<string>();
  const queue: SerializedEvent[] = [];
  let wake: (() => void) | null = null;

  const sockets = RELAYS.map((url) => {
    const ws = new WebSocket(url);
    const sub = Math.random().toString(36).slice(2, 10);
    ws.on('open', () => ws.send(JSON.stringify(['REQ', sub, { kinds: [1], '#t': [tag], since }])));
    ws.on('message', (buf: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(buf.toString());
        if (msg[0] !== 'EVENT' || msg[1] !== sub) return;
        const ev = msg[2];
        if (!ev?.id || seen.has(ev.id)) return;
        seen.add(ev.id);
        queue.push({
          id: `nostr:${ev.id}`,
          platform: 'bluesky', // rendered under the fediverse glyph; metadata marks the network
          category: 'post',
          timestamp: new Date(ev.created_at * 1000).toISOString(),
          originalTimestamp: new Date(ev.created_at * 1000).toISOString(),
          title: String(ev.content ?? '').slice(0, 80) || 'Note',
          content: String(ev.content ?? ''),
          url: `https://njump.me/${ev.id}`,
          username: `${String(ev.pubkey ?? '').slice(0, 12)}…`,
          metadata: { network: 'nostr', pubkey: ev.pubkey, live: true },
        });
        wake?.();
      } catch {
        /* ignore malformed frame */
      }
    });
    ws.on('error', () => {});
    return ws;
  });

  const cleanup = () => sockets.forEach((ws) => ws.close());
  signal.addEventListener('abort', cleanup, { once: true });

  try {
    while (!signal.aborted) {
      if (!queue.length) {
        await new Promise<void>((r) => (wake = r));
        wake = null;
        continue;
      }
      yield queue.shift()!;
    }
  } finally {
    signal.removeEventListener('abort', cleanup);
    cleanup();
  }
}
