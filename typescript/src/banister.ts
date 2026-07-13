/**
 * Banister fitness-fatigue (impulse-response) model — TS port of soma
 * training_engine/banister.py. Verified against scipy in Phase-0 ST3.
 *
 * p(t) = p0 + k1·Σ load·e^(-(t-i)/tau1) - k2·Σ load·e^(-(t-i)/tau2)
 * Fit: differential evolution over 5 params + a Nelder-Mead polish
 * (matches scipy's differential_evolution + polish; naive DE undershoots).
 */
export interface BanisterParams {
  p0: number; k1: number; k2: number; tau1: number; tau2: number;
}
export const DEFAULT_PARAMS: BanisterParams = { p0: 45.0, k1: 0.05, k2: 0.08, tau1: 42, tau2: 7 };

export type DailyLoad = [dayIndex: number, load: number];
export interface Anchor { day_index: number; vdot: number; }

/** Predict performance (VDOT) at a target day. */
export function banisterPredict(p: BanisterParams, dailyLoads: DailyLoad[], targetDay: number): number {
  let fit = 0, fat = 0;
  for (const [di, load] of dailyLoads) {
    const dt = targetDay - di;
    if (dt <= 0) continue;
    fit += load * Math.exp(-dt / p.tau1);
    fat += load * Math.exp(-dt / p.tau2);
  }
  return p.p0 + p.k1 * fit - p.k2 * fat;
}

// Deterministic PRNG (mulberry32, seed 42) so fits are reproducible like scipy(seed=42).
function makeRng(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fit Banister params to anchor VDOTs (recency-weighted). tau1 must exceed tau2+10. */
export function fitBanister(
  dailyLoads: DailyLoad[],
  anchors: Anchor[],
  opts: { maxIterations?: number; recencyHalflifeDays?: number } = {},
): BanisterParams {
  if (anchors.length < 2) return { ...DEFAULT_PARAMS };

  const gen = opts.maxIterations ?? 1000;
  const halflife = opts.recencyHalflifeDays ?? 365;
  const maxDay = Math.max(...anchors.map((a) => a.day_index));
  const ln2 = Math.log(2);
  const weights = anchors.map((a) => Math.exp((-ln2 * (maxDay - a.day_index)) / halflife));

  const bounds: Array<[number, number]> = [[30, 55], [0.001, 5], [0.001, 10], [30, 80], [3, 15]];
  const clip = (x: number[]) => x.map((v, j) => Math.min(bounds[j][1], Math.max(bounds[j][0], v)));
  const obj = (x: number[]): number => {
    if (x[3] <= x[4] + 10) return 1e10; // tau1 > tau2 + 10 penalty
    const p: BanisterParams = { p0: x[0], k1: x[1], k2: x[2], tau1: x[3], tau2: x[4] };
    let wsse = 0;
    anchors.forEach((a, i) => { const d = banisterPredict(p, dailyLoads, a.day_index) - a.vdot; wsse += weights[i] * d * d; });
    return wsse;
  };

  const rng = makeRng(42);
  const D = 5, NP = 15 * D, CR = 0.9;
  let pop = Array.from({ length: NP }, () => bounds.map(([lo, hi]) => lo + rng() * (hi - lo)));
  let fitv = pop.map(obj);
  let best = 0;
  for (let i = 1; i < NP; i++) if (fitv[i] < fitv[best]) best = i;
  for (let g = 0; g < gen; g++) {
    const F = 0.5 + rng() * 0.5; // dithered mutation (scipy default)
    for (let i = 0; i < NP; i++) {
      let a, b, c;
      do { a = Math.floor(rng() * NP); } while (a === i);
      do { b = Math.floor(rng() * NP); } while (b === i || b === a);
      do { c = Math.floor(rng() * NP); } while (c === i || c === a || c === b);
      const R = Math.floor(rng() * D);
      const trial = clip(pop[i].map((v, j) => (rng() < CR || j === R ? pop[best][j] + F * (pop[a][j] - pop[b][j]) : v)));
      const ft = obj(trial);
      if (ft < fitv[i]) { pop[i] = trial; fitv[i] = ft; if (ft < fitv[best]) best = i; }
    }
  }
  const polished = nelderMead(obj, pop[best], clip);
  return { p0: polished[0], k1: polished[1], k2: polished[2], tau1: polished[3], tau2: polished[4] };
}

/** Local polish (matches scipy's polish=True), so the fit reaches scipy-quality WSSE. */
function nelderMead(f: (x: number[]) => number, x0: number[], clip: (x: number[]) => number[]): number[] {
  const n = x0.length;
  let simplex = [x0.slice()];
  for (let i = 0; i < n; i++) { const p = x0.slice(); p[i] += p[i] !== 0 ? 0.05 * Math.abs(p[i]) : 0.01; simplex.push(p); }
  let fv = simplex.map(f);
  for (let it = 0; it < 2000; it++) {
    const ord = [...fv.keys()].sort((a, b) => fv[a] - fv[b]);
    simplex = ord.map((i) => simplex[i]); fv = ord.map((i) => fv[i]);
    const cen = x0.map((_, j) => simplex.slice(0, n).reduce((s, p) => s + p[j], 0) / n);
    const ref = clip(cen.map((c, j) => c + (c - simplex[n][j])));
    const fr = f(ref);
    if (fr < fv[0]) {
      const exp = clip(cen.map((c, j) => c + 2 * (c - simplex[n][j]))); const fe = f(exp);
      if (fe < fr) { simplex[n] = exp; fv[n] = fe; } else { simplex[n] = ref; fv[n] = fr; }
    } else if (fr < fv[n - 1]) { simplex[n] = ref; fv[n] = fr; }
    else {
      const con = clip(cen.map((c, j) => c + 0.5 * (simplex[n][j] - c))); const fc = f(con);
      if (fc < fv[n]) { simplex[n] = con; fv[n] = fc; }
      else { for (let i = 1; i <= n; i++) { simplex[i] = clip(simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j]))); fv[i] = f(simplex[i]); } }
    }
  }
  const bi = fv.indexOf(Math.min(...fv));
  return simplex[bi];
}
