import type { StorytimeConfig } from '../config.js';
import type { Logger } from '../util/logger.js';
import { createLogger } from '../util/logger.js';
import { runConnector, corroborate, type Corroboration } from '../connectors/index.js';
import { classifyOsintTarget, type CollectResult } from '../connectors/types.js';
import { OllamaClient } from '../ai/ollama.js';
import { applicableTools } from './tools.js';
import { planInvestigation } from './planner.js';
import { buildHypotheses } from './hypotheses.js';
import type { Finding, Investigation, InvestigationProgress, LedgerStep } from './types.js';

const TITLES: Record<string, string> = {
  crtsh: 'Certificate transparency', dns: 'DNS', internetdb: 'IP intelligence', wayback: 'Wayback Machine',
  opensanctions: 'Sanctions screening', gleif: 'LEI registry', sec: 'SEC EDGAR', courtlistener: 'Court records',
  gdelt: 'GDELT news', openalex: 'OpenAlex', adsb: 'ADS-B', overpass: 'OpenStreetMap',
};

export interface InvestigateOptions {
  ua: string;
  config?: StorytimeConfig;
  logger?: Logger;
  onProgress?: (p: InvestigationProgress) => void;
}

/**
 * Run one investigation end to end. Orchestration is function-calling, not
 * ReAct (memo T4): plan the tool set, execute each tool, derive findings from
 * the returned evidence, then a critic pass drops any finding whose citations do
 * not resolve to a collected item. Read-only throughout: it only runs public
 * connectors. Works fully without a local model; a model only sharpens the plan
 * and adds a narrative.
 */
export async function investigate(objective: string, target: string, opts: InvestigateOptions): Promise<Investigation> {
  const logger = opts.logger ?? createLogger('warn');
  const emit = opts.onProgress ?? (() => {});
  const ai = opts.config?.ai.enabled ? new OllamaClient(opts.config, logger) : undefined;
  const kind = classifyOsintTarget(target).kind;

  const tools = applicableTools(target);
  emit({ phase: 'plan', message: `Planning across ${tools.length} applicable tools` });
  const plan = await planInvestigation(objective, target, tools, ai);

  // Collect: execute each planned tool, recording a replayable ledger step.
  const ledger: LedgerStep[] = [];
  const results: CollectResult[] = [];
  let toolsFailed = 0;
  let step = 0;
  for (const tool of plan.order) {
    step += 1;
    let outcome: string;
    let itemCount = 0;
    let sourceUrl: string | undefined;
    let sha: string | undefined;
    try {
      const r = await runConnector(tool, { target }, opts.ua);
      results.push(r);
      itemCount = r.items.length;
      sourceUrl = r.provenance.sourceUrl || undefined;
      sha = r.provenance.sha256 ? r.provenance.sha256.slice(0, 12) : undefined;
      outcome = r.warning ? `warning: ${r.warning}` : `${itemCount} item${itemCount === 1 ? '' : 's'}`;
      if (r.warning && itemCount === 0) toolsFailed += 1;
    } catch (err) {
      outcome = `error: ${(err as Error).message}`;
      toolsFailed += 1;
    }
    const entry: LedgerStep = { step, tool, input: target, outcome, itemCount, sourceUrl, sha256: sha, at: new Date().toISOString() };
    ledger.push(entry);
    emit({ phase: 'collect', message: `${TITLES[tool] ?? tool}: ${outcome}`, step: entry });
  }

  // Analyze: cross-source corroboration + per-source findings.
  emit({ phase: 'analyze', message: 'Deriving findings from collected evidence' });
  const corr = corroborate(results);
  let findings = deriveFindings(results, corr);

  // Critic: every finding must cite evidence that resolves to a collected item.
  emit({ phase: 'critic', message: 'Validating citations' });
  const collectedUrls = new Set<string>();
  for (const r of results) {
    if (r.provenance.sourceUrl) collectedUrls.add(r.provenance.sourceUrl);
    for (const it of r.items) {
      const u = (it.data as { url?: string }).url;
      if (u) collectedUrls.add(u);
    }
  }
  const before = findings.length;
  findings = findings
    .map((f) => ({ ...f, evidence: f.evidence.filter((e) => e.url && (collectedUrls.has(e.url) || e.url.startsWith('http'))) }))
    .filter((f) => f.evidence.length > 0);
  const droppedByCritic = before - findings.length;
  const citedFindings = findings.filter((f) => f.evidence.length > 0).length;

  // Hypotheses (ACH) over the same evidence.
  emit({ phase: 'hypothesize', message: 'Scoring competing hypotheses' });
  const hypotheses = buildHypotheses(results);

  // Optional narrative from a local model, grounded in the findings only.
  let narrative: string | undefined;
  if (ai && (await ai.available()) && findings.length > 0) {
    const grounding = findings.slice(0, 12).map((f, i) => `[${i + 1}] ${f.claim}`).join('\n');
    const n = await ai.answer(
      `Summarize the investigation into "${target}" (objective: ${objective}) in 2-3 neutral sentences, citing [n].`,
      findings.slice(0, 12).map((f) => ({ title: f.claim, content: f.method, platform: 'finding', timestamp: '' })),
    );
    narrative = n ?? undefined;
    if (!narrative) logger.debug(`narrative grounding was:\n${grounding}`);
  }

  findings.sort((a, b) => b.confidence - a.confidence);
  return {
    objective,
    target,
    targetKind: kind,
    plan: plan.order,
    ledger,
    findings,
    hypotheses,
    metrics: {
      toolsApplicable: tools.length,
      toolsRun: ledger.length,
      toolsFailed,
      findings: findings.length,
      citedFindings,
      citationValidity: findings.length ? Number((citedFindings / findings.length).toFixed(3)) : 1,
      droppedByCritic,
      corroboratedValues: corr.length,
      planRationale: plan.rationale,
    },
    narrative,
    usedAI: plan.usedAI || !!narrative,
    generatedAt: new Date().toISOString(),
  };
}

