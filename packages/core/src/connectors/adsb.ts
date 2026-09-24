import { getText } from '../util/http.js';
import { provenance } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type CollectionTask, type Connector, type RawItem } from './types.js';

/**
 * adsb.lol: live aircraft (ADS-B) near a point. Keyless, ODbL licensed. Target
 * is "lat,lon"; an optional radius (nautical miles) comes from params.
 */
export const adsbConnector: Connector = {
  id: 'adsb',
  domain: 'geoint',
  auth: 'none',
  capabilities: ['lookup'],
  sourceTier: 'primary',
  rateLimit: { rps: 1 },
  tosNote: 'adsb.lol API, keyless, ODbL. Live public ADS-B positions.',
  applicable(task) {
    return classifyOsintTarget(task.target).kind === 'geo' || /^[0-9a-f]{6}$/i.test(task.target.trim());
  },
  async healthCheck(ua) {
    try {
      const r = await getText('https://api.adsb.lol/v2/point/51.5/-0.12/5', { userAgent: ua, timeoutMs: 8000, retries: 0 });
      return r.includes('ac') || r.includes('now');
    } catch {
      return false;
    }
  },
  async run(task, ua): Promise<CollectResult> {
    const t = task.target.trim();
    const isHex = /^[0-9a-f]{6}$/i.test(t);
    const url = isHex
      ? `https://api.adsb.lol/v2/icao/${t.toLowerCase()}`
      : (() => {
          const [lat, lon] = classifyOsintTarget(t).value.split(',');
          const radius = Math.min(Number(task.params?.radius ?? 25), 250);
          return `https://api.adsb.lol/v2/point/${lat}/${lon}/${radius}`;
        })();
    const raw = await getText(url, { userAgent: ua, minIntervalMs: 1000, timeoutMs: 12000 });
    const prov = provenance('adsb', url, raw, 'adsb.lol, ODbL');
    let data: { ac?: any[] } = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return { connector: 'adsb', domain: 'geoint', target: t, items: [], provenance: prov, warning: 'non-JSON response' };
    }
    const items: RawItem[] = (data.ac ?? []).slice(0, 100).map((a) => ({
      kind: 'aircraft',
      data: {
        hex: a.hex,
        flight: (a.flight ?? '').trim(),
        registration: a.r,
        type: a.t,
        altitude: a.alt_baro,
        groundSpeed: a.gs,
        track: a.track,
        lat: a.lat,
        lon: a.lon,
        url: a.hex ? `https://globe.adsb.lol/?icao=${a.hex}` : undefined,
      },
      provenance: prov,
    }));
    return { connector: 'adsb', domain: 'geoint', target: t, items, provenance: prov };
  },
};
