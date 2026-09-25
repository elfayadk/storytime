import { getText } from '../util/http.js';
import { provenance } from './provenance.js';
import { classifyOsintTarget, type CollectResult, type Connector, type RawItem } from './types.js';

/**
 * Sentinel-2 imagery availability via the Element84 Earth Search STAC API
 * (upgrade pack P4). Keyless. For a coordinate, it lists the most recent
 * Sentinel-2 L2A scenes covering that point, each with its capture date, cloud
 * cover and a browse thumbnail. This answers "is there recent overhead imagery
 * of this location, and how clear is it?" without any satellite-tasking cost.
 */
export const sentinelConnector: Connector = {
  id: 'sentinel',
  domain: 'geoint',
  auth: 'none',
  capabilities: ['search'],
  sourceTier: 'primary',
  rateLimit: { rps: 2 },
  tosNote: 'Element84 Earth Search STAC (Sentinel-2 L2A on AWS Open Data), keyless, CC-BY.',
  applicable(task) {
    return classifyOsintTarget(task.target).kind === 'geo';
  },
  async healthCheck(ua) {
    try {
      const r = await getText('https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a', { userAgent: ua, timeoutMs: 9000, retries: 0 });
      return r.includes('sentinel-2') || r.includes('extent');
    } catch {
      return false;
    }
  },
  async run(task, ua): Promise<CollectResult> {
    const [latS, lonS] = classifyOsintTarget(task.target).value.split(',');
    const lat = Number(latS);
    const lon = Number(lonS);
    const pad = 0.02;
    const url = 'https://earth-search.aws.element84.com/v1/search';
    const body = JSON.stringify({
      collections: ['sentinel-2-l2a'],
      bbox: [lon - pad, lat - pad, lon + pad, lat + pad],
      limit: Math.min(Number(task.params?.limit ?? 8), 20),
      sortby: [{ field: 'properties.datetime', direction: 'desc' }],
    });
    let raw: string;
    try {
      raw = await getText(url, { userAgent: ua, method: 'POST', body, headers: { 'Content-Type': 'application/json' }, timeoutMs: 15000, minIntervalMs: 500 });
    } catch (err) {
      const prov = provenance('sentinel', url, '', 'Sentinel-2, CC-BY');
      return { connector: 'sentinel', domain: 'geoint', target: task.target, items: [], provenance: prov, warning: (err as Error).message };
    }
    const prov = provenance('sentinel', url, raw, 'Sentinel-2, CC-BY');
    let data: { features?: any[] } = {};
    try {
      data = JSON.parse(raw);
    } catch {
      return { connector: 'sentinel', domain: 'geoint', target: task.target, items: [], provenance: prov, warning: 'non-JSON response' };
    }
    const items: RawItem[] = (data.features ?? []).slice(0, 20).map((f) => {
      const p = f.properties ?? {};
      const a = f.assets ?? {};
      const dt = String(p.datetime ?? '');
      return {
        kind: 'satellite_scene',
        data: {
          id: f.id,
          date: dt.slice(0, 10),
          datetime: dt,
          cloudCover: p['eo:cloud_cover'] != null ? Math.round(Number(p['eo:cloud_cover'])) : undefined,
          platform: p.platform ?? p.constellation,
          thumbnail: a.thumbnail?.href ?? a.overview?.href,
          url: a.thumbnail?.href ?? a.visual?.href ?? f.links?.find((l: any) => l.rel === 'self')?.href,
        },
        provenance: prov,
      };
    });
    return { connector: 'sentinel', domain: 'geoint', target: task.target, items, provenance: prov };
  },
};
