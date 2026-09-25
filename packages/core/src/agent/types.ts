import type { ResolvedEntity } from '../connectors/entities.js';
export type { ResolvedEntity } from '../connectors/entities.js';

/**
 * Agentic investigation layer (upgrade pack doc 04 / memo T2, T4, T10).
 * Design choices, per the research the memo cites:
 *  - function-calling / playbook orchestration, NOT ReAct (hallucinations cluster
 *    under ReAct; AgentArch);
 *  - analyst-in-the-loop: the agent proposes, findings carry a reviewStatus, and
 *    high-stakes claims default to 'pending';
 *  - a replayable ledger of every tool call for reproducibility;
 *  - a critic pass that drops any finding without evidence;
 *  - read-only: the agent only runs public-data connectors.
 */
export interface LedgerStep {
  step: number;
  tool: string;
  input: string;
  outcome: string;
  itemCount: number;
  sourceUrl?: string;
  sha256?: string;
  at: string;
}

export interface Finding {
  id: string;
  claim: string;
  confidence: number;
  method: string;
  evidence: { label: string; url: string }[];
  caveats?: string[];
  reviewStatus: 'auto' | 'pending' | 'approved' | 'rejected';
}

/** ACH: a competing hypothesis scored by supporting vs disconfirming evidence. */
export interface Hypothesis {
  id: string;
  statement: string;
  support: number;
  disconfirm: number;
  note?: string;
}

/**
 * Self-scored run metrics (memo T10). We do not fake a labelled benchmark; we
 * report what is verifiable live: how many applicable tools ran, how many
 * findings carry resolvable evidence (citation validity), and corroboration
 * depth. Citation validity is the live proxy for a hallucination rate: a claim
 * whose citation does not resolve to a collected item is dropped by the critic.
 */
export interface InvestigationMetrics {
  toolsApplicable: number;
  toolsRun: number;
  toolsFailed: number;
  findings: number;
  citedFindings: number;
  citationValidity: number; // citedFindings / findings, 0..1
  droppedByCritic: number;
  corroboratedValues: number;
  planRationale: string;
}

export interface Investigation {
  objective: string;
  target: string;
  targetKind: string;
  plan: string[];
  ledger: LedgerStep[];
  findings: Finding[];
  hypotheses: Hypothesis[];
  entities: ResolvedEntity[];
  metrics: InvestigationMetrics;
  narrative?: string;
  usedAI: boolean;
  generatedAt: string;
}

export interface InvestigationProgress {
  phase: 'plan' | 'collect' | 'analyze' | 'hypothesize' | 'critic' | 'done';
  message: string;
  step?: LedgerStep;
}
