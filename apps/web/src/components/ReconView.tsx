import { useEffect, useRef, useState } from 'react';
import { reconTarget, reconBundleUrl, type CollectResult, type Corroboration, type Provenance, type RawItem, type ReconResponse } from '../api';

const TIER: Record<string, string> = {
  crtsh: 'primary', dns: 'primary', internetdb: 'aggregator', wayback: 'archive',
  opensanctions: 'primary', gleif: 'primary', sec: 'primary', courtlistener: 'primary', gdelt: 'aggregator', openalex: 'primary',
  adsb: 'primary', overpass: 'primary', nominatim: 'primary', socmint: 'aggregator',
};

async function downloadBundle(target: string) {
  const res = await fetch(reconBundleUrl(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target }) });
  if (!res.ok) return;
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${target.replace(/[^a-z0-9.]/gi, '_')}.evidence.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function CorroborationPanel({ items }: { items: Corroboration[] }) {
  if (items.length === 0) return null;
  return (
    <section className="panel">
      <h2 className="section-title">
        Corroborated across sources
        <span className="livecount">{items.length}</span>
      </h2>
      <div className="note" style={{ marginBottom: 10 }}>
        Confidence rises with the number of independent sources that attest a value, not with how plausible it looks.
      </div>
      {items.slice(0, 30).map((c) => (
        <div className="finding" key={c.value}>
          <span className="count" style={{ color: 'var(--pos)' }}>{c.count}</span>
          <div className="body">
            <b dir="auto">{c.value}</b>
            <span style={{ marginLeft: 8 }}>
              {c.sources.map((s) => (
                <span className="chip" key={s.connector} style={{ marginRight: 4 }}>
                  {s.connector} ({s.tier})
                </span>
              ))}
            </span>
          </div>
        </div>
      ))}
    </section>
  );
}

const DOMAIN_ICON: Record<string, string> = { infra: '▦', media: '▩', records: '▤', socmint: '◈', geoint: '◉', darkweb: '▬' };

function ProvenanceFoot({ p, warning, tier }: { p: Provenance; warning?: string; tier?: string }) {
  return (
    <div className="prov">
      {warning ? <span className="prov-warn">{warning}</span> : null}
      {tier ? <span>tier {tier}</span> : null}
      {p.sourceUrl ? (
        <a href={p.sourceUrl} target="_blank" rel="noopener">
          source
        </a>
      ) : null}
      <span>fetched {new Date(p.fetchedAt).toLocaleTimeString()}</span>
      {p.sha256 ? <span>sha256 {p.sha256.slice(0, 12)}</span> : null}
      <span>{p.licenseNote}</span>
    </div>
  );
}

function ResultCard({ r }: { r: CollectResult }) {
  const title = titleFor(r.connector);
  return (
    <section className="panel">
      <h2 className="section-title">
        {DOMAIN_ICON[r.domain] ?? ''} {title}
        <span className="livecount">{r.items.length} results</span>
      </h2>
      {r.items.length === 0 && !r.warning ? <div className="note">Nothing found.</div> : null}
      {renderItems(r)}
      <ProvenanceFoot p={r.provenance} warning={r.warning} tier={TIER[r.connector]} />
    </section>
  );
}

