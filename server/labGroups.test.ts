import { describe, it, expect } from "vitest";
import { categoryOf, groupMarkers } from "../shared/labGroups";
import { COMMON_MARKERS } from "../shared/labs";

describe("lab categories", () => {
  it("files the common markers where a person would look for them", () => {
    const expected: Record<string, string> = {
      "Hemoglobin A1C": "Metabolic", "Glucose (fasting)": "Metabolic", Insulin: "Metabolic",
      TSH: "Thyroid", "LDL cholesterol": "Lipids", Triglycerides: "Lipids",
      "Testosterone (total)": "Hormones", "Free testosterone": "Hormones", "IGF-1": "Hormones", Cortisol: "Hormones", SHBG: "Hormones",
      ALT: "Liver", AST: "Liver", Creatinine: "Kidney", eGFR: "Kidney",
      "hs-CRP": "Inflammation", "Vitamin D (25-OH)": "Vitamins & minerals", Ferritin: "Vitamins & minerals", Iron: "Vitamins & minerals", "Vitamin B12": "Vitamins & minerals",
      Hemoglobin: "Blood count", Hematocrit: "Blood count", Sodium: "Electrolytes", Potassium: "Electrolytes", Calcium: "Electrolytes",
    };
    for (const [name, cat] of Object.entries(expected)) expect(categoryOf(name), name).toBe(cat);
  });
  it("every built-in marker lands in a real category, never undefined", () => {
    for (const m of COMMON_MARKERS) expect(categoryOf(m.name)).not.toBe("Other");
  });
  it("unknown, odd or imported names fall back to Other instead of disappearing", () => {
    expect(categoryOf("Something New")).toBe("Other");
    expect(categoryOf("")).toBe("Other");
    expect(categoryOf("Z SCORE (MALE)")).toBe("Hormones");
    expect(categoryOf("Non-HDL cholesterol")).toBe("Lipids");
  });
});

describe("picker grouping", () => {
  const items = [
    { marker: "TSH", status: "in" as const }, { marker: "IGF-1", status: "above" as const }, { marker: "Ferritin", status: "below" as const },
    { marker: "Glucose (fasting)", status: "in" as const }, { marker: "ALT", status: null }, { marker: "17-OH Progesterone", status: "in" as const },
    { marker: "Mystery", status: null },
  ];
  it("category mode puts out-of-range markers first, once each, then fixed category order", () => {
    const g = groupMarkers(items, "category");
    expect(g[0].title).toBe("Needs attention");
    expect(g[0].items.map(i => i.marker)).toEqual(["Ferritin", "IGF-1"]);
    expect(g.map(x => x.title)).toEqual(["Needs attention", "Hormones", "Metabolic", "Thyroid", "Liver", "Other"]);
    const all = g.flatMap(x => x.items.map(i => i.marker));
    expect(all.sort()).toEqual(items.map(i => i.marker).sort());
  });
  it("A-Z mode groups by first letter with digits and symbols last", () => {
    const g = groupMarkers(items, "alpha");
    expect(g.map(x => x.title)).toEqual(["A", "F", "G", "I", "M", "T", "#"]);
    expect(g[g.length - 1].items.map(i => i.marker)).toEqual(["17-OH Progesterone"]);
  });
  it("search filters either mode and drops empty groups", () => {
    expect(groupMarkers(items, "category", "gluc").map(g => g.title)).toEqual(["Metabolic"]);
    expect(groupMarkers(items, "alpha", "xyz")).toEqual([]);
  });
});
