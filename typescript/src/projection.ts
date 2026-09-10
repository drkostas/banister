/**
 * Banister impulse-response projection over date-keyed daily loads.
 *
 * `banister.ts` fits and predicts over day indices; this module projects a
 * VDOT time-series over calendar dates (YYYY-MM-DD), which is what a
 * trajectory chart or a forward simulation feeds it. Pure functions: no DB,
 * no side effects. Shares `BanisterParams` with the fit.
 *
 * The classic Banister formula:
 *   p(t) = p0 + k1 * Σ(w(i) * exp(-(t-i)/τ1)) - k2 * Σ(w(i) * exp(-(t-i)/τ2))
 *
 * References:
 *   - Banister, E.W. (1991). "Modeling elite athletic performance."
 *   - Busso, T. (2003). "Variable dose-response relationship."
 */
import type { BanisterParams } from "./banister";

export type { BanisterParams };

/** A day's training load, keyed by calendar date. */
export interface DatedLoad {
  date: string; // YYYY-MM-DD
  load: number;
}

// ── Defaults ──────────────────────────────────────────────────

export const DEFAULT_BANISTER: BanisterParams = {
  p0: 47.0, // Should be overridden with actual current VO2max
  k1: 0.1,
  k2: 0.1,
  tau1: 42,
  tau2: 7,
};

// ── Helpers ───────────────────────────────────────────────────

/** Compute days between two YYYY-MM-DD date strings (b - a). */
function daysBetween(a: string, b: string): number {
  const msA = new Date(a + "T00:00:00").getTime();
  const msB = new Date(b + "T00:00:00").getTime();
  return Math.round((msB - msA) / 86_400_000);
}

// ── Core projection ───────────────────────────────────────────

/**
 * Project a VDOT time-series using the Banister impulse-response model.
 *
 * @param loads  Chronologically sorted array of daily loads.
 * @param params Banister model parameters.
 * @returns      Parallel array of projected VDOT values (one per load entry),
 *               each rounded to 1 decimal place.
 */
export function projectVdotSeries(
  loads: DatedLoad[],
  params: BanisterParams,
): number[] {
  const { p0, k1, k2, tau1, tau2 } = params;
  const result: number[] = [];

  for (let t = 0; t < loads.length; t++) {
    let fitnessSum = 0;
    let fatigueSum = 0;

    for (let i = 0; i < t; i++) {
      const dt = daysBetween(loads[i].date, loads[t].date);
      if (dt <= 0) continue;

      const w = loads[i].load;
      fitnessSum += w * Math.exp(-dt / tau1);
      fatigueSum += w * Math.exp(-dt / tau2);
    }

    const vdot = p0 + k1 * fitnessSum - k2 * fatigueSum;
    result.push(Math.round(vdot * 10) / 10);
  }

  return result;
}

/**
 * Project fitness-only VDOT series (no fatigue term).
 *
 * Returns p0 + k1 * Σ(w(i) * exp(-(t-i)/τ1)) — the "performance potential"
 * representing what the athlete could achieve with fresh legs.
 *
 * Use this for trajectory charts. Daily fatigue oscillation is handled
 * separately by forward simulation merge factors (readiness, TSB).
 *
 * @param loads  Chronologically sorted array of daily loads.
 * @param params Banister model parameters.
 * @returns      Parallel array of projected fitness-only VDOT values.
 */
export function projectFitnessOnlySeries(
  loads: DatedLoad[],
  params: BanisterParams,
): number[] {
  const { p0, k1, tau1 } = params;
  const result: number[] = [];

  for (let t = 0; t < loads.length; t++) {
    let fitnessSum = 0;

    for (let i = 0; i < t; i++) {
      const dt = daysBetween(loads[i].date, loads[t].date);
      if (dt <= 0) continue;

      const w = loads[i].load;
      fitnessSum += w * Math.exp(-dt / tau1);
    }

    const vdot = p0 + k1 * fitnessSum;
    result.push(Math.round(vdot * 10) / 10);
  }

  return result;
}

/**
 * Project VDOT at a single target date.
 *
 * @param loads      Chronologically sorted array of daily loads.
 * @param params     Banister model parameters.
 * @param targetDate YYYY-MM-DD date to project for.
 * @returns          Projected VDOT, or p0 if targetDate is not found in loads.
 */
export function projectVdotAt(
  loads: DatedLoad[],
  params: BanisterParams,
  targetDate: string,
): number {
  const { p0, k1, k2, tau1, tau2 } = params;

  let fitnessSum = 0;
  let fatigueSum = 0;
  let hasContribution = false;

  for (const entry of loads) {
    const dt = daysBetween(entry.date, targetDate);
    if (dt <= 0) continue; // same-day or future loads don't contribute

    fitnessSum += entry.load * Math.exp(-dt / tau1);
    fatigueSum += entry.load * Math.exp(-dt / tau2);
    hasContribution = true;
  }

  if (!hasContribution) return p0;

  const vdot = p0 + k1 * fitnessSum - k2 * fatigueSum;
  return Math.round(vdot * 10) / 10;
}
