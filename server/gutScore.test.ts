import { describe, it, expect } from "vitest";
import { gutScore, trackingStreak } from "../shared/gutScore";

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 22, 15, 0, 0);
const sym = (type: string, severity: number, ago: number) => ({ type, severity, loggedAt: now - ago });

describe("gutScore", () => {
  it("is null when nothing was logged", () => {
    expect(gutScore([], now).score).toBeNull();
  });
  it("ignores positive/non-negative symptom types", () => {
    expect(gutScore([sym("energy_high", 5, 1000)], now).score).toBeNull();
  });
  it("drops as severity rises", () => {
    const mild = gutScore([sym("bloating", 1, 1000)], now).score!;
    const bad = gutScore([sym("bloating", 5, 1000), sym("abdominal_pain", 5, 1000)], now).score!;
    expect(mild).toBeGreaterThan(bad);
    expect(bad).toBeLessThan(50);
  });
  it("reports trend against the prior week", () => {
    const worse = gutScore([sym("bloating", 5, 1000), sym("bloating", 1, 8 * DAY)], now);
    expect(worse.trend).toBe("worse");
    expect(gutScore([sym("bloating", 3, 1000)], now).trend).toBeNull();
  });
});

describe("trackingStreak", () => {
  it("counts consecutive logged days", () => {
    expect(trackingStreak([now, now - DAY, now - 2 * DAY], now, 0)).toBe(3);
  });
  it("stays alive if today is empty but yesterday is logged", () => {
    expect(trackingStreak([now - DAY, now - 2 * DAY], now, 0)).toBe(2);
  });
  it("breaks on a gap", () => {
    expect(trackingStreak([now, now - 2 * DAY], now, 0)).toBe(1);
  });
  it("is 0 with no recent logs", () => {
    expect(trackingStreak([now - 5 * DAY], now, 0)).toBe(0);
  });
});
