import { CONNECTORS } from '../connectors/index.js';
import { classifyOsintTarget, type CollectionTask } from '../connectors/types.js';

/**
 * The agent's tool menu. Each connector is already JSON-in / JSON-out, so it IS
 * a function-calling tool (memo T4): the model selects a tool by name and the
 * runner executes it. The catalog is derived from the live connector registry,
 * so the menu can never drift from what actually runs, and the model can never
 * invent a tool that does not exist.
 */
export interface ToolSpec {
  name: string;
  domain: string;
  auth: string;
  description: string;
  input: 'domain' | 'ip' | 'name' | 'coordinates' | 'mixed';
}

const DESCRIPTIONS: Record<string, string> = {
  crtsh: 'List subdomains of a domain from certificate-transparency logs.',
  dns: 'Resolve current DNS records (A, AAAA, MX, TXT, NS) for a domain.',
  internetdb: 'Look up open ports, hostnames, known CVEs and technologies for an IP.',
  wayback: 'Retrieve historical snapshots of a domain or URL from the Wayback Machine.',
  opensanctions: 'Screen a person or organization against sanctions, PEP and watchlists.',
  gleif: 'Find a legal entity and its LEI registration by organization name.',
  sec: 'Search U.S. SEC EDGAR corporate filings by name.',
  courtlistener: 'Search U.S. federal and state court records and opinions by name.',
  gdelt: 'Search worldwide news coverage for a name or organization.',
  openalex: 'Search scholarly literature and authorship for a name or organization.',
  adsb: 'List live aircraft near coordinates, or track one aircraft by ICAO hex.',
  overpass: 'List named places, amenities and buildings near coordinates from OpenStreetMap.',
  nominatim: 'Reverse geocode coordinates to a named place and full address.',
};

const INPUT_KIND: Record<string, ToolSpec['input']> = {
  crtsh: 'domain', dns: 'domain', wayback: 'domain', internetdb: 'ip',
  opensanctions: 'name', gleif: 'name', sec: 'name', courtlistener: 'name', gdelt: 'name', openalex: 'name',
  adsb: 'coordinates', overpass: 'coordinates', nominatim: 'coordinates',
};

/** The full menu, one spec per registered connector. */
export function toolCatalog(): ToolSpec[] {
  return CONNECTORS.map((c) => ({
    name: c.id,
    domain: c.domain,
    auth: c.auth,
    description: DESCRIPTIONS[c.id] ?? `${c.domain} lookup`,
    input: INPUT_KIND[c.id] ?? 'mixed',
  }));
}

/** The tools that accept this target's shape (the agent's legal move set). */
export function applicableTools(target: string): ToolSpec[] {
  const task: CollectionTask = { target };
  const ok = new Set(CONNECTORS.filter((c) => c.applicable(task)).map((c) => c.id));
  return toolCatalog().filter((t) => ok.has(t.name));
}

/** Human-readable line describing what an input shape unlocks (for the UI/plan). */
export function targetSummary(target: string): string {
  const { kind } = classifyOsintTarget(target);
  switch (kind) {
    case 'domain': return 'a domain: infrastructure and history';
    case 'ip': return 'an IP address: exposure and services';
    case 'url': return 'a URL: history and infrastructure';
    case 'geo': return 'coordinates: places and live aircraft';
    case 'email':
    case 'handle': return 'an identifier: presence and records';
    default: return 'a name or organization: records and media';
  }
}
