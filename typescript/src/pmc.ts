/**
 * Load stream / PMC formulas: per-activity load (Garmin EPOC with a duration
 * fallback), Banister TRIMP, the EWMA fitness/fatigue/form curve (CTL/ATL/TSB)
 * and cross-modal scaling. Pure; the steps that read and write a database stay
 * with the application that owns the tables.
 *
 * EWMA: value_today = load * alpha + value_yesterday * (1 - alpha),
 *       alpha = 1 - exp(-1/tau); CTL tau = 42, ATL tau = 7; TSB = CTL - ATL.
 */
const r = (x: number, n: number) => Number(x.toFixed(n)); // Python round(x, n) for n>=1

export interface ActivityLoad {
  load_metric: string;
  load_value: number;
  source: string;
  duration_seconds: number | null;
}

/**
 * Extract or compute load from a single activity. Primary: Garmin EPOC
 * (activityTrainingLoad). Fallback: ~1.5 EPOC/min duration estimate, or 50.0.
 */
export function computeActivityLoad(raw: Record<string, any>, source: string): ActivityLoad {
  const epoc = raw.activityTrainingLoad;
  if (epoc !== null && epoc !== undefined && epoc > 0) {
    return {
      load_metric: "epoc",
      load_value: Number(epoc),
      source,
      duration_seconds: raw.duration ?? null,
    };
  }
  const durationSec = raw.duration || 0;
  const durationMin = Math.max(durationSec / 60.0, 0);
  const estimated = durationMin > 0 ? r(durationMin * 1.5, 1) : 50.0;
  return {
    load_metric: "estimated",
    load_value: estimated,
    source,
    duration_seconds: raw.duration ?? null,
  };
}

/**
 * Banister TRIMP from average HR.
 * TRIMP = duration(min) × ratio × 0.64 × e^(1.92 × ratio),
 * ratio = clamp((HR - HR_rest) / (HR_max - HR_rest), 0, 1). null if no HR.
 */
export function computeTrimp(
  durationMin: number,
  avgHr: number | null,
  restingHr: number,
  maxHr: number,
): number | null {
  if (avgHr === null || avgHr === undefined) return null;
  if (maxHr <= restingHr || durationMin <= 0) return 0.0;
  let ratio = (avgHr - restingHr) / (maxHr - restingHr);
  ratio = Math.max(0.0, Math.min(1.0, ratio));
  return durationMin * ratio * 0.64 * Math.exp(1.92 * ratio);
}

export interface PmcEntry { date: string; ctl: number; atl: number; tsb: number; daily_load: number; }

/** Compute PMC from chronological (date, dailyLoad) pairs sorted ascending. */
export function computePmc(
  dailyLoads: Array<[string, number]>,
  tauCtl = 42,
  tauAtl = 7,
): PmcEntry[] {
  if (!dailyLoads.length) return [];
  const alphaCtl = 1 - Math.exp(-1 / tauCtl);
  const alphaAtl = 1 - Math.exp(-1 / tauAtl);
  const results: PmcEntry[] = [];
  let ctl = 0.0, atl = 0.0;
  for (const [dt, load] of dailyLoads) {
    ctl = load * alphaCtl + ctl * (1 - alphaCtl);
    atl = load * alphaAtl + atl * (1 - alphaAtl);
    results.push({ date: dt, ctl: r(ctl, 2), atl: r(atl, 2), tsb: r(ctl - atl, 2), daily_load: load });
  }
  return results;
}

/** Scale factor for non-running activities entering the running PMC. */
export function crossModalScale(source: string): number {
  const s = source.toLowerCase();
  if (s.includes("running") || s.includes("treadmill")) return 1.0;
  if (s === "hevy") return 1.0; // already cross-modal scaled (0.5×) before insertion
  if (s.includes("cycling") || s.includes("bike")) return 0.6;
  if (s.includes("walking")) return 0.2;
  if (s.includes("swimming") || s.includes("lap_swimming")) return 0.5;
  return 0.3;
}

// PMC time constants — the classic Banister constants (CTL 42 d, ATL 7 d). The
// personal Banister tau is deliberately NOT used: with ~4 max-effort anchors the
// (tau1, tau2) are unidentifiable (every fit seed lands on a different tau at
// identical quality), so a personal tau would make the curve drift arbitrarily.
export const DEFAULT_TAU_CTL = 42;
export const DEFAULT_TAU_ATL = 7;
