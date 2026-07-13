import { describe, it, expect } from "vitest";
import {
  vdotFromRace, allPaces, hmGoalPaces, velocityAtVo2max, timeFromVdot, adjustVdotForWeight,
  getCurrentPhase, computeCorrelations, getActiveWeights, type Weights, type SignalName,
} from "../src/index";
import golden from "./vdot_calib_golden.json";

const g = golden as any;

describe("vdot — Python parity", () => {
  it("vdotFromRace", () => {
    for (const c of g.vdot.from_race) expect(vdotFromRace(c.d, c.t)).toBeCloseTo(c.vdot, 9);
  });
  it("allPaces (exact int paces, pyRound parity)", () => {
    for (const c of g.vdot.all_paces) {
      const p = allPaces(c.vdot);
      expect(p.E).toEqual(c.paces.E);
      expect(p.M).toEqual(c.paces.M);
      expect(p.T).toEqual(c.paces.T);
      expect(p.I).toEqual(c.paces.I);
      expect(p.R).toEqual(c.paces.R);
    }
  });
  it("hmGoalPaces (exact ints)", () => {
    for (const c of g.vdot.hm_goals) expect(hmGoalPaces(c.vdot)).toEqual(c.goals);
  });
  it("velocityAtVo2max", () => {
    for (const c of g.vdot.vel_vo2max) expect(velocityAtVo2max(c.vdot)).toBeCloseTo(c.vel, 9);
  });
  it("timeFromVdot", () => {
    for (const c of g.vdot.time_from_vdot) expect(timeFromVdot(c.vdot, c.d)).toBeCloseTo(c.t, 6);
  });
  it("adjustVdotForWeight", () => {
    for (const c of g.vdot.weight_adj) expect(adjustVdotForWeight(c.vdot, c.old, c.new)).toBeCloseTo(c.adj, 12);
  });
});

describe("calibration — Python parity", () => {
  it("getCurrentPhase", () => {
    for (const c of g.calibration.phase) expect(getCurrentPhase(c.days)).toBe(c.phase);
  });
  it("computeCorrelations", () => {
    const corr = computeCorrelations(g.calibration.signals, g.calibration.quality);
    for (const k of Object.keys(g.calibration.correlations) as SignalName[])
      expect(corr[k]).toBeCloseTo(g.calibration.correlations[k], 12);
  });
  it("getActiveWeights (all cascade branches)", () => {
    for (const c of g.calibration.active_weights) {
      const w = getActiveWeights(c.phase, c.corr ?? null, c.lasso ?? null, c.fe ?? false);
      for (const k of Object.keys(c.w) as SignalName[]) expect(w[k]).toBeCloseTo(c.w[k], 12);
    }
  });
});
