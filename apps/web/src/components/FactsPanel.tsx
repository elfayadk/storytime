import { useMemo, useState } from 'react';
import type { Fact } from '../types';

const VERB: Record<string, string> = {
  works_on: 'works on',
  maintains: 'maintains',
  released: 'released',
  wrote: 'wrote',
  edited: 'edited',
  answered_on: 'answers on',
  mentioned_place: 'mentioned',
  located_in: 'located in',
  joined: 'joined',
  left: 'left',
  announced: 'announced',
  said: 'said',
  reported: 'reported',
};

const day = (iso: string) => iso.slice(0, 10);

function validAt(f: Fact, asOf: string): boolean {
  if (f.invalidatedAt && f.invalidatedAt <= asOf) return false;
  if (f.validFrom > asOf) return false;
  if (f.validTo && f.validTo <= asOf) return false;
  return true;
}

export function FactsPanel({ facts }: { facts: Fact[] }) {
  const bounds = useMemo(() => {
    const dates = facts.map((f) => f.validFrom).sort();
    return dates.length ? { min: dates[0].slice(0, 10), max: new Date().toISOString().slice(0, 10) } : null;
  }, [facts]);
  const [asOf, setAsOf] = useState<string>('');
  const [travel, setTravel] = useState(false);

  const effectiveAsOf = travel && asOf ? `${asOf}T23:59:59Z` : '9999-12-31';
  const grouped = useMemo(() => {
    const visible = facts.filter((f) => validAt(f, effectiveAsOf));
    const m = new Map<string, Fact[]>();
    for (const f of visible) (m.get(f.subject) ?? m.set(f.subject, []).get(f.subject)!).push(f);
    const total = visible.length;
    const groups = new Map([...m.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 6));
    return { groups, total };
  }, [facts, effectiveAsOf]);

  if (facts.length === 0 || !bounds) return null;

  return (
    <section className="panel">
      <h2 className="section-title">
        Knowledge graph
        <span className="livecount">{grouped.total} facts</span>
      </h2>

      <div className="daterange" style={{ marginBottom: 14 }}>
        <button className="pill" data-on={travel} onClick={() => setTravel((v) => !v)}>
          <span className="dotmark" /> Time travel
        </button>
        {travel ? (
          <>
            <input type="date" min={bounds.min} max={bounds.max} value={asOf || bounds.max} onChange={(e) => setAsOf(e.target.value)} />
            <span className="drcount">as it was known on this date</span>
          </>
        ) : (
          <span className="drcount">what is true now</span>
        )}
      </div>

      {[...grouped.groups.entries()].map(([subject, subjectFacts]) => (
        <div key={subject} style={{ marginBottom: 12 }}>
          <div style={{ fontFamily: 'var(--serif)', fontWeight: 600, fontSize: 15, marginBottom: 4 }}>{subject}</div>
          {subjectFacts.slice(0, 12).map((f) => (
            <div className="finding" key={f.id}>
              <span
                className="count"
                title={`${Math.round(f.confidence * 100)}% confidence`}
                style={{ color: f.confidence >= 0.8 ? 'var(--pos)' : f.confidence >= 0.5 ? 'var(--signal)' : 'var(--muted)', fontSize: 12, minWidth: 18 }}
              >
                ●
              </span>
              <div className="body">
                <span>
                  {f.stance === 'reported' ? 'reportedly ' : ''}
                  <b>{VERB[f.predicate] ?? f.predicate}</b>
                  {f.object ? ` ${f.object}` : ''}
                </span>
                <span style={{ color: 'var(--faint)', fontFamily: 'var(--mono)', fontSize: 11, marginLeft: 8 }}>
                  {day(f.validFrom)}
                  {f.validTo ? ` to ${day(f.validTo)}` : ''}
                  {f.evidence[0] ? (
                    <>
                      {'  '}
                      <a href={f.evidence[0].url} target="_blank" rel="noopener">
                        source
                      </a>
                    </>
                  ) : null}
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
