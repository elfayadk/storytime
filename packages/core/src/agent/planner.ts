import type { OllamaClient } from '../ai/ollama.js';
import type { ToolSpec } from './tools.js';

export interface Plan {
  order: string[];
  rationale: string;
  usedAI: boolean;
}

/**
 * Decide which tools to run and in what order. Deterministic by default: run
 * cheap infrastructure/registry lookups before slow or heavy ones. When a local
 * model is available it may re-order and narrow the set, but ONLY within the
 * applicable tools; any tool name the model returns that is not in the legal set
 * is discarded (the anti-hallucination guard). Function-calling selection, never
 * ReAct free-text.
 */
const COST: Record<string, number> = {
  dns: 1, internetdb: 1, gleif: 2, sec: 2, opensanctions: 2, openalex: 3,
  courtlistener: 3, adsb: 3, nominatim: 3, sentinel: 4, gdelt: 4, wayback: 5,
  overpass: 6, crtsh: 7, socmint: 7, darkweb: 9,
};

export async function planInvestigation(
  objective: string,
  target: string,
  tools: ToolSpec[],
  ai?: OllamaClient,
): Promise<Plan> {
  const legal = tools.map((t) => t.name);
  const deterministic = [...legal].sort((a, b) => (COST[a] ?? 5) - (COST[b] ?? 5));

  if (!ai || !(await ai.available())) {
    return {
      order: deterministic,
      rationale: `Ran every applicable source for ${describe(tools)}, cheapest first.`,
      usedAI: false,
    };
  }

  const menu = tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');
  const raw = await ai.generateJSON(
    `You are planning an OSINT investigation. Objective: "${objective}". Target: "${target}".\n` +
      `Available tools:\n${menu}\n\n` +
      `Return ONLY a JSON object {"order":[tool names, most useful first],"rationale":"one sentence"}. ` +
      `Use only the tool names listed. Include every tool that could contribute.`,
  );

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { order?: unknown; rationale?: unknown };
      const picked = Array.isArray(parsed.order)
        ? (parsed.order as unknown[]).map(String).filter((n) => legal.includes(n))
        : [];
      // Never let the model silently drop applicable tools: append the rest.
      const order = [...new Set([...picked, ...deterministic])];
      if (picked.length > 0) {
        return {
          order,
          rationale: typeof parsed.rationale === 'string' && parsed.rationale.trim()
            ? parsed.rationale.trim()
            : `Model-ordered ${order.length} tools for the objective.`,
          usedAI: true,
        };
      }
    } catch {
      /* fall through to deterministic */
    }
  }
  return {
    order: deterministic,
    rationale: `Ran every applicable source for ${describe(tools)}, cheapest first.`,
    usedAI: false,
  };
}

function describe(tools: ToolSpec[]): string {
  const domains = [...new Set(tools.map((t) => t.domain))];
  return domains.join(', ') || 'this target';
}
