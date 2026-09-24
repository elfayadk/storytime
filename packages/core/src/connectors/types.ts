/**
 * OSINT Connector SDK (upgrade pack doc 01 / 06). Every source is a pure,
 * testable Connector that declares its auth tier, rate limit and ToS note, and
 * emits items wrapped in a provenance envelope (source URL, fetch time, content
 * hash, license). Provenance is a first-class citizen: no unattributed intel.
 */
export type Domain = 'socmint' | 'records' | 'media' | 'geoint' | 'infra' | 'darkweb';
export type AuthTier = 'none' | 'free-key' | 'session' | 'tor-isolated';
export type Capability = 'lookup' | 'search' | 'stream' | 'bulk';
/** Source verification tier (memo T1): confidence is weighted by source authority. */
export type SourceTier = 'primary' | 'aggregator' | 'archive' | 'community';

export interface Provenance {
  connector: string;
  sourceUrl: string;
  fetchedAt: string; // ISO
  sha256: string; // hash of the raw response
  licenseNote: string;
  waybackUrl?: string;
  warcPath?: string;
}

export interface RawItem {
  kind: string; // 'subdomain' | 'dns_record' | 'ip_intel' | 'wayback_capture' | ...
  data: Record<string, unknown>;
  provenance: Provenance;
}

export interface CollectionTask {
  target: string; // domain, ip, url, handle
  kind?: string;
  params?: Record<string, unknown>;
}

export interface CollectResult {
  connector: string;
  domain: Domain;
  target: string;
  items: RawItem[];
  provenance: Provenance;
  warning?: string;
}

export interface Connector {
  id: string;
  domain: Domain;
  auth: AuthTier;
  capabilities: Capability[];
  sourceTier: SourceTier;
  rateLimit: { rps: number; burst?: number };
  tosNote: string;
  /** True when the connector accepts this target shape. */
  applicable(task: CollectionTask): boolean;
  healthCheck(userAgent: string): Promise<boolean>;
  run(task: CollectionTask, userAgent: string): Promise<CollectResult>;
}

/** Classify a free-text target so connectors can declare applicability. */
export function classifyOsintTarget(target: string): {
  kind: 'domain' | 'ip' | 'url' | 'email' | 'handle' | 'geo' | 'unknown';
  value: string;
} {
  const t = target.trim();
  if (/^https?:\/\//i.test(t)) return { kind: 'url', value: t };
  // geographic coordinates "lat,lon"
  if (/^-?\d{1,2}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/.test(t)) {
    const [lat, lon] = t.split(',').map((s) => Number(s.trim()));
    if (Math.abs(lat) <= 90 && Math.abs(lon) <= 180) return { kind: 'geo', value: `${lat},${lon}` };
  }
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(t) || /^[0-9a-f:]+:[0-9a-f:]+$/i.test(t)) return { kind: 'ip', value: t };
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t) && !t.includes(' ')) {
    // could be an email or a fediverse handle; treat plain user@host.tld as email here
    return { kind: 'email', value: t };
  }
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(t)) return { kind: 'domain', value: t.toLowerCase() };
  if (/^@?[\w.-]+$/.test(t)) return { kind: 'handle', value: t.replace(/^@/, '') };
  return { kind: 'unknown', value: t };
}
