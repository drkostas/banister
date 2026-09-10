import { describe, it, expect } from "vitest";
import { VDOT_TABLE, getBasePace, getHRZone, getHMPrediction, HR_ZONES, RUN_TYPE_TO_ZONE } from "../src/pace-zones";

describe("VDOT table", () => {
  it("covers 35..60 with sec/km paces and an HM prediction", () => {
    for (let v = 35; v <= 60; v++) {
      const p = VDOT_TABLE[v];
      expect(p.easy).toBeGreaterThan(p.marathon);
      expect(p.marathon).toBeGreaterThan(p.threshold);
      expect(p.threshold).toBeGreaterThan(p.interval);
      expect(p.interval).toBeGreaterThan(p.repetition);
      expect(p.hmSeconds).toBeGreaterThan(0);
    }
  });
  it("faster with higher VDOT", () => {
    expect(VDOT_TABLE[60].easy).toBeLessThan(VDOT_TABLE[35].easy);
    expect(VDOT_TABLE[60].hmSeconds).toBeLessThan(VDOT_TABLE[35].hmSeconds);
  });
});

describe("getBasePace", () => {
  it("integer VDOT reads the table directly", () => {
    expect(getBasePace(47, "easy")).toBe(VDOT_TABLE[47].easy);
    expect(getBasePace(47, "tempo")).toBe(VDOT_TABLE[47].threshold);
    expect(getBasePace(47, "intervals")).toBe(VDOT_TABLE[47].interval);
    expect(getBasePace(47, "race")).toBe(VDOT_TABLE[47].marathon);
  });
  it("fractional VDOT interpolates linearly (rounded)", () => {
    expect(getBasePace(47.5, "easy")).toBe(Math.round((VDOT_TABLE[47].easy + VDOT_TABLE[48].easy) / 2));
  });
  it("clamps to the table range", () => {
    expect(getBasePace(20, "easy")).toBe(VDOT_TABLE[35].easy);
    expect(getBasePace(99, "easy")).toBe(VDOT_TABLE[60].easy);
  });
  it("unknown run type and case fall back to easy", () => {
    expect(getBasePace(50, "Fartlek")).toBe(VDOT_TABLE[50].easy);
    expect(getBasePace(50, "TEMPO")).toBe(VDOT_TABLE[50].threshold);
  });
  it("every run type maps to a real zone", () => {
    for (const z of Object.values(RUN_TYPE_TO_ZONE)) expect(VDOT_TABLE[40]).toHaveProperty(z);
  });
});

describe("getHRZone / getHMPrediction", () => {
  it("HR zone per run type, easy as fallback", () => {
    expect(getHRZone("tempo")).toEqual(HR_ZONES.tempo);
    expect(getHRZone("Long")).toEqual(HR_ZONES.long);
    expect(getHRZone("nope")).toEqual(HR_ZONES.easy);
  });
  it("HM prediction interpolates and clamps", () => {
    expect(getHMPrediction(47)).toBe(VDOT_TABLE[47].hmSeconds);
    expect(getHMPrediction(47.5)).toBe(Math.round((VDOT_TABLE[47].hmSeconds + VDOT_TABLE[48].hmSeconds) / 2));
    expect(getHMPrediction(200)).toBe(VDOT_TABLE[60].hmSeconds);
  });
});
