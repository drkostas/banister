/**
 * Maximal-effort anchor runs for the Banister fit.
 *
 * A run is an anchor when its average heart rate is at least a share of HRmax (90% by default) and it
 * covers at least a minimum distance (2 km by default). Each anchor carries the VDOT its distance and
 * time imply, and anchors come back in date order.
 */
import { vdotFromRace } from "./vdot";

export interface RunInput { date: string; avg_hr: number; distance_m: number; duration_s: number; activity_id?: number; }
export interface AnchorRun extends RunInput { vdot: number; }

export function detectAnchorRuns(
  runs: RunInput[], estimatedHrmax: number, hrThresholdPct = 0.9, minDistanceM = 2000,
): AnchorRun[] {
  const hrCutoff = estimatedHrmax * hrThresholdPct;
  const anchors: AnchorRun[] = [];
  for (const run of runs) {
    const avgHr = run.avg_hr || 0, distanceM = run.distance_m || 0, durationS = run.duration_s || 0;
    if (avgHr < hrCutoff || distanceM < minDistanceM || durationS <= 0) continue;
    anchors.push({ ...run, vdot: vdotFromRace(distanceM, durationS) });
  }
  anchors.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return anchors;
}
