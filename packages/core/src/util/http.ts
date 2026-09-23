/**
 * Small fetch wrapper: sets a User-Agent, retries transient failures with
 * backoff, and honours a simple per-host rate limit (courtesy on free/public
 * endpoints like Nominatim and public.api.bsky.app). Uses global fetch (Node 20+).
 */
const lastHit = new Map<string, number>();

export interface HttpOptions extends RequestInit {
  /** Minimum ms between requests to the same host. */
  minIntervalMs?: number;
  /** Retry attempts on 429/5xx/network error. */
  retries?: number;
  /** User-Agent header. */
  userAgent?: string;
  /** Abort after this many ms. */
  timeoutMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function httpGet(
  url: string,
  opts: HttpOptions = {},
): Promise<Response> {
  const {
    minIntervalMs = 0,
    retries = 3,
    userAgent,
    timeoutMs = 20000,
    headers,
    ...init
  } = opts;

  const host = new URL(url).host;
  if (minIntervalMs > 0) {
    const wait = (lastHit.get(host) ?? 0) + minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
  }

  const finalHeaders: Record<string, string> = {
    'User-Agent': userAgent || 'storytime/2.0',
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        headers: finalHeaders,
        signal: ctrl.signal,
      });
      lastHit.set(host, Date.now());
      if (res.status === 429 || res.status >= 500) {
        if (attempt < retries) {
          const retryAfter = Number(res.headers.get('retry-after'));
          await sleep(
            retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt,
          );
          continue;
        }
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(500 * 2 ** attempt);
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`fetch failed: ${url}`);
}

export async function getJson<T = unknown>(
  url: string,
  opts: HttpOptions = {},
): Promise<T> {
  const res = await httpGet(url, opts);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GET ${url} -> ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function getText(url: string, opts: HttpOptions = {}): Promise<string> {
  const res = await httpGet(url, { Accept: 'text/plain', ...opts } as HttpOptions);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${res.statusText}`);
  return await res.text();
}
