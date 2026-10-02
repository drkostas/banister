import { describe, it, expect } from "vitest";
import { detectAnchorRuns } from "../src/anchors";
import { dailyLoadSeries, crossModalScale } from "../src/pmc";
import { computeWeightEma } from "../src/body-comp";
import { vdotFromRace } from "../src/vdot";

describe("detectAnchorRuns", () => {
  const run = (date: string, avg_hr: number, distance_m: number, duration_s: number) => ({ date, avg_hr, distance_m, duration_s });
  it("keeps hard runs of at least 2 km, in date order, with their VDOT", () => {
    const out = detectAnchorRuns([
      run("2026-03-07", 176, 5000, 1290),
      run("2026-01-10", 175, 10000, 2700),
      run("2026-02-01", 150, 10000, 3000), // easy: below 90% of 190
      run("2026-02-02", 180, 1500, 300), // too short
      run("2026-02-03", 180, 3000, 0), // no time
    ], 190);
    expect(out.map((a) => a.date)).toEqual(["2026-01-10", "2026-03-07"]);
    expect(out[1].vdot).toBeCloseTo(vdotFromRace(5000, 1290), 10);
  });
  it("takes the threshold and minimum distance as options", () => {
    expect(detectAnchorRuns([run("2026-01-01", 160, 1500, 400)], 190, 0.8, 1000)).toHaveLength(1);
  });
});

describe("dailyLoadSeries", () => {
  it("scales each source, sums per day and fills rest days with 0", () => {
    const out = dailyLoadSeries([
      { date: "2026-01-03", source: "hevy", load: 100 },
      { date: "2026-01-01", source: "garmin", load: 50 },
      { date: "2026-01-01", source: "hevy", load: 10 },
    ]);
    expect(out.map(([d]) => d)).toEqual(["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(out[0][1]).toBeCloseTo(50 * crossModalScale("garmin") + 10 * crossModalScale("hevy"), 10);
    expect(out[1][1]).toBe(0);
    expect(out[2][1]).toBeCloseTo(100 * crossModalScale("hevy"), 10);
  });
  it("is empty for no records", () => {
    expect(dailyLoadSeries([])).toEqual([]);
  });
});

describe("computeWeightEma digits", () => {
  const w: Array<[string, number]> = [["2026-01-01", 80], ["2026-01-02", 81.37], ["2026-01-03", 79.91]];
  it("rounds to 2 places by default, as before", () => {
    expect(computeWeightEma(w, 5).map((p) => p.weight_ema)).toEqual([80, 80.46, 80.27]);
  });
  it("keeps full precision with null", () => {
    const full = computeWeightEma(w, 5, null);
    expect(full[1].weight_ema).toBeCloseTo(80 + (81.37 - 80) / 3, 12);
    expect(String(full[1].weight_ema).length).toBeGreaterThan(6);
  });
});
