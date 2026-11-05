import { describe, it, expect } from "vitest";
import { reconstitute, validateRecon, doseForUnits, waterForUnits } from "../shared/reconstitution";

const base = { vialMcg: 5000, waterMl: 2, doseMcg: 250, syringeUnits: 100 as const };

describe("reconstitution math", () => {
  it("5 mg in 2 mL is 2.5 mg/mL, so 250 mcg is 0.1 mL = 10 units", () => {
    const x = reconstitute(base);
    expect(x.mgPerMl).toBe(2.5);
    expect(x.mcgPerMl).toBe(2500);
    expect(x.mlPerDose).toBe(0.1);
    expect(x.units).toBe(10);
    expect(x.dosesPerVial).toBe(20);
    expect(x.warnings).toEqual([]);
  });
  it("10 mg in 1 mL at 1 mg is 10 units; the same dose in 2 mL is 20 units", () => {
    expect(reconstitute({ ...base, vialMcg: 10_000, waterMl: 1, doseMcg: 1000 }).units).toBe(10);
    expect(reconstitute({ ...base, vialMcg: 10_000, waterMl: 2, doseMcg: 1000 }).units).toBe(20);
  });
  it("more water means more units for the same dose (the classic mix-up)", () => {
    expect(reconstitute({ ...base, waterMl: 1 }).units).toBe(5);
    expect(reconstitute({ ...base, waterMl: 4 }).units).toBe(20);
  });
  it("non-round answers keep two decimals and report the rounding error of a whole-unit draw", () => {
    const x = reconstitute({ vialMcg: 5000, waterMl: 3, doseMcg: 250, syringeUnits: 100 });
    expect(x.units).toBe(15);
    const y = reconstitute({ vialMcg: 5000, waterMl: 2.5, doseMcg: 300, syringeUnits: 100 });
    expect(y.units).toBe(15);
    const z = reconstitute({ vialMcg: 5000, waterMl: 2, doseMcg: 333, syringeUnits: 100 });
    expect(z.units).toBe(13.32);
    expect(z.roundedUnits).toBe(13);
    expect(z.roundedDoseMcg).toBe(325);
    expect(z.roundingErrorPct).toBe(-2.4);
  });
  it("shows its working so it can be checked by hand", () => {
    const x = reconstitute(base);
    expect(x.steps).toHaveLength(3);
    expect(x.steps[0]).toContain("2500 mcg per mL");
    expect(x.steps[2]).toContain("10 units");
  });
  it("floors doses per vial and survives float noise", () => {
    expect(reconstitute({ ...base, doseMcg: 300 }).dosesPerVial).toBe(16);
    expect(reconstitute({ vialMcg: 1000, waterMl: 1, doseMcg: 100, syringeUnits: 100 }).dosesPerVial).toBe(10);
  });
});

describe("warnings", () => {
  it("flags a dose bigger than the syringe", () => {
    const x = reconstitute({ ...base, waterMl: 10, doseMcg: 1000, syringeUnits: 50 });
    expect(x.units).toBe(200);
    expect(x.warnings.map(w => w.kind)).toContain("over_syringe");
  });
  it("flags a tiny draw", () => {
    const x = reconstitute({ ...base, waterMl: 0.5, doseMcg: 100 });
    expect(x.units).toBe(1);
    expect(x.warnings.map(w => w.kind)).toContain("tiny_volume");
  });
  it("flags a dose larger than the vial (usually a mg/mcg slip)", () => {
    const x = reconstitute({ ...base, doseMcg: 6000 });
    expect(x.warnings.map(w => w.kind)).toContain("dose_exceeds_vial");
  });
});

describe("inputs and reverse helpers", () => {
  it("rejects missing, zero, negative and absurd inputs", () => {
    expect(validateRecon({})).toBeTruthy();
    expect(validateRecon({ ...base, waterMl: 0 })).toBeTruthy();
    expect(validateRecon({ ...base, doseMcg: -5 })).toBeTruthy();
    expect(validateRecon({ ...base, waterMl: Number.NaN })).toBeTruthy();
    expect(validateRecon({ ...base, waterMl: 500 })).toBeTruthy();
    expect(validateRecon(base)).toBeNull();
  });
  it("converts units back to a dose, and finds the water for an easy draw", () => {
    expect(doseForUnits(5000, 2, 10)).toBe(250);
    expect(doseForUnits(5000, 2, 13)).toBe(325);
    expect(waterForUnits(5000, 250, 20)).toBe(4);
    expect(reconstitute({ ...base, waterMl: waterForUnits(5000, 250, 20) }).units).toBe(20);
  });
});
