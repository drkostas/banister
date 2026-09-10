import { describe, it, expect } from "vitest";
import { projectVdotSeries, projectFitnessOnlySeries, projectVdotAt, DEFAULT_BANISTER, type DatedLoad } from "../src/projection";

const P = { p0: 47, k1: 0.1, k2: 0.1, tau1: 42, tau2: 7 };
const day = (i: number) => new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
const series = (loads: number[]): DatedLoad[] => loads.map((load, i) => ({ date: day(i), load }));

describe("projectVdotSeries", () => {
  it("no load → p0 everywhere", () => {
    expect(projectVdotSeries(series([0, 0, 0]), P)).toEqual([47, 47, 47]);
  });
  it("the first day is p0 (nothing before it contributes)", () => {
    expect(projectVdotSeries(series([100, 0]), P)[0]).toBe(47);
  });
  it("one impulse: day after = p0 + w(k1 e^-1/42 - k2 e^-1/7), rounded to 0.1", () => {
    const w = 100;
    const expected = Math.round((47 + w * (0.1 * Math.exp(-1 / 42) - 0.1 * Math.exp(-1 / 7))) * 10) / 10;
    expect(projectVdotSeries(series([w, 0]), P)[1]).toBe(expected);
  });
  it("fatigue clears faster than fitness: value rises again after a rest week", () => {
    const loads = series([100, ...Array(20).fill(0)]);
    const s = projectVdotSeries(loads, P);
    expect(s[1]).toBeLessThan(s[14]); // day-after dip, then fitness dominates
  });
  it("DEFAULT_BANISTER is the documented projection default", () => {
    expect(DEFAULT_BANISTER).toEqual({ p0: 47.0, k1: 0.1, k2: 0.1, tau1: 42, tau2: 7 });
  });
});

describe("projectFitnessOnlySeries", () => {
  it("is never below the full model (no fatigue term)", () => {
    const loads = series([80, 60, 0, 90, 0, 0, 70]);
    const full = projectVdotSeries(loads, P), fit = projectFitnessOnlySeries(loads, P);
    fit.forEach((v, i) => expect(v).toBeGreaterThanOrEqual(full[i]));
  });
  it("k2 is ignored", () => {
    const loads = series([80, 60, 0, 90]);
    expect(projectFitnessOnlySeries(loads, P)).toEqual(projectFitnessOnlySeries(loads, { ...P, k2: 9 }));
  });
});

describe("projectVdotAt", () => {
  it("equals the series value on a date in the series", () => {
    const loads = series([80, 60, 0, 90, 0]);
    expect(projectVdotAt(loads, P, day(4))).toBe(projectVdotSeries(loads, P)[4]);
  });
  it("same-day and future loads do not contribute; no contribution → p0", () => {
    expect(projectVdotAt(series([100]), P, day(0))).toBe(47);
    expect(projectVdotAt(series([100]), P, "2025-12-01")).toBe(47);
  });
  it("projects past the end of the series with decay", () => {
    const loads = series([100]);
    const later = projectVdotAt(loads, P, day(30));
    expect(later).toBeGreaterThan(47); // fatigue gone, fitness remains
    expect(later).toBeLessThan(projectVdotAt(loads, P, day(10)));
  });
});
