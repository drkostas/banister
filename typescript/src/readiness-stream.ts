/**
 * Readiness stream. Ported from the Python training engine soma once carried; this is the source now.
 * Daily readiness (traffic light) from biometric z-scores vs a 28-day baseline:
 * HRV, sleep time, RHR (inverted), morning body battery. Equal-weight composite
 * (Dawes 1979) + hard overrides. Writes daily_readiness (dashboard reads it).
 * Pure scoring + one DB step. Stage: training engine (#187). DB-only.
 */

const r = (x: number, n: number) => Number(x.toFixed(n));

/** Population z-score of value vs baseline; 0.0 if <7 samples or zero std. */
export function zScore(value: number, baseline: number[]): number {
  if (baseline.length < 7) return 0.0;
  const n = baseline.length;
  const mean = baseline.reduce((a, b) => a + b, 0) / n;
  const variance = baseline.reduce((a, x) => a + (x - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  if (std === 0.0) return 0.0;
  return (value - mean) / std;
}

export interface ReadinessSignals {
  hrv_z: number | null;
  sleep_z: number | null;
  rhr_z: number | null;
  bb_z: number | null;
  /** Last night's sleep in hours; null when the night is missing (#647). */
  sleep_hours: number | null;
  body_battery_morning?: number | null;
}

/** "unknown" = last night is missing; never rendered as green. */
export type TrafficLight = "green" | "yellow" | "red" | "unknown";

export interface Readiness {
  hrv_z_score: number | null;
  sleep_z_score: number | null;
  rhr_z_score: number | null;
  body_battery_z_score: number | null;
  /** null when the light is unknown (no last-night inputs to score). */
  composite_score: number | null;
  traffic_light: TrafficLight;
  flags: string[];
}

/** Traffic-light readiness from signal z-scores + hard overrides. */
export function computeReadiness(signals: ReadinessSignals): Readiness {
  const { hrv_z, sleep_z, rhr_z, bb_z, sleep_hours } = signals;
  const bodyBatteryMorning = signals.body_battery_morning ?? null;

  // Equal-weight composite over non-null z-scores.
  const zValues = [hrv_z, sleep_z, rhr_z, bb_z].filter((z): z is number => z !== null && z !== undefined);
  const composite = zValues.length ? zValues.reduce((a, b) => a + b, 0) / zValues.length : 0.0;

  const flags: string[] = [];
  // Last night is the anchor of a readiness call. Without it (watch not worn, sleep
  // not synced) the light is "unknown" — never green by default (#647). Hard safety
  // overrides below can still force RED from the inputs that do exist.
  const unknown = sleep_hours === null || sleep_hours === undefined;
  let trafficLight: TrafficLight = unknown ? "unknown" : "green";

  if (unknown) flags.push("no_sleep_data");
  else if (sleep_hours < 5.0) { flags.push("sleep_under_5h"); trafficLight = "red"; }
  if (bodyBatteryMorning !== null && bodyBatteryMorning < 25) { flags.push("body_battery_critical"); trafficLight = "red"; }
  if (hrv_z !== null && hrv_z !== undefined && hrv_z < -0.5) flags.push("hrv_below_swc");

  const flaggedCount = zValues.filter((z) => z < -1.0).length;
  if (flaggedCount >= 3) { flags.push("3_of_4_flagged"); trafficLight = "red"; }
  else if (flaggedCount >= 2 && trafficLight === "green") { flags.push("2_of_4_flagged"); trafficLight = "yellow"; }

  return {
    hrv_z_score: hrv_z,
    sleep_z_score: sleep_z,
    rhr_z_score: rhr_z,
    body_battery_z_score: bb_z,
    composite_score: trafficLight === "unknown" ? null : r(composite, 4),
    traffic_light: trafficLight,
    flags,
  };
}
