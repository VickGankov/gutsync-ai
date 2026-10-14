import { describe, it, expect, vi } from "vitest";
import { analyzeWithCache, applyLabelToFoods, type Deps } from "./foodAnalysis";
import { FOOD_SEED, parseSeed } from "./foodSeed";
import { normalizeFoodKey, proteinForPortion } from "../shared/foodCache";

const fact = (foodKey: string, over: Partial<ReturnType<typeof base>> = {}) => ({ ...base(foodKey), ...over });
const base = (foodKey: string) => ({
  foodKey, name: foodKey, category: "protein" as const, fodmap: "low" as const,
  hiddenIngredients: [] as string[], proteinPer100gTenths: 310, source: "seed" as const,
});

function deps(over: Partial<Deps> = {}): Deps {
  return {
    identify: vi.fn().mockResolvedValue({ foods: [{ name: "Chicken Breasts", grams: 150, ...G }, { name: "garlic bread", grams: 60, ...G }], mealType: "dinner", summary: "Dinner" }),
    lookup: vi.fn().mockResolvedValue([fact("garlic bread", { category: "grain", fodmap: "high", hiddenIngredients: ["garlic"], proteinPer100gTenths: 90, source: "ai" })]),
    getFacts: vi.fn().mockResolvedValue([fact("chicken breast")]),
    saveFacts: vi.fn().mockResolvedValue(undefined),
    legacy: vi.fn().mockResolvedValue({ foods: [], mealType: "snack", summary: "legacy" }),
    ...over,
  };
}
const quiet = () => {};
const G = { packaged: false, labelIngredients: [] as string[], labelProteinG: 0 };

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
    const d = deps({ identify: vi.fn().mockResolvedValue({ foods: [{ name: "chicken breast", grams: 100, ...G }], mealType: "lunch", summary: "x" }) });
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

  it("reads packaged products from their label, without cache or AI lookup", async () => {
    const d = deps({
      identify: vi.fn().mockResolvedValue({
        foods: [{ name: "Kirkland zero sugar vitamin water, lemonade", grams: 591, packaged: true, labelProteinG: 0,
          labelIngredients: ["Purified Water", "Citric Acid", "Natural Flavor", "Sucralose", "Acesulfame Potassium"] }],
        mealType: "snack", summary: "x",
      }),
    });
    const r = await analyzeWithCache("img", d, quiet);
    expect(d.getFacts).not.toHaveBeenCalled();
    expect(d.lookup).not.toHaveBeenCalled();
    expect(r.foods[0]).toMatchObject({ name: "Kirkland zero sugar vitamin water, lemonade", fodmap: "low", hiddenIngredients: [], packaged: true, basis: "label" });
  });

  it("flags triggers found on a packaged product's label", async () => {
    const d = deps({
      identify: vi.fn().mockResolvedValue({
        foods: [{ name: "Protein bar", grams: 60, packaged: true, labelProteinG: 20, labelIngredients: ["Whey Protein Isolate", "Chicory Root Fiber", "Maltitol"] }],
        mealType: "snack", summary: "x",
      }),
    });
    const r = await analyzeWithCache("img", d, quiet);
    expect(r.foods[0]).toMatchObject({ fodmap: "high", proteinGrams: 20, basis: "label" });
    expect(r.foods[0].hiddenIngredients).toEqual(expect.arrayContaining(["chicory root fiber", "maltitol"]));
  });

  it("estimates packaged products with no legible label, but never caches them", async () => {
    const d = deps({
      identify: vi.fn().mockResolvedValue({
        foods: [{ name: "Brand X cola", grams: 355, packaged: true, labelProteinG: 0, labelIngredients: [] }],
        mealType: "snack", summary: "x",
      }),
      lookup: vi.fn().mockResolvedValue([fact("pkg brand x cola", { category: "other", proteinPer100gTenths: 0, source: "ai", hiddenIngredients: ["high-fructose corn syrup"], fodmap: "high" })]),
    });
    const r = await analyzeWithCache("img", d, quiet);
    expect(d.lookup).toHaveBeenCalledWith([{ key: "pkg brand x cola", name: "Brand X cola" }]);
    expect(d.saveFacts).not.toHaveBeenCalled();
    expect(r.foods[0]).toMatchObject({ packaged: true, basis: "estimate", fodmap: "high" });
  });

  it("reports timings and cache hits", async () => {
    const r = await analyzeWithCache("img", deps(), quiet);
    expect(r.timings).toMatchObject({ path: "fast", foods: 2, cacheHits: 1 });
  });

  it("still works if the cache table is unavailable", async () => {
    const d = deps({ getFacts: vi.fn().mockRejectedValue(new Error("no table")), lookup: vi.fn().mockResolvedValue([fact("chicken breast"), fact("garlic bread")]) });
    const r = await analyzeWithCache("img", d, quiet);
    expect(r.foods).toHaveLength(2);
    expect(d.legacy).not.toHaveBeenCalled();
  });
});

describe("applyLabelToFoods", () => {
  const label = { productName: "Kirkland zero sugar vitamin water", ingredients: ["water", "sucralose", "acesulfame potassium"], proteinGrams: 0 };
  it("applies the label to the packaged item and leaves others alone", () => {
    const foods = [
      { name: "Apple", category: "fruit" as const, fodmap: "high" as const, hiddenIngredients: [] },
      { name: "Lemonade", category: "other" as const, fodmap: "high" as const, hiddenIngredients: ["high-fructose corn syrup"], packaged: true, basis: "estimate" as const },
    ];
    const out = applyLabelToFoods(foods, label);
    expect(out[0]).toEqual(foods[0]);
    expect(out[1].name).toBe(label.productName);
    expect(out[1].fodmap).toBe("low");
    expect(out[1].hiddenIngredients).toEqual([]);
    expect(out[1].basis).toBe("label");
  });
  it("ignores an unreadable label", () => {
    const foods = [{ name: "Bar", category: "other" as const, fodmap: "low" as const, hiddenIngredients: [] }];
    expect(applyLabelToFoods(foods, { ...label, ingredients: ["x"] })).toBe(foods);
  });
});
