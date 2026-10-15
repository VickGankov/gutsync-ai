import { describe, it, expect } from "vitest";
import { buildFitnessSummary, estimatedOneRepMax, localDateKey, mealProteinGrams, mealFiber, DAY_MS } from "./fitness";

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

import { mealWaterMl } from "./fitness";
describe("mealWaterMl", () => {
  it("sums drink volumes and ignores foods", () => {
    const foods: any[] = [{ name: "Water", volumeMl: 500 }, { name: "Rice" }, { name: "Juice", volumeMl: 250 }, { name: "Bad", volumeMl: -5 }];
    expect(mealWaterMl(foods)).toBe(750);
    expect(mealWaterMl(undefined)).toBe(0);
  });
  it("counts drinks in saved meals toward the day's water", () => {
    const now = Date.UTC(2026, 9, 14, 20, 0, 0);
    const s = buildFitnessSummary({
      now, days: 1, tzOffsetMinutes: 0,
      meals: [{ foods: [{ name: "Vitamin water", volumeMl: 591 }] as any, loggedAt: now - 1000 }],
      intake: [{ kind: "water", amount: 250, loggedAt: now - 2000 }], weights: [], lifts: [],
    });
    expect(s.today?.waterMl).toBe(841);
  });
});

describe("fiber", () => {
  it("treats meals without fiber data as untracked", () => {
    expect(mealFiber([{ name: "Steak", category: "protein", fodmap: "low", hiddenIngredients: [] }])).toEqual({ grams: 0, tracked: false });
    expect(mealFiber([{ name: "Oats", category: "grain", fodmap: "low", hiddenIngredients: [], fiberGrams: 4 }, { name: "Banana", category: "fruit", fodmap: "low", hiddenIngredients: [], fiberGrams: 3 }])).toEqual({ grams: 7, tracked: true });
  });

  it("averages the last 7 days over only the days that have fiber data", () => {
    const food = (g?: number) => [{ name: "x", category: "other" as const, fodmap: "low" as const, hiddenIngredients: [], ...(g !== undefined ? { fiberGrams: g } : {}) }];
    const s = buildFitnessSummary({
      now: NOW, days: 7, tzOffsetMinutes: PDT,
      meals: [
        { foods: food(10), loggedAt: NOW - 1000 },
        { foods: food(20), loggedAt: NOW - 1 * DAY_MS },
        { foods: food(), loggedAt: NOW - 3 * DAY_MS }, // older meal, no fiber data: not counted as 0 g
      ],
      intake: [], weights: [], lifts: [],
    });
    expect(s.fiber.todayG).toBe(10);
    expect(s.fiber.daysCounted).toBe(2);
    expect(s.fiber.avg7).toBe(15);
  });

  it("gives no average until at least 2 days have data", () => {
    const s = buildFitnessSummary({
      now: NOW, days: 7, tzOffsetMinutes: PDT,
      meals: [{ foods: [{ name: "x", category: "other", fodmap: "low", hiddenIngredients: [], fiberGrams: 5 }], loggedAt: NOW - 1000 }],
      intake: [], weights: [], lifts: [],
    });
    expect(s.fiber.avg7).toBeNull();
  });
});
