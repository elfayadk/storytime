import { getText } from '../util/http.js';
import { provenance } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type Connector, type RawItem } from './types.js';

/**
 * Nominatim (OpenStreetMap) reverse geocoding: turn coordinates into a named
 * place and address. Keyless, ODbL. The verification core of memo T5: given a
 * coordinate, what place is actually here? Nominatim asks for a descriptive
 * User-Agent and at most one request per second, both honored below.
 */
export const nominatimConnector: Connector = {
  id: 'nominatim',
  domain: 'geoint',
  auth: 'none',
  capabilities: ['lookup'],
  sourceTier: 'primary',
  rateLimit: { rps: 1 },
  tosNote: 'Nominatim (OpenStreetMap), keyless, ODbL. Max 1 req/s, descriptive UA required.',
  applicable(task) {
    return classifyOsintTarget(task.target).kind === 'geo';
  },
  async healthCheck(ua) {
    try {
      const r = await getText('https://nominatim.openstreetmap.org/reverse?lat=51.5&lon=-0.12&format=jsonv2', { userAgent: ua, timeoutMs: 8000, retries: 0 });
      return r.includes('display_name') || r.includes('address');
    } catch {
      return false;
    }
  },
  async run(task, ua): Promise<CollectResult> {
    const [lat, lon] = classifyOsintTarget(task.target).value.split(',');
    const zoom = Math.min(Math.max(Number(task.params?.zoom ?? 18), 3), 18);
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=${zoom}&addressdetails=1`;
    let raw: string;
    try {
      raw = await getText(url, { userAgent: ua, minIntervalMs: 1100, timeoutMs: 12000 });
    } catch (err) {
      const prov = provenance('nominatim', url, '', 'OpenStreetMap, ODbL');
      return { connector: 'nominatim', domain: 'geoint', target: task.target, items: [], provenance: prov, warning: (err as Error).message };
    }
    const prov = provenance('nominatim', url, raw, 'OpenStreetMap, ODbL');
    let data: any = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return { connector: 'nominatim', domain: 'geoint', target: task.target, items: [], provenance: prov, warning: 'non-JSON response' };
    }
    if (data.error) {
      return { connector: 'nominatim', domain: 'geoint', target: task.target, items: [], provenance: prov, warning: String(data.error?.message ?? data.error) };
    }
    const a = data.address ?? {};
    const item: RawItem = {
      kind: 'place',
      data: {
        displayName: data.display_name,
        name: data.name || a.amenity || a.building || a.road || a.suburb || a.city || a.county,
        category: data.category,
        type: data.type,
        road: a.road,
        neighbourhood: a.neighbourhood ?? a.suburb,
        city: a.city ?? a.town ?? a.village ?? a.municipality,
        state: a.state,
        postcode: a.postcode,
        country: a.country,
        countryCode: (a.country_code ?? '').toUpperCase(),
        lat: Number(data.lat ?? lat),
        lon: Number(data.lon ?? lon),
        url: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${zoom}/${lat}/${lon}`,
      },
      provenance: prov,
    };
    return { connector: 'nominatim', domain: 'geoint', target: task.target, items: [item], provenance: prov };
  },
};
