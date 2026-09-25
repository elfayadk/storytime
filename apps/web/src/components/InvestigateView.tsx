import { useEffect, useRef, useState } from 'react';
import {
  runInvestigation,
  type Finding,
  type Hypothesis,
  type Investigation,
  type InvestigationProgress,
  type LedgerStep,
  type ResolvedEntity,
} from '../api';

const TOOL_LABEL: Record<string, string> = {
  crtsh: 'Certificate transparency', dns: 'DNS', internetdb: 'IP intelligence', wayback: 'Wayback Machine',
  opensanctions: 'Sanctions screening', gleif: 'LEI registry', sec: 'SEC EDGAR', courtlistener: 'Court records',
  gdelt: 'GDELT news', openalex: 'OpenAlex', adsb: 'ADS-B', overpass: 'OpenStreetMap', nominatim: 'Reverse geocode', socmint: 'Username presence', sentinel: 'Sentinel-2 imagery',
};

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

const KIND_LABEL: Record<string, string> = {
  domain: 'domain', ip: 'IP address', url: 'URL', email: 'identifier',
  handle: 'handle', geo: 'coordinates', unknown: 'name / organization',
};

/** The self-scored run metrics: the honest, verifiable slice of the memo's benchmark. */
function MetricsRibbon({ inv }: { inv: Investigation }) {
  const m = inv.metrics;
  const cells: { k: string; v: string; tone?: 'pos' | 'neg' | 'signal' }[] = [
    { k: 'tools run', v: `${m.toolsRun - m.toolsFailed}/${m.toolsApplicable}` },
    { k: 'findings', v: String(m.findings) },
    { k: 'citation validity', v: pct(m.citationValidity), tone: m.citationValidity >= 0.999 ? 'pos' : m.citationValidity >= 0.8 ? 'signal' : 'neg' },
    { k: 'corroborated', v: String(m.corroboratedValues), tone: m.corroboratedValues > 0 ? 'pos' : undefined },
    { k: 'dropped by critic', v: String(m.droppedByCritic), tone: m.droppedByCritic > 0 ? 'signal' : undefined },
  ];
  return (
    <div className="metrics-ribbon">
      {cells.map((c) => (
        <div className="metric" key={c.k}>
          <span className="metric-v" style={c.tone ? { color: `var(--${c.tone})` } : undefined}>{c.v}</span>
          <span className="metric-k">{c.k}</span>
        </div>
      ))}
    </div>
  );
}

/** ACH board: competing hypotheses scored by consistent vs inconsistent evidence. */
function HypothesisBoard({ hypotheses }: { hypotheses: Hypothesis[] }) {
  if (hypotheses.length === 0) return null;
  const max = Math.max(1, ...hypotheses.map((h) => Math.max(h.support, h.disconfirm)));
  return (
    <section className="panel">
      <h2 className="section-title">
        Competing hypotheses
        <span className="livecount">ACH</span>
      </h2>
      <div className="note" style={{ marginBottom: 14 }}>
        Each hypothesis is scored against the same evidence. The strongest is the one with the fewest
        inconsistencies, not the most confirmations. The leader is marked.
      </div>
      <div className="hypo-list">
        {hypotheses.map((h, i) => (
          <div className={`hypo ${i === 0 ? 'lead' : ''}`} key={h.id}>
            <div className="hypo-head">
              <span className="hypo-id">{h.id}</span>
              <b className="hypo-stmt">{h.statement}</b>
              {i === 0 ? <span className="hypo-lead-tag">least inconsistent</span> : null}
            </div>
            <div className="hypo-bars">
              <div className="hbar">
                <span className="hbar-label">consistent</span>
                <div className="hbar-track"><span style={{ width: pct(h.support / max), background: 'var(--pos)' }} /></div>
                <span className="hbar-n">{h.support}</span>
              </div>
              <div className="hbar">
                <span className="hbar-label">against</span>
                <div className="hbar-track"><span style={{ width: pct(h.disconfirm / max), background: 'var(--neg)' }} /></div>
                <span className="hbar-n">{h.disconfirm}</span>
              </div>
            </div>
            {h.note ? <div className="hypo-note">{h.note}</div> : null}
          </div>
        ))}
      </div>
    </section>
  );
}

