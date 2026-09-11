import { describe, it, expect } from "vitest";
import { zScore, computeReadiness } from "../src/readiness-stream";
import golden from "./readiness-stream.golden.json";

const g = golden as any;

describe("readiness stream — Python parity", () => {
  it("zScore (population std, 0 on <7 / zero-std)", () => {
    for (const c of g.z_score) expect(zScore(c.in.v, c.in.b)).toBeCloseTo(c.v, 8);
  });

  it("computeReadiness (composite, traffic light, flags, overrides)", () => {
    for (const c of g.readiness) {
      const out = computeReadiness(c.in);
      expect(out.composite_score).toBeCloseTo(c.v.composite_score, 4);
      expect(out.traffic_light).toBe(c.v.traffic_light);
      expect(out.flags).toEqual(c.v.flags);
      expect(out.hrv_z_score).toBe(c.v.hrv_z_score);
      expect(out.rhr_z_score).toBe(c.v.rhr_z_score);
    }
  });
});

// #647 — a missing night is "unknown", never green; stale nights never fire overrides.
describe("readiness — missing last night (#647)", () => {
  it("null sleep_hours → unknown, no_sleep_data, composite null (resting HR alone is not a light)", () => {
    const out = computeReadiness({ hrv_z: null, sleep_z: null, rhr_z: 1.2, bb_z: null, sleep_hours: null, body_battery_morning: null });
    expect(out.traffic_light).toBe("unknown");
    expect(out.flags).toEqual(["no_sleep_data"]);
    expect(out.composite_score).toBeNull();
  });

  it("body battery critical still forces red without a night", () => {
    const out = computeReadiness({ hrv_z: null, sleep_z: null, rhr_z: 0, bb_z: -2, sleep_hours: null, body_battery_morning: 20 });
    expect(out.traffic_light).toBe("red");
    expect(out.flags).toEqual(["no_sleep_data", "body_battery_critical"]);
  });

  it("2-of-4 never downgrades unknown to yellow", () => {
    const out = computeReadiness({ hrv_z: -1.5, sleep_z: null, rhr_z: -1.5, bb_z: null, sleep_hours: null, body_battery_morning: null });
    expect(out.traffic_light).toBe("unknown");
    expect(out.flags).toEqual(["no_sleep_data", "hrv_below_swc"]); // 2_of_4 only ever moves green → yellow
  });
});