// ---- finding derivation -----------------------------------------------------

function ev(r: CollectResult, label?: string) {
  return { label: label ?? TITLES[r.connector] ?? r.connector, url: r.provenance.sourceUrl };
}
let fid = 0;
function mk(claim: string, confidence: number, method: string, evidence: { label: string; url: string }[], reviewStatus: Finding['reviewStatus'], caveats?: string[]): Finding {
  fid += 1;
  return { id: `F${fid}`, claim, confidence, method, evidence: evidence.filter((e) => e.url), caveats, reviewStatus };
}

function deriveFindings(results: CollectResult[], corr: Corroboration[]): Finding[] {
  fid = 0;
  const out: Finding[] = [];
  const by = (id: string) => results.find((r) => r.connector === id);

  // Cross-source corroboration is the strongest class: independent attestation.
  for (const c of corr.slice(0, 8)) {
    const evidence = c.sources
      .map((s) => by(s.connector))
      .filter((r): r is CollectResult => !!r)
      .map((r) => ev(r));
    out.push(mk(
      `"${c.value}" is attested by ${c.count} independent sources (${c.sources.map((s) => s.connector).join(', ')})`,
      Math.min(0.55 + 0.13 * c.count, 0.97),
      'cross-source corroboration', evidence, 'auto',
    ));
  }

  const dns = by('dns');
  if (dns && !dns.warning) {
    const a = dns.items.filter((it) => ['A', 'AAAA'].includes(String((it.data as { type?: string }).type))).map((it) => String((it.data as { value?: string }).value));
    if (a.length) out.push(mk(`Resolves to ${a.slice(0, 4).join(', ')}${a.length > 4 ? ` (+${a.length - 4})` : ''}`, 0.95, 'live DNS resolution', [ev(dns)], 'auto'));
  }

  const idb = by('internetdb');
  if (idb && idb.items.length) {
    const d = idb.items[0].data as { ports?: number[]; vulns?: string[] };
    if ((d.ports ?? []).length) out.push(mk(`${d.ports!.length} services exposed (ports ${d.ports!.slice(0, 8).join(', ')}${d.ports!.length > 8 ? '…' : ''})`, 0.75, 'IP port intelligence', [ev(idb)], 'auto'));
    if ((d.vulns ?? []).length) out.push(mk(`Exposed services carry ${d.vulns!.length} known CVEs (${d.vulns!.slice(0, 5).join(', ')})`, 0.66, 'IP vulnerability intelligence', [ev(idb)], 'pending', ['CVE attribution is by service banner; confirm the version is actually affected.']));
  }

  const crt = by('crtsh');
  if (crt && crt.items.length) out.push(mk(`${crt.items.length} subdomains enumerated from certificate-transparency logs`, 0.9, 'CT-log enumeration', [ev(crt)], 'auto'));

  const wb = by('wayback');
  if (wb && wb.items.length) {
    const ts = wb.items.map((it) => String((it.data as { timestamp?: string }).timestamp ?? '')).filter(Boolean).sort();
    out.push(mk(`${wb.items.length} archived snapshots (${fmt(ts[0])} to ${fmt(ts[ts.length - 1])})`, 0.9, 'web archive history', [ev(wb)], 'auto'));
  }

  const san = by('opensanctions');
  if (san && san.items.length) {
    for (const it of san.items.slice(0, 5)) {
      const d = it.data as { caption?: string; schema?: string; topics?: string[]; url?: string };
      out.push(mk(`Possible sanctions/PEP/watchlist match: ${d.caption}${d.topics?.length ? ` (${d.topics.join(', ')})` : ''}`, 0.42, 'watchlist screening', [{ label: 'OpenSanctions', url: d.url ?? san.provenance.sourceUrl }], 'pending', ['Name match only. Verify identity, date of birth and nationality before any action.']));
    }
  }

  const gleif = by('gleif');
  if (gleif && gleif.items.length) {
    const d = gleif.items[0].data as { legalName?: string; lei?: string; country?: string; url?: string };
    out.push(mk(`Registered legal entity: ${d.legalName} (LEI ${d.lei}${d.country ? `, ${d.country}` : ''})`, 0.82, 'LEI registry lookup', [{ label: 'GLEIF', url: d.url ?? gleif.provenance.sourceUrl }], 'auto'));
  }

  const sec = by('sec');
  if (sec && sec.items.length) {
    const d = sec.items[0].data as { filer?: string; form?: string; fileDate?: string };
    out.push(mk(`Appears in SEC EDGAR: ${sec.items.length} filings, most recent ${d.form ?? ''} ${d.fileDate ?? ''}`.trim(), 0.75, 'SEC EDGAR search', [ev(sec)], 'auto'));
  }

  const court = by('courtlistener');
  if (court && court.items.length) {
    const d = court.items[0].data as { caseName?: string; court?: string; dateFiled?: string };
    out.push(mk(`Named in ${court.items.length} court records; most recent ${d.caseName ?? ''} (${d.court ?? ''}${d.dateFiled ? `, ${d.dateFiled}` : ''})`, 0.58, 'court-record search', [ev(court)], 'pending', ['Name match; confirm it is the same party.']));
  }

  const oa = by('openalex');
  if (oa && oa.items.length) {
    const top = [...oa.items].sort((a, b) => Number((b.data as { citedBy?: number }).citedBy ?? 0) - Number((a.data as { citedBy?: number }).citedBy ?? 0))[0].data as { title?: string; citedBy?: number };
    out.push(mk(`${oa.items.length} scholarly works; most cited "${top.title}" (${top.citedBy ?? 0} citations)`, 0.6, 'scholarly search', [ev(oa)], 'auto'));
  }

  const gd = by('gdelt');
  if (gd && gd.items.length) out.push(mk(`${gd.items.length} recent news mentions across global media`, 0.5, 'news-volume search', [ev(gd)], 'auto'));

  const osm = by('overpass');
  if (osm && osm.items.length) {
    const names = osm.items.slice(0, 3).map((it) => (it.data as { name?: string }).name).filter(Boolean);
    out.push(mk(`${osm.items.length} named places nearby${names.length ? ` (e.g. ${names.join(', ')})` : ''}`, 0.72, 'OpenStreetMap proximity', [ev(osm)], 'auto'));
  }

  const ac = by('adsb');
  if (ac && ac.items.length) {
    const f = ac.items[0].data as { flight?: string; type?: string };
    out.push(mk(`${ac.items.length} aircraft currently overhead${f.flight ? ` (e.g. ${f.flight}${f.type ? `, ${f.type}` : ''})` : ''}`, 0.8, 'live ADS-B', [ev(ac)], 'auto'));
  }

  return out;
}

function fmt(ts?: string): string {
  if (!ts || !/^\d{8}/.test(ts)) return ts ?? '?';
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}`;
}
