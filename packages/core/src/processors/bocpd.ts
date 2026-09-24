/**
 * Bayesian online change-point detection (Adams & MacKay, 2007) for daily
 * counts, using a Poisson likelihood with a Gamma prior (negative-binomial
 * predictive). Detects regime changes even when the baseline itself shifts,
 * which the old fixed 3-sigma rule cannot. Deterministic, no dependencies.
 */

/** Lanczos log-gamma. */
function lgamma(x: number): number {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

const logNegBin = (x: number, a: number, b: number) =>
  lgamma(x + a) - lgamma(a) - lgamma(x + 1) + a * Math.log(b / (b + 1)) - x * Math.log(b + 1);

const lse = (xs: number[]) => {
  const m = Math.max(...xs);
  return m + Math.log(xs.reduce((s, x) => s + Math.exp(x - m), 0));
};

export interface ChangePoint {
  index: number; // day index into the input series
  confidence: number;
}

export function bocpd(
  counts: number[],
  hazard = 1 / 30,
  a0 = 1,
  b0 = 1,
  maxRun = 400,
): ChangePoint[] {
  if (counts.length < 4) return [];
  let logR = [0];
  let alpha = [a0];
  let beta = [b0];
  let prevMap = 0;
  const out: ChangePoint[] = [];
  const lh = Math.log(hazard);
  const l1h = Math.log(1 - hazard);

  counts.forEach((x, t) => {
    const pred = alpha.map((a, i) => logNegBin(x, a, beta[i]));
    const grow = logR.map((r, i) => r + pred[i] + l1h);
    const reset = lse(logR.map((r, i) => r + pred[i] + lh));
    let next = [reset, ...grow];
    const z = lse(next);
    next = next.map((v) => v - z);

    alpha = [a0, ...alpha.map((a) => a + x)];
    beta = [b0, ...beta.map((b) => b + 1)];
    if (next.length > maxRun) {
      next = next.slice(0, maxRun);
      alpha = alpha.slice(0, maxRun);
      beta = beta.slice(0, maxRun);
    }
    logR = next;

    const map = next.indexOf(Math.max(...next));
    if (t > 0 && map + 2 < prevMap) {
      const conf = next.slice(0, map + 1).reduce((s, v) => s + Math.exp(v), 0);
      out.push({ index: t - map, confidence: Number(conf.toFixed(3)) });
    }
    prevMap = map;
  });
  return out;
}
