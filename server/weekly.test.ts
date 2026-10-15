import { describe, it, expect } from "vitest";
import { weightTrend, doseMarkers, weeklySummary, dateKeyOf, startOfLocalDay } from "../shared/weekly";
import { intervalsByCompound, DAY_MS } from "../shared/dose";

const NOW = Date.parse("2026-10-15T20:00:00Z");
const day = (n: number) => dateKeyOf(NOW - n * DAY_MS, 0);
const mkDays = (weights: Array<number | null>, protein = 0) =>
  weights.map((w, i) => ({ date: day(weights.length - 1 - i), weightLb: w, proteinG: protein }));
const dose = (id: number, compound: string, mcg: number, daysAgo: number) =>
  ({ id, compound, doseMcg: mcg, site: null, loggedAt: NOW - daysAgo * DAY_MS });

describe("weightTrend", () => {
  it("averages the weigh-ins in the 7 days ending each day, ignoring missing days", () => {
    const t = weightTrend(mkDays([200, null, 198, null, null, null, 196, 194]));
    expect(t[0].avg).toBe(200);
    expect(t[2].avg).toBe(199);
    expect(t[1].avg).toBeNull();
    expect(t[7].avg).toBe(196); // 198, 196, 194 within the last 7 days (200 has dropped out)
  });
});

describe("doseMarkers", () => {
  it("marks the first dose and any change of amount, per compound", () => {
    const m = doseMarkers([
      dose(1, "Retatrutide", 1000, 14), dose(2, "Retatrutide", 1000, 7), dose(3, "Retatrutide", 2000, 0),
      dose(4, "BPC-157", 250, 3),
    ], 0);
    expect(m.map(x => `${x.compound}:${x.kind}:${x.doseMcg}`)).toEqual([
      "Retatrutide:start:1000", "BPC-157:start:250", "Retatrutide:change:2000",
    ]);
  });
});

describe("weeklySummary", () => {
  const base = (extra: Partial<Parameters<typeof weeklySummary>[0]> = {}) => {
    const doses = extra.doses ?? [];
    return weeklySummary({
      days: mkDays([200, 200, 200, 200, 200, 200, 200, 198, 198, 198, 198, 198, 198, 198], 140),
      doses,
      intervals: intervalsByCompound(doses, [{ compound: "Retatrutide", intervalDays: 7 }]),
      symptoms: [],
      proteinTarget: 150,
      tzOffsetMinutes: 0,
      now: NOW,
      ...extra,
    });
  };

  it("compares this week's average weight with the week before", () => {
    const s = base();
    expect(s.weight).toMatchObject({ thisAvg: 198, prevAvg: 200, delta: -2, weighIns: 7 });
  });

  it("reports protein over logged days and days on target", () => {
    expect(base().protein).toMatchObject({ avg: 140, daysLogged: 7, daysOnTarget: 0, target: 150 });
  });

  it("counts only the doses inside the week for a weekly compound", () => {
    const s = base({ doses: [dose(1, "Retatrutide", 1000, 15), dose(2, "Retatrutide", 1000, 8), dose(3, "Retatrutide", 1000, 1)] });
    expect(s.doses.byCompound).toEqual([{ name: "Retatrutide", taken: 1, expected: 1 }]);
  });

  it("expects one dose already for a compound started today", () => {
    const s = base({ doses: [dose(1, "Retatrutide", 1000, 0)] });
    expect(s.doses.byCompound[0]).toMatchObject({ taken: 1, expected: 1 });
  });

  it("counts side effects this week and ignores positive outcomes and older ones", () => {
    const s = base({
      symptoms: [
        { type: "nausea", severity: 3, loggedAt: NOW - 1 * DAY_MS },
        { type: "fatigue", severity: 4, loggedAt: NOW - 2 * DAY_MS },
        { type: "better_digestion", severity: 5, loggedAt: NOW - 1 * DAY_MS },
        { type: "nausea", severity: 5, loggedAt: NOW - 20 * DAY_MS },
      ],
    });
    expect(s.sideEffects).toEqual({ count: 2, worst: { type: "fatigue", severity: 4 } });
  });
});

describe("startOfLocalDay", () => {
  it("is the inverse of dateKeyOf for a timezone offset", () => {
    const tz = 420; // UTC-7
    const k = dateKeyOf(NOW, tz);
    const start = startOfLocalDay(k, tz);
    expect(dateKeyOf(start, tz)).toBe(k);
    expect(dateKeyOf(start - 1, tz)).not.toBe(k);
  });
});
