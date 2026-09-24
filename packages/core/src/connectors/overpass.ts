import { getText } from '../util/http.js';
import { provenance } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type CollectionTask, type Connector, type RawItem } from './types.js';

/**
 * Overpass API (OpenStreetMap): named features near a point. Keyless. The basis
 * for geolocation verification (what buildings, amenities and POIs are here).
 */
export const overpassConnector: Connector = {
  id: 'overpass',
  domain: 'geoint',
  auth: 'none',
  capabilities: ['lookup'],
  sourceTier: 'primary',
  rateLimit: { rps: 1 },
  tosNote: 'Overpass API (OpenStreetMap), keyless, ODbL.',
  applicable(task) {
    return classifyOsintTarget(task.target).kind === 'geo';
  },
  async healthCheck(ua) {
    try {
      const r = await getText('https://overpass-api.de/api/interpreter?data=[out:json];out%201;', { userAgent: ua, timeoutMs: 9000, retries: 0 });
      return r.includes('elements') || r.includes('version');
    } catch {
      return false;
    }
  },
  async run(task, ua): Promise<CollectResult> {
    const [lat, lon] = classifyOsintTarget(task.target).value.split(',');
    const radius = Math.min(Number(task.params?.radius ?? 300), 2000);
    const ql = `[out:json][timeout:25];(node(around:${radius},${lat},${lon})[amenity][name];node(around:${radius},${lat},${lon})[tourism][name];node(around:${radius},${lat},${lon})[shop][name];way(around:${radius},${lat},${lon})[building][name];);out center 60;`;
    const url = 'https://overpass-api.de/api/interpreter';
    let raw: string;
    try {
      raw = await getText(url, { userAgent: ua, minIntervalMs: 1000, timeoutMs: 28000, method: 'POST', body: `data=${encodeURIComponent(ql)}`, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    } catch (err) {
      const prov = provenance('overpass', url, '', 'OpenStreetMap, ODbL');
      return { connector: 'overpass', domain: 'geoint', target: task.target, items: [], provenance: prov, warning: `${(err as Error).message} (Overpass is slow for busy areas; try a smaller radius)` };
    }
    const prov = provenance('overpass', `${url}?data=${encodeURIComponent(ql)}`, raw, 'OpenStreetMap, ODbL');
    let data: { elements?: any[] } = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return { connector: 'overpass', domain: 'geoint', target: task.target, items: [], provenance: prov, warning: 'non-JSON response' };
    }
    const items: RawItem[] = (data.elements ?? []).slice(0, 60).map((el) => {
      const t = el.tags ?? {};
      const plat = el.lat ?? el.center?.lat;
      const plon = el.lon ?? el.center?.lon;
      return {
        kind: 'osm_feature',
        data: {
          name: t.name,
          kind: t.amenity ?? t.tourism ?? t.shop ?? (t.building ? `building:${t.building}` : 'feature'),
          lat: plat,
          lon: plon,
          url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        },
        provenance: prov,
      };
    });
    return { connector: 'overpass', domain: 'geoint', target: task.target, items, provenance: prov };
  },
};
