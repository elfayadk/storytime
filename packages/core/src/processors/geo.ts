import { getJson } from '../util/http.js';
import type { StorytimeConfig } from '../config.js';
import type { Logger } from '../util/logger.js';
import type { GeoLocation, TimelineEvent } from '../types.js';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: { country_code?: string };
}

/**
 * Geocode place entities using OpenStreetMap Nominatim (free, no key).
 * Respects Nominatim's usage policy: identifies via User-Agent, ~1 req/s, and
 * caches within a run. Mutates events in place, attaching `.location`.
 */
export async function geocodeEvents(
  events: TimelineEvent[],
  config: StorytimeConfig,
  logger: Logger,
  maxLookups = 40,
): Promise<void> {
  if (!config.geocode.enabled) return;
  const cache = new Map<string, GeoLocation | null>();
  let lookups = 0;

  for (const event of events) {
    const place = event.entities?.find((e) => e.type === 'place')?.value;
    if (!place) continue;
    const key = place.toLowerCase();

    if (!cache.has(key)) {
      if (lookups >= maxLookups) continue;
      lookups++;
      cache.set(key, await geocodeOne(place, config, logger));
    }
    const loc = cache.get(key);
    if (loc) event.location = loc;
  }
}

async function geocodeOne(
  place: string,
  config: StorytimeConfig,
  logger: Logger,
): Promise<GeoLocation | null> {
  const params = new URLSearchParams({
    q: place,
    format: 'jsonv2',
    limit: '1',
    addressdetails: '1',
  });
  if (config.geocode.email) params.set('email', config.geocode.email);
  const url = `${config.geocode.endpoint}?${params.toString()}`;
  try {
    const results = await getJson<NominatimResult[]>(url, {
      userAgent: config.userAgent,
      minIntervalMs: 1100, // Nominatim policy: max 1 req/s
    });
    const r = results[0];
    if (!r) return null;
    return {
      lat: Number(r.lat),
      lng: Number(r.lon),
      name: place,
      address: r.display_name,
      countryCode: r.address?.country_code?.toUpperCase(),
    };
  } catch (err) {
    logger.debug(`geocode(${place}): ${(err as Error).message}`);
    return null;
  }
}