function renderItems(r: CollectResult) {
  if (r.connector === 'internetdb') {
    const d = (r.items[0]?.data ?? {}) as any;
    return (
      <div className="ipintel">
        <Field label="open ports" values={(d.ports ?? []).map(String)} tone="signal" />
        <Field label="hostnames" values={d.hostnames ?? []} />
        <Field label="known CVEs" values={d.vulns ?? []} tone="neg" />
        <Field label="tech (CPE)" values={(d.cpes ?? []).map((c: string) => c.replace('cpe:/a:', '').replace('cpe:2.3:a:', ''))} />
        <Field label="tags" values={d.tags ?? []} />
      </div>
    );
  }
  if (r.connector === 'dns') {
    return (
      <div className="dnsrecs">
        {r.items.map((it, i) => (
          <div className="dnsrec" key={i}>
            <span className="dnstype">{String((it.data as any).type)}</span>
            <span className="dnsval" dir="auto">{String((it.data as any).value)}</span>
          </div>
        ))}
      </div>
    );
  }
  if (r.connector === 'socmint') {
    const TONE: Record<string, { color: string; label: string }> = {
      present: { color: 'var(--pos)', label: 'found' },
      absent: { color: 'var(--faint)', label: 'not found' },
      unknown: { color: 'var(--muted)', label: 'unknown' },
    };
    return (
      <div className="presence">
        {r.items.map((it, i) => {
          const d = it.data as any;
          const t = TONE[d.status] ?? TONE.unknown;
          return (
            <a className="presence-row" key={i} href={d.url} target="_blank" rel="noopener">
              <span className="pres-plat">{d.platform}</span>
              <span className="pres-dot" style={{ background: t.color }} />
              <span className="pres-status" style={{ color: t.color }}>{t.label}</span>
            </a>
          );
        })}
      </div>
    );
  }
  if (r.connector === 'wayback') {
    return (
      <div className="captures">
        {r.items.slice(0, 40).map((it, i) => {
          const d = it.data as any;
          return (
            <a className="capture" key={i} href={d.waybackUrl} target="_blank" rel="noopener">
              <span className="cap-date">{fmtTs(d.timestamp)}</span>
              <span className="cap-url" dir="auto">{d.original}</span>
              <span className="cap-code">{d.statuscode}</span>
            </a>
          );
        })}
      </div>
    );
  }
  if (['opensanctions', 'gleif', 'sec', 'courtlistener', 'gdelt', 'openalex', 'adsb', 'overpass', 'nominatim'].includes(r.connector)) {
    return (
      <div className="records">
        {r.items.slice(0, 40).map((it, i) => (
          <RecordRow key={i} connector={r.connector} d={it.data as any} />
        ))}
      </div>
    );
  }
  // crtsh subdomains, and any generic list
  return (
    <div className="chips">
      {r.items.slice(0, 200).map((it: RawItem, i) => (
        <span className="chip" key={i}>
          {String((it.data as any).host ?? JSON.stringify(it.data).slice(0, 40))}
        </span>
      ))}
    </div>
  );
}

function RecordRow({ connector, d }: { connector: string; d: any }) {
  let title = '';
  let meta = '';
  let url: string | undefined = d.url;
  if (connector === 'opensanctions') {
    title = d.caption;
    meta = [d.schema, (d.topics ?? []).join(', '), (d.countries ?? []).join(', ')].filter(Boolean).join(' - ');
  } else if (connector === 'gleif') {
    title = d.legalName ?? d.lei;
    meta = [d.lei, d.city, d.country, d.status].filter(Boolean).join(' - ');
  } else if (connector === 'sec') {
    title = d.filer ?? 'Filing';
    meta = [d.form, d.fileDate].filter(Boolean).join(' - ');
  } else if (connector === 'courtlistener') {
    title = d.caseName ?? 'Opinion';
    meta = [d.court, d.dateFiled, d.docketNumber].filter(Boolean).join(' - ');
  } else if (connector === 'gdelt') {
    title = d.title;
    meta = [d.domain, d.country, d.language].filter(Boolean).join(' - ');
  } else if (connector === 'openalex') {
    title = d.title;
    meta = [d.year, (d.authors ?? []).slice(0, 3).join(', '), d.citedBy != null ? `${d.citedBy} citations` : ''].filter(Boolean).join(' - ');
  } else if (connector === 'adsb') {
    title = d.flight || d.registration || d.hex;
    meta = [d.type, d.altitude != null ? `${d.altitude} ft` : '', d.groundSpeed != null ? `${d.groundSpeed} kt` : '', d.registration].filter(Boolean).join(' - ');
  } else if (connector === 'overpass') {
    title = d.name;
    meta = [d.kind, d.lat != null ? `${Number(d.lat).toFixed(4)}, ${Number(d.lon).toFixed(4)}` : ''].filter(Boolean).join(' - ');
  } else if (connector === 'nominatim') {
    title = d.displayName ?? d.name;
    meta = [d.category, d.type, d.countryCode].filter(Boolean).join(' - ');
  }
  return (
    <div className="record">
      {url ? (
        <a className="rec-title" href={url} target="_blank" rel="noopener" dir="auto">
          {title || url}
        </a>
      ) : (
        <span className="rec-title" dir="auto">{title}</span>
      )}
      {meta ? <span className="rec-meta">{meta}</span> : null}
    </div>
  );
}

