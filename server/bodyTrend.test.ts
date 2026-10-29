import { describe, it, expect } from "vitest";
import { trendSeries, theilSen, rateBetween, recentRate, goalEta, retentionCheck, aroundChanges, addDays, type WeighIn } from "../shared/bodyTrend";

const T = "2026-10-29";
// n days of weigh-ins ending at T, starting at `start` lb, changing `perDay` lb a day
const series = (n: number, start: number, perDay: number, noise: (i: number) => number = () => 0): WeighIn[] =>
  Array.from({ length: n }, (_, i) => ({ date: addDays(T, -(n - 1 - i)), lb: Math.round((start + perDay * i + noise(i)) * 10) / 10 }));

describe("trendSeries", () => {
  it("smooths a spike instead of following it", () => {
    const t = trendSeries(series(6, 190, 0, i => (i === 4 ? 3 : 0)));
    expect(t[4].lb).toBe(193);
    expect(t[4].trend).toBeLessThan(191);
  });
  it("lets a gap of several days pull the trend further than one day", () => {
    const a = trendSeries([{ date: "2026-10-01", lb: 190 }, { date: "2026-10-02", lb: 186 }])[1].trend;
    const b = trendSeries([{ date: "2026-10-01", lb: 190 }, { date: "2026-10-08", lb: 186 }])[1].trend;
    expect(b).toBeLessThan(a);
  });
});

describe("rate", () => {
  it("finds a steady loss", () => {
    const r = recentRate(series(14, 194, -0.2))!;
    expect(r.lbPerWeek).toBeCloseTo(-1.4, 1);
    expect(r.pctPerWeek).toBeLessThan(0);
  });
  it("is not thrown by one bad weigh-in", () => {
    const r = recentRate(series(14, 194, -0.2, i => (i === 13 ? 4 : 0)))!;
    expect(r.lbPerWeek).toBeLessThan(-1.2);
  });
  it("says nothing without enough points or days", () => {
    expect(recentRate(series(3, 190, -0.5))).toBeNull();
    expect(rateBetween(series(5, 190, -0.5), addDays(T, -4), T)).toBeNull(); // spans 4 days
  });
  it("theilSen handles a lone x", () => expect(theilSen([1, 1], [2, 3])).toBeNull());
});

describe("goalEta", () => {
  const rate = (lb: number) => ({ lbPerWeek: lb, pctPerWeek: lb / 2, n: 8, spanDays: 13 });
  it("projects a date range from the paces that point toward the goal", () => {
    const e = goalEta(186, 176, [rate(-1), rate(-2)], T);
    expect(e.state).toBe("projected");
    expect(e.from).toBe(addDays(T, 35));
    expect(e.to).toBe(addDays(T, 70));
  });
  it("says so when you are moving away or the pace is flat", () => {
    expect(goalEta(186, 176, [rate(0.5)], T).state).toBe("away");
    expect(goalEta(186, 176, [rate(-0.05)], T).state).toBe("away");
  });
  it("is unknown with no rate and reached when close", () => {
    expect(goalEta(186, 176, [null], T).state).toBe("unknown");
    expect(goalEta(176.3, 176, [rate(-1)], T).state).toBe("reached");
  });
  it("handles gaining toward a higher goal", () => expect(goalEta(170, 175, [rate(0.5)], T).state).toBe("projected"));
});

