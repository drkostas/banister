/**
 * Personal calibration — 4-phase readiness-weight progression. TS port of the
 * pure logic in soma training_engine/calibration.py.
 *
 * Phase 1 (<30d): equal weights (Dawes 1979 — unit weights beat regression at small n).
 * Phase 2 (>=30d): |Pearson r|-based weights.
 * Phase 3 (>=60d): LASSO (computed externally, passed in as lassoWeights).
 * Phase 4 (>=120d): Kalman placeholder — falls through to LASSO.
 *
 * compute_lasso_weights (sklearn) and advance_calibration (DB) live in the
 * consumer layer; this module owns the deterministic phase/correlation/selection logic.
 */

export const SIGNAL_NAMES = ["hrv", "sleep", "rhr", "bb"] as const;
export type SignalName = (typeof SIGNAL_NAMES)[number];

export type Weights = Record<SignalName, number>;
export const EQUAL_WEIGHTS: Weights = { hrv: 0.25, sleep: 0.25, rhr: 0.25, bb: 0.25 };

const Z_TO_SIGNAL: Record<string, SignalName> = {
  hrv_z: "hrv",
  sleep_z: "sleep",
  rhr_z: "rhr",
  bb_z: "bb",
};

export interface CalibrationState {
  phase: number;
  dataDays: number;
  weights: Weights;
  correlations?: Record<SignalName, number> | null;
  forceEqual?: boolean;
}

/** Calibration phase from available data days (<30→1, >=30→2, >=60→3, >=120→4). */
export function getCurrentPhase(dataDays: number): number {
  if (dataDays >= 120) return 4;
  if (dataDays >= 60) return 3;
  if (dataDays >= 30) return 2;
  return 1;
}

/** Pearson correlation coefficient between two equal-length series. */
export function pearsonR(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0.0;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let cov = 0, varX = 0, varY = 0;
  for (let i = 0; i < n; i++) {
    cov += (x[i] - meanX) * (y[i] - meanY);
    varX += (x[i] - meanX) ** 2;
    varY += (y[i] - meanY) ** 2;
  }
  const denom = Math.sqrt(varX * varY);
  return denom === 0.0 ? 0.0 : cov / denom;
}

/**
 * Within-individual Pearson r between each signal and session quality.
 * Keys of `signals` are z-score names (hrv_z, sleep_z, rhr_z, bb_z).
 * Requires >= 10 paired points per signal, else 0.0 for that signal.
 */
export function computeCorrelations(
  signals: Partial<Record<string, number[]>>,
  sessionQuality: number[],
): Record<SignalName, number> {
  const result = {} as Record<SignalName, number>;
  for (const [zKey, sigName] of Object.entries(Z_TO_SIGNAL)) {
    const values = signals[zKey] ?? [];
    const n = Math.min(values.length, sessionQuality.length);
    if (n < 10) { result[sigName] = 0.0; continue; }
    result[sigName] = pearsonR(values.slice(0, n), sessionQuality.slice(0, n));
  }
  return result;
}

/** Normalise |r| values to weights summing to 1.0 (all |r|<0.01 → equal weights). */
function absRWeights(correlations: Record<SignalName, number>): Weights {
  const absVals = {} as Weights;
  for (const k of SIGNAL_NAMES) absVals[k] = Math.abs(correlations[k] ?? 0);
  if (SIGNAL_NAMES.every((k) => absVals[k] < 0.01)) return { ...EQUAL_WEIGHTS };
  const total = SIGNAL_NAMES.reduce((s, k) => s + absVals[k], 0);
  const out = {} as Weights;
  for (const k of SIGNAL_NAMES) out[k] = absVals[k] / total;
  return out;
}

/**
 * Active weight set for a calibration phase.
 * force_equal → equal; P1 → equal; P2 → |r| (fallback equal); P3+ → LASSO
 * (fallback correlation, fallback equal).
 */
export function getActiveWeights(
  phase: number,
  correlations?: Record<SignalName, number> | null,
  lassoWeights?: Weights | null,
  forceEqual = false,
): Weights {
  if (forceEqual) return { ...EQUAL_WEIGHTS };
  if (phase <= 1) return { ...EQUAL_WEIGHTS };
  if (phase === 2) return correlations ? absRWeights(correlations) : { ...EQUAL_WEIGHTS };
  // Phase 3 and 4
  if (lassoWeights) return { ...lassoWeights };
  if (correlations) return absRWeights(correlations);
  return { ...EQUAL_WEIGHTS };
}
