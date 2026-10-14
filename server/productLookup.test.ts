import { describe, it, expect, vi } from "vitest";
import { parseIngredients, pickBestProduct, findProduct, searchOpenFoodFacts } from "./productLookup";

describe("parseIngredients", () => {
  it("splits on top-level commas and strips percentages and underscores", () => {
    expect(parseIngredients("Water, Sugar (Sucrose, Fructose) 12%, _Milk_, Natural flavors.")).toEqual(["Water", "Sugar (Sucrose, Fructose)", "Milk", "Natural flavors"]);
  });
});

describe("pickBestProduct", () => {
  const hits = [
    { product_name: "Vitamin water lemonade", brands: "Other", ingredients_text: "Water, Sugar, Citric acid" },
    { product_name: "Vitrain Zero Lemonade", brands: "Kirkland Signature", ingredients_text: "Water, Citric Acid, Sucralose, Acesulfame Potassium" },
  ];
  it("picks the hit that matches brand and product", () => {
    expect(pickBestProduct("Kirkland Signature Vitrain Zero lemonade", hits)?.ingredients).toContain("Sucralose");
  });
  it("rejects weak matches", () => {
    expect(pickBestProduct("Kirkland Signature Vitrain Zero lemonade", [hits[0]])).toBeNull();
  });
  it("ignores hits without ingredients", () => {
    expect(pickBestProduct("Brand x bar", [{ product_name: "Brand x bar", brands: "Brand", ingredients_text: "" }])).toBeNull();
  });
});

describe("searchOpenFoodFacts", () => {
  it("returns null on HTTP errors and timeouts instead of throwing", async () => {
    expect(await searchOpenFoodFacts("x y z", (async () => ({ ok: false }) as Response) as any)).toBeNull();
    expect(await searchOpenFoodFacts("x y z", (async () => { throw new Error("boom"); }) as any)).toBeNull();
  });
});

describe("findProduct", () => {
  const mk = (row: any = null) => ({ get: vi.fn().mockResolvedValue(row), save: vi.fn().mockResolvedValue(undefined) });
  it("serves cached hits without searching", async () => {
    const store = mk({ productKey: "k", name: "Cached", ingredients: ["a", "b"], found: true, createdAt: new Date() });
    const search = vi.fn();
    expect(await findProduct("Some product", store, search)).toEqual({ name: "Cached", ingredients: ["a", "b"] });
    expect(search).not.toHaveBeenCalled();
  });
  it("remembers recent misses, retries old ones", async () => {
    const search = vi.fn().mockResolvedValue(null);
    const recent = mk({ productKey: "k", name: "n", ingredients: [], found: false, createdAt: new Date() });
    expect(await findProduct("Thing", recent, search)).toBeNull();
    expect(search).not.toHaveBeenCalled();
    const old = mk({ productKey: "k", name: "n", ingredients: [], found: false, createdAt: new Date(Date.now() - 8 * 86400000) });
    await findProduct("Thing", old, search);
    expect(search).toHaveBeenCalledTimes(1);
  });
  it("saves a search result", async () => {
    const store = mk();
    const m = { name: "P", ingredients: ["x", "y"] };
    expect(await findProduct("P prod", store, async () => m)).toEqual(m);
    expect(store.save).toHaveBeenCalledWith(expect.objectContaining({ found: true, ingredients: ["x", "y"] }));
  });
});

import { shortProductName, searchFdc } from "./productLookup";
describe("shortProductName", () => {
  it("drops brand and marketing words and caps length", () => {
    expect(shortProductName("Kirkland Signature vitrain ZERO acai blueberry pomegranate vitamin-enhanced water beverage")).toBe("Vitrain Zero Acai Blueberry Pomegranate");
    expect(shortProductName("Coca-Cola Zero Sugar")).toBe("Coca-Cola Zero Sugar");
  });
});
describe("searchFdc", () => {
  it("maps branded results and returns null on failure", async () => {
    const ok = (async () => ({ ok: true, json: async () => ({ foods: [{ description: "VITRAIN ZERO ACAI BLUEBERRY POMEGRANATE", brandName: "KIRKLAND SIGNATURE", ingredients: "WATER, CITRIC ACID, SUCRALOSE, ACESULFAME POTASSIUM." }] }) }) as unknown as Response) as typeof fetch;
    const r = await searchFdc("Kirkland Signature vitrain zero acai blueberry pomegranate", ok);
    expect(r?.ingredients).toEqual(["WATER", "CITRIC ACID", "SUCRALOSE", "ACESULFAME POTASSIUM"]);
    expect(await searchFdc("x y z", (async () => { throw new Error("x"); }) as any)).toBeNull();
  });
});
