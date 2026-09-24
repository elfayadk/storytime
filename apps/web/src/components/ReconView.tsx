import { useEffect, useRef, useState } from 'react';
import { reconTarget, type CollectResult, type Provenance, type RawItem } from '../api';

const DOMAIN_ICON: Record<string, string> = { infra: '▦', media: '▩', records: '▤', socmint: '◈', geoint: '◉', darkweb: '▬' };

function ProvenanceFoot({ p, warning }: { p: Provenance; warning?: string }) {
  return (
    <div className="prov">
      {warning ? <span className="prov-warn">{warning}</span> : null}
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
      <ProvenanceFoot p={r.provenance} warning={r.warning} />
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
  return { crtsh: 'Subdomains (CT logs)', dns: 'DNS records', internetdb: 'IP intelligence', wayback: 'Wayback history' }[id] ?? id;
}
function fmtTs(ts: string): string {
  if (!/^\d{14}$/.test(ts)) return ts;
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
}

export function ReconView({ initialTarget }: { initialTarget?: string }) {
  const [target, setTarget] = useState(initialTarget ?? '');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CollectResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);

  const run = async () => {
    if (!target.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      setResults(await reconTarget(target.trim()));
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
          placeholder="A domain (github.com) or IP address (1.1.1.1)"
          aria-label="Domain or IP"
        />
        <button className="btn btn-primary" onClick={run} disabled={loading || !target.trim()}>
          {loading ? 'Scanning' : 'Recon'}
        </button>
      </div>
      <div className="note" style={{ marginTop: 10 }}>
        Infrastructure recon on public data only: Certificate Transparency logs, DNS, Shodan InternetDB, and the Wayback Machine. Every result links to its source.
      </div>

      {error ? <div className="error" style={{ marginTop: 18 }}>{error}</div> : null}
      {loading ? (
        <div className="progress" style={{ marginTop: 18 }}>
          <div className="bar"><span /></div>
          <div className="msg">Running connectors across public sources</div>
        </div>
      ) : null}

      {results ? (
        <div className="stack" style={{ paddingTop: 22 }}>
          {results.map((r) => (
            <ResultCard key={r.connector} r={r} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
