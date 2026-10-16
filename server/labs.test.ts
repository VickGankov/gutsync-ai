import { describe, it, expect } from "vitest";
import { normalizeMarker, rangeStatus, pointsInLatestUnit, changeSincePrevious, buildRuns, positionOf } from "../shared/labs";
import { cleanExtraction, parsePlainNumber } from "./labExtract";

describe("normalizeMarker", () => {
  it("maps printed names onto canonical ones", () => {
    expect(normalizeMarker("25-Hydroxy Vitamin D")).toBe("Vitamin D (25-OH)");
    expect(normalizeMarker("Ferritin, Serum")).toBe("Ferritin");
    expect(normalizeMarker("HEMOGLOBIN A1C")).toBe("Hemoglobin A1C");
    expect(normalizeMarker("Testosterone, Total, LC/MS")).toBe("Testosterone (total)");
  });
  it("keeps free testosterone apart from total and unknown names as typed", () => {
    expect(normalizeMarker("Testosterone, Free")).toBe("Free testosterone");
    expect(normalizeMarker("  Lipoprotein (a) ")).toBe("Lipoprotein (a)");
  });
  it("does not match short aliases inside other words", () => {
    expect(normalizeMarker("Basal metabolic")).toBe("Basal metabolic");
    expect(normalizeMarker("ALT")).toBe("ALT");
  });
});

describe("rangeStatus", () => {
  it("compares only to the range the user has", () => {
    expect(rangeStatus(20, 30, 100)).toBe("below");
    expect(rangeStatus(50, 30, 100)).toBe("in");
    expect(rangeStatus(120, 30, 100)).toBe("above");
    expect(rangeStatus(150, null, 200)).toBe("in");
    expect(rangeStatus(50, null, null)).toBeNull();
  });
});

describe("chart points", () => {
  const rows = [
    { value: 30, unit: "ng/mL", drawnOn: "2026-01-10" },
    { value: 75, unit: "nmol/L", drawnOn: "2026-03-01" },
    { value: 38, unit: "ng/mL", drawnOn: "2026-06-01" },
  ];
  it("uses the latest entry's unit and counts what it leaves out", () => {
    const r = pointsInLatestUnit(rows);
    expect(r.unit).toBe("ng/mL");
    expect(r.points.map(p => p.value)).toEqual([30, 38]);
    expect(r.skipped).toBe(1);
  });
  it("reports change only with two points", () => {
    expect(changeSincePrevious([rows[0]])).toBeNull();
    const c = changeSincePrevious([rows[0], rows[2]])!;
    expect(c.delta).toBe(8);
    expect(c.pct).toBeCloseTo(26.67, 1);
  });
});

describe("what you were taking", () => {
  const e = (d: string, dose: string | null = null) => ({ dateKey: d, dose });
  it("joins consecutive days into one run", () => {
    const runs = buildRuns("Vitamin D", "supplement", [e("2026-01-01"), e("2026-01-02"), e("2026-01-04")], 3);
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ startOn: "2026-01-01", endOn: "2026-01-04" });
  });
  it("splits on a break longer than the allowed gap", () => {
    expect(buildRuns("X", "supplement", [e("2026-01-01"), e("2026-01-10")], 3)).toHaveLength(2);
  });
  it("splits on a dose change so the change is visible", () => {
    const runs = buildRuns("Vitamin D", "supplement", [e("2026-01-01", "2000 IU"), e("2026-01-02", "2000 IU"), e("2026-01-03", "5000 IU")], 3);
    expect(runs.map(r => r.dose)).toEqual(["2000 IU", "5000 IU"]);
  });
  it("places dates inside the chart span", () => {
    expect(positionOf("2026-01-01", "2026-01-01", "2026-01-11")).toBe(0);
    expect(positionOf("2026-01-06", "2026-01-01", "2026-01-11")).toBe(0.5);
    expect(positionOf("2025-12-01", "2026-01-01", "2026-01-11")).toBe(0);
  });
});

describe("report extraction cleanup", () => {
  it("only accepts plain numbers", () => {
    expect(parsePlainNumber("1,234.5")).toBe(1234.5);
    expect(parsePlainNumber("<0.5")).toBeNull();
    expect(parsePlainNumber("Negative")).toBeNull();
    expect(parsePlainNumber("")).toBeNull();
  });
  it("drops rows it can't vouch for and counts them", () => {
    const r = cleanExtraction({
      collectedOn: "2026-05-02",
      results: [
        { marker: "Ferritin, Serum", value: "88", unit: "ng/mL", refLow: "30", refHigh: "400" },
        { marker: "CRP", value: "<0.3", unit: "mg/L", refLow: "", refHigh: "" },
        { marker: "Glucose", value: "92", unit: "", refLow: "", refHigh: "" },
        { marker: "LDL", value: "130", unit: "mg/dL", refLow: "", refHigh: "100" },
      ],
    }, "2026-10-16");
    expect(r.rows.map(x => x.marker)).toEqual(["Ferritin", "LDL cholesterol"]);
    expect(r.rows[1]).toMatchObject({ refLow: null, refHigh: 100 });
    expect(r.skipped).toBe(2);
    expect(r.collectedOn).toBe("2026-05-02");
  });
  it("ignores a collection date that is invalid or in the future, and an inverted range", () => {
    expect(cleanExtraction({ collectedOn: "2027-01-01", results: [] }, "2026-10-16").collectedOn).toBeNull();
    expect(cleanExtraction({ collectedOn: "not a date", results: [] }).collectedOn).toBeNull();
    const r = cleanExtraction({ results: [{ marker: "TSH", value: "2", unit: "µIU/mL", refLow: "5", refHigh: "1" }] });
    expect(r.rows[0]).toMatchObject({ refLow: null, refHigh: null });
  });
  it("survives garbage", () => {
    expect(cleanExtraction(null)).toEqual({ collectedOn: null, rows: [], skipped: 0 });
    expect(cleanExtraction({ results: "x" }).rows).toEqual([]);
  });
});
