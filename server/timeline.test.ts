import { describe, it, expect } from "vitest";
import { attributeSymptoms, formatGap } from "../shared/timeline";

const H = 3_600_000;
const m = (id: number, h: number) => ({ id, loggedAt: h * H });
const s = (id: number, h: number) => ({ id, loggedAt: h * H });

describe("attributeSymptoms", () => {
  it("links a symptom to the meal before it within the window", () => {
    const r = attributeSymptoms([m(1, 8)], [s(10, 10)]);
    expect(r.byMeal.get(1)?.map(x => x.symptom.id)).toEqual([10]);
    expect(r.bySymptom.get(10)?.afterMs).toBe(2 * H);
  });

  it("uses the latest meal, so a later meal takes over", () => {
    const r = attributeSymptoms([m(1, 8), m(2, 12)], [s(10, 13)]);
    expect(r.byMeal.get(2)?.length).toBe(1);
    expect(r.byMeal.get(1)).toBeUndefined();
  });

  it("ignores symptoms outside the window or before any meal", () => {
    const r = attributeSymptoms([m(1, 8)], [s(10, 15), s(11, 7)]);
    expect(r.bySymptom.size).toBe(0);
  });

  it("keeps several symptoms per meal in time order", () => {
    const r = attributeSymptoms([m(1, 8)], [s(11, 11), s(10, 9)]);
    expect(r.byMeal.get(1)?.map(x => x.symptom.id)).toEqual([10, 11]);
  });
});

describe("formatGap", () => {
  it("formats minutes and hours", () => {
    expect(formatGap(25 * 60_000, "later")).toBe("25 min later");
    expect(formatGap(2 * H, "earlier")).toBe("2 h earlier");
    expect(formatGap(90 * 60_000, "later")).toBe("1.5 h later");
  });
});