function Field({ label, values, tone }: { label: string; values: string[]; tone?: 'signal' | 'neg' }) {
  if (!values || values.length === 0) return null;
  return (
    <div className="ipfield">
      <span className="iplabel">{label}</span>
      <div className="chips">
        {values.slice(0, 30).map((v, i) => (
          <span className={`chip ${tone === 'signal' ? 'x' : ''}`} key={i} style={tone === 'neg' ? { color: 'var(--neg)', borderColor: 'var(--neg)' } : undefined}>
            {v}
          </span>
        ))}
      </div>
    </div>
  );
}

function titleFor(id: string): string {
  return {
    crtsh: 'Subdomains (CT logs)', dns: 'DNS records', internetdb: 'IP intelligence', wayback: 'Wayback history',
    opensanctions: 'Sanctions / PEP screening', gleif: 'Legal entities (LEI)', sec: 'SEC filings', courtlistener: 'Court records', gdelt: 'Global news (GDELT)', openalex: 'Academic literature',
    adsb: 'Aircraft nearby (ADS-B)', overpass: 'Places nearby (OpenStreetMap)', nominatim: 'Place at these coordinates',
    socmint: 'Username across platforms',
  }[id] ?? id;
}
function fmtTs(ts: string): string {
  if (!/^\d{14}$/.test(ts)) return ts;
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
}

export function ReconView({ initialTarget }: { initialTarget?: string }) {
  const [target, setTarget] = useState(initialTarget ?? '');
  const [loading, setLoading] = useState(false);
  const [recon, setRecon] = useState<ReconResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  const run = async () => {
    if (!target.trim() || loading) return;
    setLoading(true);
    setError(null);
    setRecon(null);
    try {
      setRecon(await reconTarget(target.trim()));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ran.current && initialTarget) {
      ran.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ padding: '24px 0 60px' }}>
      <div className="field">
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="A domain, IP, name / organization, or lat,lon coordinates"
          aria-label="Domain, IP, name, organization, or coordinates"
        />
        <button className="btn btn-primary" onClick={run} disabled={loading || !target.trim()}>
          {loading ? 'Scanning' : 'Recon'}
        </button>
      </div>
      <div className="note" style={{ marginTop: 10 }}>
        Public data only. A domain or IP runs infrastructure connectors (CT logs, DNS, InternetDB, Wayback); a name or organization runs records and media (OpenSanctions, GLEIF, SEC, CourtListener, GDELT news, OpenAlex); lat,lon coordinates run GEOINT (live aircraft via ADS-B, nearby places via OpenStreetMap). Every result links to its source and can be sealed into a verifiable evidence bundle.
      </div>

      {error ? <div className="error" style={{ marginTop: 18 }}>{error}</div> : null}
      {loading ? (
        <div className="progress" style={{ marginTop: 18 }}>
          <div className="bar"><span /></div>
          <div className="msg">Running connectors across public sources</div>
        </div>
      ) : null}

      {recon ? (
        <div className="stack" style={{ paddingTop: 22 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={() => downloadBundle(target.trim())} style={{ textDecoration: 'none' }}>
              Download evidence bundle
            </button>
            <span className="tag" style={{ alignSelf: 'center' }}>
              sealed, re-verifiable: node scripts/verify-bundle.mjs &lt;file&gt;
            </span>
          </div>
          <CorroborationPanel items={recon.corroboration} />
          {recon.results.map((r) => (
            <ResultCard key={r.connector} r={r} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
