import type { ClusterSummary, Insight } from '../types';

export function Findings({ clusters, insights }: { clusters?: ClusterSummary[]; insights?: Insight[] }) {
  const hasClusters = (clusters?.length ?? 0) > 0;
  const hasInsights = (insights?.length ?? 0) > 0;
  if (!hasClusters && !hasInsights) return null;

  return (
    <div className="findings-grid">
      {hasClusters && (
        <section className="panel">
          <h2 className="section-title">Themes</h2>
          {clusters!.slice(0, 7).map((c) => (
            <div className="finding" key={c.id}>
              <div className="count">{c.size}</div>
              <div className="body">
                <b>{c.label}</b>
                {c.summary ? <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>{c.summary}</div> : null}
              </div>
            </div>
          ))}
        </section>
      )}
      {hasInsights && (
        <section className="panel">
          <h2 className="section-title">Notable moments</h2>
          {insights!.slice(0, 7).map((i, idx) => (
            <div className="finding" key={idx}>
              <div className="count" style={{ color: i.type === 'sentiment_shift' ? 'var(--cool)' : 'var(--signal)' }}>
                {i.type === 'burst' ? '▲' : i.type === 'sentiment_shift' ? '◆' : '○'}
              </div>
              <div className="body">
                <b>{i.date}</b>
                <div style={{ color: 'var(--muted)', fontSize: 12.5 }}>{i.detail}</div>
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
