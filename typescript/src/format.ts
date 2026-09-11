/**
 * Display formatters for paces and durations. Pure string helpers, shared so
 * the web and the app print the same "M:SS" for the same seconds.
 */

/** Seconds per km to "M:SS". Rounds the total first so ":60" can never render. */
export function paceStr(secPerKm: number): string {
  const t = Math.round(secPerKm);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Total seconds to "H:MM:SS", or "M:SS" under an hour. */
export function timeStr(totalSec: number): string {
  const t = Math.round(totalSec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}
