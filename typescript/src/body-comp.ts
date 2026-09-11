/**
 * Body-comp stream — TS port of sync/src/training_engine/body_comp_stream.py.
 * Smooths weight with a 7-day EMA and derives a weight-adjusted VDOT + race
 * prediction, upserted into fitness_trajectory. Pure EMA + one DB step; reuses
 * the ported vdot helpers. Stage: training engine (#187). DB-only.
 *
 * VDOT_adj = VDOT_base × (calibration_weight / current_weight): lighter = faster.
 */
import { adjustVdotForWeight, timeFromVdot } from "./vdot";

const HM_DISTANCE_M = 21097.5;

/**
 * Python round() parity. toFixed matches CPython's round-half-to-even
 * everywhere EXCEPT an exact binary tie (e.g. 80.125 → toFixed 80.13, Python
 * 80.12). Clean weight inputs can produce such a tie, so detect it (x·2·10^n is
 * an odd integer) and round half to even; otherwise delegate to toFixed.
 */
const r = (x: number, n: number): number => {
  const m = 10 ** n;
  const twice = x * 2 * m;
  if (Number.isInteger(twice) && Math.abs(twice) % 2 === 1) {
    const floor = Math.floor(x * m);
    return (floor % 2 === 0 ? floor : floor + 1) / m; // ties to even
  }
  return Number(x.toFixed(n));
};

// Athlete's weight at the VDOT 47 calibration (5K PR, 2026-03-07).
export const DEFAULT_CALIBRATION_WEIGHT_KG = 80.5;

export interface WeightEmaPoint { date: string; weight_raw: number; weight_ema: number; }

/** Exponential moving average of (date, weight) pairs; alpha = 2/(span+1). */
export function computeWeightEma(weights: Array<[string, number]>, span = 7): WeightEmaPoint[] {
  const alpha = 2.0 / (span + 1);
  const results: WeightEmaPoint[] = [];
  let ema: number | null = null;
  for (const [dt, w] of weights) {
    ema = ema === null ? w : w * alpha + ema * (1 - alpha);
    results.push({ date: dt, weight_raw: w, weight_ema: r(ema, 2) });
  }
  return results;
}

export interface BodyComp {
  date: string;
  weight_kg: number;
  weight_raw: number;
  vdot_base: number | null;
  vdot_adjusted: number | null;
  race_prediction_seconds: number | null;
  calibration_weight_kg: number;
  ema_points: number;
}
