import { describe, it, expect } from "vitest";
import { fitBanister, banisterPredict, type DailyLoad, type Anchor } from "../src/banister";
import data from "./fixtures_data.json";

describe("fitBanister — scipy-parity (ST3 real data)", () => {
  it("reaches scipy-quality WSSE + matches anchor predictions", () => {
    const loads = (data as any).daily_loads as DailyLoad[];
    const anchors = (data as any).anchors as Anchor[];
    const p = fitBanister(loads, anchors);
    // scipy reference (ST3): WSSE 1.9227
    const maxDay = Math.max(...anchors.map(a => a.day_index));
    const ln2 = Math.log(2);
    const w = anchors.map(a => Math.exp(-ln2 * (maxDay - a.day_index) / 365));
    const wsse = anchors.reduce((s, a, i) => { const d = banisterPredict(p, loads, a.day_index) - a.vdot; return s + w[i]*d*d; }, 0);
    console.log("  fitted:", JSON.stringify(Object.fromEntries(Object.entries(p).map(([k,v])=>[k,+v.toFixed(4)]))), "WSSE:", wsse.toFixed(4));
    expect(wsse).toBeLessThanOrEqual(1.9227 * 1.15); // scipy quality (±15%)
    // predictions near the actual anchor VDOTs
    for (const a of anchors) expect(Math.abs(banisterPredict(p, loads, a.day_index) - a.vdot)).toBeLessThan(2.5);
  }, 60000);
});
