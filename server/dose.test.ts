import { describe, it, expect } from "vitest";
import { fmtMg, mgToMcg, nextSite, doseStatus, dayAfterDose, sideEffectsByDay, intervalsByCompound, statusByCompound, dosesBefore, DAY_MS } from "../shared/dose";

const D = DAY_MS;
const dose = (id: number, daysAgo: number, mcg = 1000, compound = "Retatrutide") => ({ id, compound, doseMcg: mcg, site: null, loggedAt: 100 * D - daysAgo * D });
const NOW = 100 * D;

describe("units and sites", () => {
  it("formats mg and converts to micrograms", () => {
    expect(fmtMg(1000)).toBe("1 mg");
    expect(fmtMg(250)).toBe("250 mcg");
    expect(fmtMg(2500)).toBe("2.5 mg");
    expect(mgToMcg(0.25)).toBe(250);
    expect(mgToMcg(2.5)).toBe(2500);
  });
  it("rotates injection sites and wraps around", () => {
    expect(nextSite(null)).toBe("abdomen_left");
    expect(nextSite("abdomen_left")).toBe("abdomen_right");
    expect(nextSite("arm_right")).toBe("abdomen_left");
  });
});

describe("doseStatus", () => {
  it("is 'none' with no doses", () => {
    expect(doseStatus([], 7, NOW).state).toBe("none");
  });
  it("counts days from the first dose of the same compound and finds the next due date", () => {
    const s = doseStatus([dose(1, 14), dose(2, 7), dose(3, 0)], 7, NOW);
    expect(s.dayNumber).toBe(15);
    expect(s.state).toBe("upcoming");
    expect(s.daysUntil).toBe(7);
  });
  it("flags due and overdue", () => {
    expect(doseStatus([dose(1, 7)], 7, NOW).state).toBe("due");
    expect(doseStatus([dose(1, 10)], 7, NOW).state).toBe("overdue");
  });
});

describe("side effects by day since dose", () => {
  const doses = [dose(1, 7), dose(2, 0)];
  const sym = (daysAfterDose1: number, type = "nausea", severity = 3) => ({ type, severity, loggedAt: NOW - 7 * D + daysAfterDose1 * D + 1000 });

  it("finds the preceding dose and its day", () => {
    expect(dayAfterDose(doses, NOW - 7 * D + 2.5 * D)?.day).toBe(2);
    expect(dayAfterDose(doses, NOW - 8 * D)).toBeNull();
    expect(dayAfterDose([dose(1, 20)], NOW, 7)).toBeNull();
  });

  it("buckets negative symptoms by day and reports a peak only with 3+ entries", () => {
    const r = sideEffectsByDay(doses, [sym(1), sym(1.2), sym(1.4, "nausea", 5), sym(4, "fatigue"), sym(0.5, "better_digestion")]);
    expect(r.chart[1].count).toBe(3);
    expect(r.total).toBe(4);
    expect(r.peaks).toHaveLength(1);
    expect(r.peaks[0]).toMatchObject({ type: "nausea", peakDay: 1, n: 3 });
  });
});

describe("per-compound schedules", () => {
  const bpc = (id: number, daysAgo: number) => ({ id, compound: "BPC-157", doseMcg: 250, site: null, loggedAt: NOW - daysAgo * D });
  const doses = [dose(1, 14), dose(2, 7), dose(3, 0), bpc(10, 2), bpc(11, 1), bpc(12, 0)];

  it("uses the schedule the user set, else the median gap of their own doses, else 7", () => {
    const inferred = intervalsByCompound(doses);
    expect(inferred.get("retatrutide")).toMatchObject({ days: 7, explicit: false });
    expect(inferred.get("bpc-157")).toMatchObject({ days: 1, explicit: false });
    const set = intervalsByCompound(doses, [{ compound: "retatrutide", intervalDays: 5 }]);
    expect(set.get("retatrutide")).toMatchObject({ days: 5, explicit: true });
    expect(intervalsByCompound([dose(1, 0)]).get("retatrutide")?.days).toBe(7);
  });

  it("gives each compound its own status", () => {
    const rows = statusByCompound(doses, intervalsByCompound(doses), NOW);
    const reta = rows.find(r => r.key === "retatrutide")!;
    const b = rows.find(r => r.key === "bpc-157")!;
    expect(reta.dayNumber).toBe(15);
    expect(reta.daysUntil).toBe(7);
    expect(b.dayNumber).toBe(3);
    expect(b.state).toBe("upcoming");
  });

  it("ignores daily compounds when working out 'day N after a dose'", () => {
    const iv = intervalsByCompound(doses);
    const r = dosesBefore(doses, iv, NOW - 5 * D);
    expect(r.map(x => x.dose.compound)).toEqual(["Retatrutide"]);
    expect(r[0].day).toBe(2);
  });
});
