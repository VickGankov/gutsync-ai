import { describe, it, expect } from "vitest";
import { buildReport, symptomLabel } from "./model";
import { renderReportPdf } from "./pdf";
import { fixtureInput, NOW } from "./fixture";
import { parseReportQuery, allowReport } from "./service";

describe("buildReport", () => {
  const m = buildReport(fixtureInput());
  it("summarizes the period", () => {
    expect(m.overview.periodDays).toBe(30);
    expect(m.overview.meals).toBeGreaterThan(80);
    expect(m.overview.daysLogged).toBeGreaterThan(25);
  });
  it("counts symptoms per type, worst first, positives apart", () => {
    expect(m.symptoms[0].label).toBe("Bloating");
    expect(m.symptoms.find(s => s.label === "Better sleep")).toBeUndefined();
    expect(m.positives.map(p => p.label)).toContain("Better sleep");
  });
  it("lists a possible trigger with honest wording and a range", () => {
    const t = m.triggers.find(x => /garlic/i.test(x.names));
    expect(t).toBeTruthy();
    expect(t!.status).toBe("Possible");
    expect(t!.range).toMatch(/\d+% to \d+%/);
  });
  it("computes weight change and nutrition averages over logged days only", () => {
    expect(m.body.weight!.change).toBeLessThan(0);
    expect(m.nutrition!.proteinAvgG).toBe(140);
    expect(m.nutrition!.waterAvgOz).toBeCloseTo(60.9, 0);
  });
  it("flags labs against the lab's own range and shows the previous result", () => {
    const ldl = m.labs!.find(l => l.marker === "LDL cholesterol")!;
    expect(ldl.value).toBe(128);
    expect(ldl.status).toBe("above");
    expect(ldl.previous!.value).toBe(142);
    expect(m.labs!.find(l => l.marker.startsWith("Vitamin D"))!.status).toBe("in");
  });
  it("leaves labs and protocol out when the plan does not include them", () => {
    const x = buildReport(fixtureInput({ includeLabs: false, includeProtocol: false }));
    expect(x.labs).toBeNull();
    expect(x.protocol).toBeNull();
  });
  it("caps the diary at 14 days and says so", () => {
    expect(m.diary.days.length).toBe(14);
    expect(m.diary.truncatedFrom).toBeTruthy();
  });
  it("uses the person's time zone for days", () => {
    // 23:30 local on Oct 27 is 06:30 UTC on Oct 28 for a UTC-7 phone
    const at = Date.UTC(2026, 9, 28, 6, 30);
    const x = buildReport(fixtureInput({ meals: [{ mealType: "dinner", foods: [], loggedAt: at }], symptoms: [], from: at - DAYS(2), to: at + DAYS(1), tzOffsetMinutes: 420 }));
    expect(x.diary.days[0].date).toBe("Oct 27, 2026");
    expect(x.diary.days[0].lines[0]).toContain("11:30 PM");
  });
  it("never uses causal or diagnostic language", () => {
    const text = JSON.stringify(m);
    expect(text).not.toMatch(/diagnos(is|e)d? with|caused by|you have|intolerant/i);
  });
  it("labels symptom types", () => expect(symptomLabel("abdominal_pain")).toBe("Abdominal pain"));
});
const DAYS = (n: number) => n * 86_400_000;

describe("renderReportPdf", () => {
  it("produces a real multi-section PDF", async () => {
    const buf = await renderReportPdf(buildReport(fixtureInput()));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(5_000);
  });
  it("handles a person with almost no data", async () => {
    const buf = await renderReportPdf(buildReport(fixtureInput({ meals: [], symptoms: [], weights: [], waists: [], intake: [], lifts: [], doses: [], supplementLogs: [], labs: [], challenges: [], triggers: [] })));
    expect(buf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

describe("report query and rate limit", () => {
  it("accepts only known periods and sane time zones", () => {
    expect(parseReportQuery({ days: "14", tz: "420" })).toEqual({ days: 14, tz: 420 });
    expect(parseReportQuery({ days: "9999", tz: "abc" })).toEqual({ days: 30, tz: 0 });
    expect(parseReportQuery({ days: "7", tz: "99999" }).tz).toBe(0);
  });
  it("limits to 6 a minute per person", () => {
    const u = 987654;
    for (let i = 0; i < 6; i++) expect(allowReport(u, NOW + i)).toBe(true);
    expect(allowReport(u, NOW + 10)).toBe(false);
    expect(allowReport(u, NOW + 61_000)).toBe(true);
  });
});
