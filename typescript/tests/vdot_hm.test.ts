import { describe, it, expect } from "vitest";
import { hmSecondsFromVdot, vdotFromHmSeconds, timeFromVdot, vdotFromRace, HM_M } from "../src/vdot";
import { getHMPrediction } from "../src/pace-zones";

describe("half-marathon helpers over the Daniels equations", () => {
  it("hmSecondsFromVdot is timeFromVdot at 21097.5 m, whole seconds", () => {
    for (const v of [35, 42.5, 50, 57.5, 65]) expect(hmSecondsFromVdot(v)).toBe(Math.round(timeFromVdot(v, HM_M)));
  });
  it("vdotFromHmSeconds inverts vdotFromRace to one decimal", () => {
    for (const s of [4500, 5400, 6300, 7200, 8100]) expect(vdotFromHmSeconds(s)).toBe(Math.round(vdotFromRace(HM_M, s) * 10) / 10);
  });
  it("round-trips within 0.1 VDOT", () => {
    for (let v = 35; v <= 65; v += 2.5) expect(Math.abs(vdotFromHmSeconds(hmSecondsFromVdot(v)) - v)).toBeLessThanOrEqual(0.1);
  });
  it("agrees with the pace table's HM prediction within a few percent", () => {
    for (let v = 35; v <= 60; v += 5) {
      const eq = hmSecondsFromVdot(v), table = getHMPrediction(v);
      expect(Math.abs(eq - table) / table).toBeLessThan(0.05);
    }
  });
});
