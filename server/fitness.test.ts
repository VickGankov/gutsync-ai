import { describe, it, expect } from "vitest";
import { buildFitnessSummary, estimatedOneRepMax, localDateKey, mealProteinGrams, DAY_MS } from "./fitness";

const NOW = Date.UTC(2026, 9, 14, 20, 0, 0); // 2026-10-14 20:00 UTC
const PDT = 420; // getTimezoneOffset() for America/Los_Angeles in October

describe("fitness helpers", () => {
  it("buckets by the client's local day", () => {
    // 2026-10-15 03:00 UTC is still Oct 14 in Los Angeles
    expect(localDateKey(Date.UTC(2026, 9, 15, 3, 0), PDT)).toBe("2026-10-14");
    expect(localDateKey(Date.UTC(2026, 9, 15, 3, 0), 0)).toBe("2026-10-15");
  });

  it("sums meal protein and ignores missing or invalid values", () => {
    expect(mealProteinGrams([
      { name: "Chicken", category: "protein", fodmap: "low", hiddenIngredients: [], proteinGrams: 42 },
      { name: "Rice", category: "grain", fodmap: "low", hiddenIngredients: [] },
      { name: "Bad", category: "other", fodmap: "low", hiddenIngredients: [], proteinGrams: -5 },
    ])).toBe(42);
    expect(mealProteinGrams(null)).toBe(0);
  });

  it("computes Epley e1RM", () => {
    expect(estimatedOneRepMax(225, 1)).toBe(225);
    expect(estimatedOneRepMax(225, 5)).toBe(263);
  });

  it("combines meals and quick adds per day and keeps the latest weigh-in", () => {
    const s = buildFitnessSummary({
      now: NOW,
      days: 7,
      tzOffsetMinutes: PDT,
      meals: [{ foods: [{ name: "Steak", category: "protein", fodmap: "low", hiddenIngredients: [], proteinGrams: 50 }], loggedAt: NOW - 3600_000 }],
      intake: [
        { kind: "protein", amount: 40, loggedAt: NOW - 1000 },
        { kind: "water", amount: 500, loggedAt: NOW - 1000 },
      ],
      weights: [
        { weightLb10: 1900, loggedAt: NOW - 6 * DAY_MS },
        { weightLb10: 1880, loggedAt: NOW - 2000 },
        { weightLb10: 1875, loggedAt: NOW - 1000 },
      ],
      lifts: [],
    });
    expect(s.days).toHaveLength(7);
    expect(s.today.proteinG).toBe(90);
    expect(s.today.waterMl).toBe(500);
    expect(s.today.weightLb).toBe(187.5);
    expect(s.weeklyChangePct).toBeLessThan(-1); // 190 -> 187.5 in 6 days
  });

  it("tracks best set per day and strength change per exercise", () => {
    const s = buildFitnessSummary({
      now: NOW,
      days: 28,
      tzOffsetMinutes: 0,
      meals: [],
      intake: [],
      weights: [],
      lifts: [
        { exercise: "Bench Press", weightLb: 225, reps: 5, sets: 3, loggedAt: NOW - 14 * DAY_MS },
        { exercise: "bench press ", weightLb: 205, reps: 5, sets: 3, loggedAt: NOW - 1000 },
        { exercise: "Bench Press", weightLb: 185, reps: 5, sets: 1, loggedAt: NOW - 500 },
      ],
    });
    expect(s.lifts).toHaveLength(1);
    expect(s.lifts[0].series).toHaveLength(2);
    expect(s.lifts[0].series[1].weightLb).toBe(205);
    expect(s.lifts[0].changePct).toBeLessThan(-5);
  });
});
