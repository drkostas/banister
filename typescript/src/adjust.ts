/**
 * Pace adjustment: readiness and fatigue factors, the adjusted pace from
 * them, and how a day's adjustment propagates to each workout step's targets.
 * Mirrors the merge step of the Python training engine. Pure.
 */

/** The target fields a workout step carries; any richer step type fits. */
export interface StepTargets {
  target_pace_low?: number | null;
  target_pace_high?: number | null;
  target_hr_low?: number | null;
  target_hr_high?: number | null;
}

/** Default B-goal base pace: 284 sec/km (4:44/km). */
export const DEFAULT_BASE_PACE = 284.0;

/**
 * Map readiness z-score to pace adjustment factor.
 *
 * z <= -2  -> -1 (REST signal)
 * z = -1   -> 1.05 (5% slower)
 * z = 0    -> 1.00 (normal)
 * z >= +1  -> 0.97 (3% faster)
 *
 * Linear interpolation between anchor points.
 * Returns -1.0 as REST signal when z <= -2.
 */
export function readinessFactorCalc(z: number): number {
  if (z <= -2.0) return -1.0; // REST
  if (z >= 1.0) return 0.97;
  if (z >= 0.0) {
    // Linear: z=0 -> 1.00, z=1 -> 0.97 (slope = -0.03/unit)
    return 1.0 - 0.03 * z;
  }
  if (z >= -1.0) {
    // Linear: z=0 -> 1.00, z=-1 -> 1.05 (slope = -0.05/unit going negative)
    return 1.0 - 0.05 * z;
  }
  // z in (-2, -1): clamp at 1.05 (max slowdown before REST)
  return 1.05;
}

/**
 * Map TSB (Training Stress Balance) to pace adjustment factor.
 *
 * TSB >= +10  -> 0.98 (fresh, slightly faster)
 * TSB = 0     -> 1.00 (normal)
 * TSB <= -20  -> 1.03 (fatigued, slower)
 *
 * Linear interpolation between anchor points.
 */
export function fatigueFactorCalc(tsb: number): number {
  if (tsb >= 10.0) return 0.98;
  if (tsb <= -20.0) return 1.03;
  if (tsb >= 0.0) {
    // Linear: tsb=0 -> 1.00, tsb=10 -> 0.98 (slope = -0.002/unit)
    return 1.0 - 0.002 * tsb;
  }
  // tsb in (-20, 0): linear from 1.00 to 1.03 (slope = -0.0015/unit)
  return 1.0 - 0.0015 * tsb;
}

/**
 * Compute adjusted pace from all factors.
 *
 * Returns null if REST is indicated (readiness z <= -2).
 * Otherwise: basePace * (1 + delta * sliderFactor)
 * where delta = (readinessFactor * fatigueFactor * weightFactor) - 1.0
 */
export function computeAdjustedPace(
  basePace: number,
  readinessZ: number,
  tsb: number,
  weightFactor: number = 1.0,
  sliderFactor: number = 1.0,
): number | null {
  const rf = readinessFactorCalc(readinessZ);
  if (rf < 0) return null; // REST

  const ff = fatigueFactorCalc(tsb);
  const combined = rf * ff * weightFactor;
  const delta = combined - 1.0;
  const adjusted = 1.0 + delta * sliderFactor;
  return basePace * adjusted;
}

/**
 * Adjust per-step pace/HR targets when the slider changes training intensity.
 *
 * Pace targets are scaled proportionally: if the day-level adjusted pace is
 * 5% faster than the base, each step's pace window shifts 5% faster too.
 *
 * HR targets shift by a small absolute amount: harder effort → higher HR zones.
 *
 * @param steps - The normalized workout steps to adjust.
 * @param sliderFactor - The slider multiplier (1.0 = no change).
 * @param adjustedPaceSeconds - The day-level adjusted pace (sec/km).
 * @param basePaceSeconds - The day-level base pace before slider (sec/km).
 * @returns New array of steps with adjusted targets.
 */
export function adjustStepTargets<T extends StepTargets>(
  steps: T[],
  sliderFactor: number,
  adjustedPaceSeconds: number,
  basePaceSeconds: number,
): T[] {
  if (sliderFactor === 1.0 || !steps?.length) return steps;
  if (!basePaceSeconds || basePaceSeconds === 0) return steps;

  const paceRatio = adjustedPaceSeconds / basePaceSeconds;

  return steps.map((step) => {
    const adjusted = { ...step };

    // Scale pace targets proportionally
    if (step.target_pace_low != null) {
      adjusted.target_pace_low = Math.round(step.target_pace_low * paceRatio);
    }
    if (step.target_pace_high != null) {
      adjusted.target_pace_high = Math.round(step.target_pace_high * paceRatio);
    }

    // HR targets shift slightly (harder effort → higher HR)
    if (step.target_hr_low != null) {
      const hrShift = Math.round((sliderFactor - 1.0) * 10);
      adjusted.target_hr_low = step.target_hr_low + hrShift;
      adjusted.target_hr_high =
        (step.target_hr_high ?? step.target_hr_low + 15) + hrShift;
    }

    return adjusted;
  });
}
