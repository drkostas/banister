import { describe, it, expect } from "vitest";
import { paceStr, timeStr } from "../src/format";

describe("paceStr", () => {
  it("formats sec/km as M:SS", () => {
    expect(paceStr(331)).toBe("5:31");
    expect(paceStr(300)).toBe("5:00");
    expect(paceStr(59)).toBe("0:59");
  });
  it("rounds first so :60 never renders", () => {
    expect(paceStr(299.6)).toBe("5:00");
    expect(paceStr(359.5)).toBe("6:00");
  });
});

describe("timeStr", () => {
  it("under an hour: M:SS", () => {
    expect(timeStr(1500)).toBe("25:00");
    expect(timeStr(65.4)).toBe("1:05");
  });
  it("an hour or more: H:MM:SS", () => {
    expect(timeStr(3600)).toBe("1:00:00");
    expect(timeStr(5798)).toBe("1:36:38");
    expect(timeStr(7453.4)).toBe("2:04:13");
  });
});
