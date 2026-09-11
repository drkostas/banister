/**
 * Fitness stream — TS port of sync/src/training_engine/fitness_stream.py.
 * VO2max trend, pace:HR decoupling, efficiency factor, and a VDOT-derived
 * half-marathon race prediction → fitness_trajectory (a table the dashboard
 * graphs). Pure metric helpers + one DB step. Stage: training engine (#187).
 *
 * EF = speed / HR; decoupling = (EF_first − EF_second) / EF_first × 100.
 */
import { timeFromVdot } from "./vdot";

const HM_DISTANCE_M = 21097.5;
const r = (x: number, n: number) => Number(x.toFixed(n));

/** EF = (1/pace) / HR. Higher = more efficient. 0 when inputs non-positive. */
export function computeEfficiencyFactor(paceSecPerKm: number, avgHr: number): number {
  if (paceSecPerKm <= 0 || avgHr <= 0) return 0.0;
  const speed = 1.0 / paceSecPerKm; // km/sec
  return speed / avgHr;
}

export interface Half { pace_sec_km: number; avg_hr: number; }

/** Pace:HR decoupling % between two halves (positive = cardiac drift). */
export function computeDecoupling(firstHalf: Half, secondHalf: Half): number {
  const ef1 = computeEfficiencyFactor(firstHalf.pace_sec_km, firstHalf.avg_hr);
  const ef2 = computeEfficiencyFactor(secondHalf.pace_sec_km, secondHalf.avg_hr);
  if (ef1 === 0) return 0.0;
  return ((ef1 - ef2) / ef1) * 100;
}

/** Extract VO2max from Garmin max_metrics raw (list or dict; generic or top-level). */
export function extractVo2max(raw: unknown): number | null {
  const fromItem = (item: any): number | null => {
    if (!item || typeof item !== "object") return null;
    const generic = item.generic;
    if (generic && typeof generic === "object" && generic.vo2MaxPreciseValue != null) {
      return Number(generic.vo2MaxPreciseValue);
    }
    if (item.vo2MaxPreciseValue != null) return Number(item.vo2MaxPreciseValue);
    return null;
  };
  if (Array.isArray(raw)) {
    for (const item of raw) { const v = fromItem(item); if (v !== null) return v; }
    return null;
  }
  if (raw && typeof raw === "object") return fromItem(raw);
  return null;
}

/** Aggregate laps into a single {pace_sec_km, avg_hr}, or null if insufficient. */
export function aggregateLaps(laps: any[]): Half | null {
  let totalDistanceM = 0.0, totalDurationS = 0.0, hrWeightedSum = 0.0;
  for (const lap of laps) {
    const distance = lap.distance || 0;
    const duration = lap.duration || lap.elapsedDuration || 0;
    const avgHr = lap.averageHR || lap.averageHeartRate || 0;
    if (distance > 0 && duration > 0 && avgHr > 0) {
      totalDistanceM += distance;
      totalDurationS += duration;
      hrWeightedSum += avgHr * duration;
    }
  }
  if (totalDistanceM <= 0 || totalDurationS <= 0 || hrWeightedSum <= 0) return null;
  return {
    pace_sec_km: totalDurationS / (totalDistanceM / 1000.0),
    avg_hr: hrWeightedSum / totalDurationS,
  };
}

/** Split raw Garmin splits into first/second-half aggregates, or null. */
export function splitIntoHalves(splitsRaw: any): [Half, Half] | null {
  let laps: any[] = [];
  if (splitsRaw && !Array.isArray(splitsRaw) && typeof splitsRaw === "object") {
    laps = splitsRaw.lapDTOs || splitsRaw.splitSummaries || [];
  } else if (Array.isArray(splitsRaw)) {
    laps = splitsRaw;
  }
  if (laps.length < 2) return null;
  const mid = Math.floor(laps.length / 2);
  const firstHalf = aggregateLaps(laps.slice(0, mid));
  const secondHalf = aggregateLaps(laps.slice(mid));
  if (firstHalf === null || secondHalf === null) return null;
  return [firstHalf, secondHalf];
}

export interface FitnessTrajectory {
  date: string;
  vo2max: number | null;
  efficiency_factor: number | null;
  decoupling_pct: number | null;
  weight_kg: number | null;
  race_prediction_seconds: number | null;
}
