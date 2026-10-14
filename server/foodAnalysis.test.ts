import { describe, it, expect, vi } from "vitest";
import { analyzeWithCache, type Deps } from "./foodAnalysis";
import { FOOD_SEED, parseSeed } from "./foodSeed";
import { normalizeFoodKey, proteinForPortion } from "../shared/foodCache";

const fact = (foodKey: string, over: Partial<ReturnType<typeof base>> = {}) => ({ ...base(foodKey), ...over });
const base = (foodKey: string) => ({
  foodKey, name: foodKey, category: "protein" as const, fodmap: "low" as const,
  hiddenIngredients: [] as string[], proteinPer100gTenths: 310, source: "seed" as const,
});

function deps(over: Partial<Deps> = {}): Deps {
  return {
    identify: vi.fn().mockResolvedValue({ foods: [{ name: "Chicken Breasts", grams: 150 }, { name: "garlic bread", grams: 60 }], mealType: "dinner", summary: "Dinner" }),
    lookup: vi.fn().mockResolvedValue([fact("garlic bread", { category: "grain", fodmap: "high", hiddenIngredients: ["garlic"], proteinPer100gTenths: 90, source: "ai" })]),
    getFacts: vi.fn().mockResolvedValue([fact("chicken breast")]),
    saveFacts: vi.fn().mockResolvedValue(undefined),
    legacy: vi.fn().mockResolvedValue({ foods: [], mealType: "snack", summary: "legacy" }),
    ...over,
  };
}
const quiet = () => {};

describe("normalizeFoodKey", () => {
  it("lowercases, strips punctuation and singularizes", () => {
    expect(normalizeFoodKey("Grilled Chicken Breasts")).toBe("grilled chicken breast");
    expect(normalizeFoodKey("Tomatoes")).toBe("tomato");
    expect(normalizeFoodKey("peaches")).toBe("peach");
    expect(normalizeFoodKey("Hummus")).toBe("hummus");
    expect(normalizeFoodKey("  Café  au lait! ")).toBe("cafe au lait");
  });
});

describe("proteinForPortion", () => {
  it("scales per-100g protein to the portion", () => {
    expect(proteinForPortion(310, 150)).toBe(47);
    expect(proteinForPortion(310, NaN)).toBe(31);
  });
});

describe("food seed", () => {
  it("has unique keys and valid values", () => {
    const keys = FOOD_SEED.map(f => f.foodKey);
    expect(new Set(keys).size).toBe(keys.length);
    expect(FOOD_SEED.length).toBeGreaterThan(80);
    for (const f of FOOD_SEED) {
      expect(["low", "moderate", "high"]).toContain(f.fodmap);
      expect(["protein", "carb", "fat", "vegetable", "fruit", "dairy", "grain", "other"]).toContain(f.category);
      expect(Number.isFinite(f.proteinPer100gTenths)).toBe(true);
    }
  });
  it("parses hidden ingredients", () => {
    expect(parseSeed("sausage|protein|moderate|14|garlic;onion")[0].hiddenIngredients).toEqual(["garlic", "onion"]);
  });
});

describe("analyzeWithCache", () => {
  it("skips the AI lookup entirely when every food is cached", async () => {
    const d = deps({ identify: vi.fn().mockResolvedValue({ foods: [{ name: "chicken breast", grams: 100 }], mealType: "lunch", summary: "x" }) });
    const r = await analyzeWithCache("img", d, quiet);
    expect(d.lookup).not.toHaveBeenCalled();
    expect(d.legacy).not.toHaveBeenCalled();
    expect(r.foods[0]).toMatchObject({ name: "Chicken breast", fodmap: "low", proteinGrams: 31 });
  });

  it("asks the AI only about unknown foods and saves them", async () => {
    const d = deps();
    const r = await analyzeWithCache("img", d, quiet);
    expect(d.lookup).toHaveBeenCalledWith([{ key: "garlic bread", name: "garlic bread" }]);
    expect(d.saveFacts).toHaveBeenCalledTimes(1);
    expect(r.foods.map(f => f.fodmap)).toEqual(["low", "high"]);
    expect(r.foods[1]).toMatchObject({ hiddenIngredients: ["garlic"], proteinGrams: 5 });
  });

  it("returns no foods without calling the cache when nothing is identified", async () => {
    const d = deps({ identify: vi.fn().mockResolvedValue({ foods: [], mealType: "snack", summary: "" }) });
    const r = await analyzeWithCache("img", d, quiet);
    expect(r.foods).toEqual([]);
    expect(d.getFacts).not.toHaveBeenCalled();
  });

  it("falls back to the single-call analysis if identification or lookup fails", async () => {
    const a = deps({ identify: vi.fn().mockRejectedValue(new Error("boom")) });
    expect((await analyzeWithCache("img", a, quiet)).summary).toBe("legacy");
    const b = deps({ lookup: vi.fn().mockResolvedValue([]) });
    expect((await analyzeWithCache("img", b, quiet)).summary).toBe("legacy");
  });

  it("still works if the cache table is unavailable", async () => {
    const d = deps({ getFacts: vi.fn().mockRejectedValue(new Error("no table")), lookup: vi.fn().mockResolvedValue([fact("chicken breast"), fact("garlic bread")]) });
    const r = await analyzeWithCache("img", d, quiet);
    expect(r.foods).toHaveLength(2);
    expect(d.legacy).not.toHaveBeenCalled();
  });
});
