import { describe, it, expect } from "vitest";
import { classifyIngredients } from "../shared/ingredients";

describe("classifyIngredients", () => {
  it("treats the zero-sugar vitamin water label as low FODMAP (sweeteners are not FODMAPs)", () => {
    const label = ["Purified Water", "Contains Less Than 2% Of Citric Acid", "Ascorbic Acid (Vitamin C)", "Natural Flavor", "Gum Arabic", "Glycerol Ester Of Rosin", "Magnesium Lactate", "Vitamin A Palmitate", "Zinc Gluconate", "Niacinamide (B3)", "Cyanocobalamin (B12)", "Folic Acid", "Sucralose", "Acesulfame Potassium"];
    expect(classifyIngredients(label)).toEqual({ triggers: [], fodmap: "low" });
  });

  it("flags high-FODMAP sweeteners and fibers", () => {
    const r = classifyIngredients(["Water", "High Fructose Corn Syrup", "Sorbitol", "Chicory Root Fiber"]);
    expect(r.fodmap).toBe("high");
    expect(r.triggers).toEqual(expect.arrayContaining(["high-fructose corn syrup", "sorbitol", "chicory root fiber"]));
  });

  it("flags lactose and whey as moderate, but not magnesium lactate", () => {
    expect(classifyIngredients(["Whey Protein Concentrate", "Cocoa"]).fodmap).toBe("moderate");
    expect(classifyIngredients(["Magnesium Lactate"]).fodmap).toBe("low");
  });

  it("high beats moderate and onion/garlic are caught", () => {
    const r = classifyIngredients(["Wheat Flour", "Garlic Powder", "Onion Powder"]);
    expect(r.fodmap).toBe("high");
    expect(r.triggers).toEqual(expect.arrayContaining(["garlic", "onion", "wheat/rye/barley"]));
  });

  it("handles empty input", () => {
    expect(classifyIngredients([])).toEqual({ triggers: [], fodmap: "low" });
  });
});