const ID_LABEL: Record<string, string> = { lei: 'LEI', cik: 'CIK', ticker: 'ticker', domain: 'domain' };

/** Cross-source entity resolution: records that name the same real-world entity, merged. */
function EntitiesPanel({ entities }: { entities: ResolvedEntity[] }) {
  const multi = entities.filter((e) => e.sources.length > 1 || Object.keys(e.identifiers).length > 0);
  const shown = multi.length ? multi : entities;
  if (shown.length === 0) return null;
  return (
    <section className="panel">
      <h2 className="section-title">
        Resolved entities
        <span className="livecount">{shown.length}</span>
      </h2>
      <div className="note" style={{ marginBottom: 12 }}>
        Records from different sources that name the same organization or person, merged. Linked hard by a
        shared identifier, softly by matching names.
      </div>
      <div className="entity-list">
        {shown.map((e) => (
          <div className="entity" key={e.id}>
            <div className="ent-head">
              <b className="ent-name" dir="auto">{e.canonicalName}</b>
              <span className="ent-role">{e.role}</span>
              {e.sources.map((s) => <span className="ent-src" key={s}>{s}</span>)}
            </div>
            {Object.keys(e.identifiers).length ? (
              <div className="ent-ids">
                {Object.entries(e.identifiers).map(([k, v]) => (
                  <span className="ent-id" key={k}><span className="ent-id-k">{ID_LABEL[k] ?? k}</span> {v}</span>
                ))}
              </div>
            ) : null}
            {e.aliases.length ? <div className="ent-aliases">also: {e.aliases.slice(0, 5).join(' · ')}</div> : null}
            {e.links.length ? (
              <div className="ent-link">
                {e.links.map((l, i) => (
                  <span key={i} className={`ent-link-tag ${l.by}`}>{l.by === 'identifier' ? l.detail : l.by === 'name' ? 'same name' : 'similar name'}</span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function FindingCard({ f }: { f: Finding }) {
  const pending = f.reviewStatus === 'pending';
  return (
    <div className={`finding-card ${pending ? 'pending' : ''}`}>
      <div className="fc-head">
        <div className="conf" title={`confidence ${pct(f.confidence)}`}>
          <div className="conf-track"><span style={{ width: pct(f.confidence) }} /></div>
          <span className="conf-n">{pct(f.confidence)}</span>
        </div>
        <span className={`review-badge ${f.reviewStatus}`}>
          {pending ? 'needs analyst review' : 'auto'}
        </span>
      </div>
      <div className="fc-claim" dir="auto">{f.claim}</div>
      <div className="fc-method">{f.method}</div>
      {f.caveats?.length ? (
        <div className="fc-caveat">{f.caveats.join(' ')}</div>
      ) : null}
      <div className="fc-evidence">
        {f.evidence.map((e, i) => (
          <a className="cite" key={i} href={e.url} target="_blank" rel="noopener">
            {e.label}
          </a>
        ))}
      </div>
    </div>
  );
}

function Ledger({ steps }: { steps: LedgerStep[] }) {
  const [open, setOpen] = useState(false);
  if (steps.length === 0) return null;
  return (
    <section className="panel">
      <h2 className="section-title" style={{ cursor: 'pointer' }} onClick={() => setOpen((o) => !o)}>
        Investigation ledger
        <span className="livecount">{steps.length} calls</span>
        <span className="ledger-toggle">{open ? 'hide' : 'show'}</span>
      </h2>
      <div className="note" style={{ marginBottom: open ? 12 : 0 }}>
        Every tool call, in order, with the source and a content hash. Replayable and hash-checkable.
      </div>
      {open
        ? steps.map((s) => (
            <div className={`ledger-row ${s.outcome.startsWith('warning') || s.outcome.startsWith('error') ? 'miss' : ''}`} key={s.step}>
              <span className="lr-n">{String(s.step).padStart(2, '0')}</span>
              <span className="lr-tool">{TOOL_LABEL[s.tool] ?? s.tool}</span>
              <span className="lr-out">{s.outcome}</span>
              {s.sha256 ? <span className="lr-sha">{s.sha256}</span> : <span />}
              {s.sourceUrl ? (
                <a className="lr-src" href={s.sourceUrl} target="_blank" rel="noopener">source</a>
              ) : (
                <span />
              )}
            </div>
          ))
        : null}
    </section>
  );
}

export function InvestigateView({ initialTarget }: { initialTarget?: string }) {
  const [target, setTarget] = useState(initialTarget ?? '');
  const [objective, setObjective] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<string>('');
  const [live, setLive] = useState<LedgerStep[]>([]);
  const [inv, setInv] = useState<Investigation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const liveRef = useRef<LedgerStep[]>([]);
  const ran = useRef(false);

  const run = async () => {
    if (!target.trim() || loading) return;
    setLoading(true);
    setError(null);
    setInv(null);
    setLive([]);
    liveRef.current = [];
    setPhase('planning the investigation');
    try {
      const result = await runInvestigation(objective.trim() || `Investigate ${target.trim()}`, target.trim(), (p: InvestigationProgress) => {
        setPhase(p.message);
        if (p.step) {
          liveRef.current = [...liveRef.current, p.step];
          setLive(liveRef.current);
        }
      });
      setInv(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
      setPhase('');
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
      <div className="investigate-head">
        <input
          className="obj-input"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && run()}
          placeholder="What do you want to find out? (optional)"
          aria-label="Investigation objective"
        />
        <div className="field">
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run()}
            placeholder="A domain, IP, name / organization, or lat,lon"
            aria-label="Investigation target"
          />
          <button className="btn btn-primary" onClick={run} disabled={loading || !target.trim()}>
            {loading ? 'Working' : 'Investigate'}
          </button>
        </div>
      </div>
      <div className="note" style={{ marginTop: 10 }}>
        A local agent plans which public sources to consult, runs them, derives findings that each cite
        their evidence, drops any claim whose citation does not resolve, and scores competing hypotheses.
        Nothing is written anywhere. High-stakes findings are flagged for your review, not asserted.
      </div>

      {error ? <div className="error" style={{ marginTop: 18 }}>{error}</div> : null}

      {loading ? (
        <div className="investigate-live">
          <div className="progress" style={{ marginTop: 18 }}>
            <div className="bar"><span /></div>
            <div className="msg">{phase || 'Working'}</div>
          </div>
          {live.length ? (
            <div className="live-ledger">
              {live.map((s) => (
                <div className={`ll-row ${s.outcome.startsWith('warning') || s.outcome.startsWith('error') ? 'miss' : 'hit'}`} key={s.step}>
                  <span className="ll-tool">{TOOL_LABEL[s.tool] ?? s.tool}</span>
                  <span className="ll-out">{s.outcome}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {inv ? (
        <div className="stack" style={{ paddingTop: 22 }}>
          <section className="casefile">
            <div className="cf-objective">{inv.objective}</div>
            <div className="cf-meta">
              <span className="cf-target" dir="auto">{inv.target}</span>
              <span className="cf-kind">{KIND_LABEL[inv.targetKind] ?? inv.targetKind}</span>
              {inv.usedAI ? <span className="cf-ai">local model</span> : <span className="cf-ai off">no model, deterministic</span>}
            </div>
            <div className="cf-rationale">{inv.metrics.planRationale}</div>
            <MetricsRibbon inv={inv} />
          </section>

          {inv.narrative ? (
            <section className="panel">
              <h2 className="section-title">Assessment</h2>
              <p style={{ margin: 0, lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{inv.narrative}</p>
            </section>
          ) : null}

          <HypothesisBoard hypotheses={inv.hypotheses} />

          {inv.entities?.length ? <EntitiesPanel entities={inv.entities} /> : null}

          <section className="panel">
            <h2 className="section-title">
              Findings
              <span className="livecount">{inv.findings.length}</span>
            </h2>
            {inv.findings.length === 0 ? (
              <div className="note">No findings survived citation checking. The sources returned nothing that resolves to evidence.</div>
            ) : (
              <div className="findings-grid">
                {inv.findings.map((f) => (
                  <FindingCard key={f.id} f={f} />
                ))}
              </div>
            )}
          </section>

          <Ledger steps={inv.ledger} />
        </div>
      ) : null}
    </div>
  );
}