describe("retentionCheck", () => {
  const lifts = (a: number, b: number) => [{ exercise: "Bench", series: [{ date: addDays(T, -20), e1rm: a }, { date: addDays(T, -2), e1rm: b }] }];
  const base = { waists: [], proteinAvgG: 150, proteinTargetG: 150, today: T };
  it("reports a good pattern: steady loss, strength held, protein on target", () => {
    const r = retentionCheck({ ...base, weighIns: series(14, 194, -0.15), lifts: lifts(200, 204) });
    expect(r.verdict).toBe("good");
    expect(r.signals.find(s => s.key === "strength")!.state).toBe("good");
  });
  it("flags fast loss with falling strength and low protein", () => {
    const r = retentionCheck({ ...base, weighIns: series(14, 194, -0.35), lifts: lifts(200, 185), proteinAvgG: 90 });
    expect(r.verdict).toBe("watch");
    expect(r.headline).toMatch(/pace|strength|protein/);
    expect(r.signals.filter(s => s.state === "watch").length).toBe(3);
  });
  it("flags weight down but waist unchanged", () => {
    const r = retentionCheck({
      ...base, weighIns: series(28, 196, -0.2), lifts: lifts(200, 202),
      waists: [{ date: addDays(T, -20), inches: 34 }, { date: T, inches: 34 }],
    });
    expect(r.signals.find(s => s.key === "waist")!.state).toBe("watch");
  });
  it("calls strength mixed when one lift slips a little, and watch when it slips a lot", () => {
    const two = (a: number) => [
      { exercise: "Bench", series: [{ date: addDays(T, -20), e1rm: 200 }, { date: addDays(T, -2), e1rm: 210 }] },
      { exercise: "Squat", series: [{ date: addDays(T, -20), e1rm: 300 }, { date: addDays(T, -2), e1rm: a }] },
    ];
    const st = (a: number) => retentionCheck({ ...base, weighIns: series(14, 194, -0.15), lifts: two(a) }).signals.find(s => s.key === "strength")!;
    expect(st(287).state).toBe("neutral"); // -4.3%
    expect(st(287).detail).toMatch(/^Mixed/);
    expect(retentionCheck({ ...base, weighIns: series(14, 194, -0.15), lifts: two(287) }).headline).toMatch(/strength is mixed/);
    expect(st(280).state).toBe("watch"); // -6.7%
  });
  it("does not guess with almost nothing logged", () => {
    const r = retentionCheck({ ...base, weighIns: series(2, 190, 0), lifts: [], proteinAvgG: null });
    expect(r.verdict).toBe("unknown");
  });
});

describe("aroundChanges", () => {
  const days = (n: number, g: number) => Array.from({ length: n }, (_, i) => ({ date: addDays(T, -(n - 1 - i)), proteinG: g }));
  it("groups changes within a week and calls them tangled", () => {
    const w = aroundChanges({
      markers: [
        { date: addDays(T, -6), compound: "A", kind: "change", doseMcg: 650 },
        { date: addDays(T, -2), compound: "B", kind: "change", doseMcg: 650 },
      ],
      weighIns: series(40, 200, -0.1), days: days(40, 140), today: T,
    });
    expect(w).toHaveLength(1);
    expect(w[0].tangled).toBe(true);
    expect(w[0].items).toHaveLength(2);
    expect(w[0].status).toBe("too_recent");
  });
  it("compares pace before and after a single change", () => {
    const wi = [...series(20, 200, -0.1).map(p => ({ ...p, date: addDays(p.date, -20) })), ...series(20, 198, -0.3)];
    const w = aroundChanges({ markers: [{ date: addDays(T, -20), compound: "A", kind: "change", doseMcg: 500 }], weighIns: wi, days: days(40, 150), today: T });
    expect(w[0].status).toBe("ok");
    expect(w[0].before.rate!.lbPerWeek).toBeGreaterThan(w[0].after.rate!.lbPerWeek);
    expect(w[0].before.proteinAvgG).toBe(150);
  });
  it("says not enough weigh-ins when a side is empty", () => {
    const w = aroundChanges({ markers: [{ date: addDays(T, -20), compound: "A", kind: "start", doseMcg: 500 }], weighIns: series(10, 190, 0), days: [], today: T });
    expect(w[0].status).toBe("not_enough_weights");
  });
  it("keeps far-apart changes separate", () => {
    const w = aroundChanges({
      markers: [{ date: addDays(T, -40), compound: "A", kind: "start", doseMcg: 1 }, { date: addDays(T, -10), compound: "A", kind: "change", doseMcg: 2 }],
      weighIns: [], days: [], today: T,
    });
    expect(w).toHaveLength(2);
    expect(w[0].tangled).toBe(false);
  });
});
