import { describe, it, expect } from "vitest";
import { cleanSensitivities, declaredStats, sensitivitiesIn } from "../shared/sensitivities";

const H = 3600_000;
const f = (name: string, extra: any = {}) => ({ name, ...extra });

describe("sensitivitiesIn", () => {
  it("flags foods by name, hidden ingredients and ingredient lists", () => {
    expect(sensitivitiesIn(f("Greek yogurt"), ["lactose"])).toEqual(["lactose"]);
    expect(sensitivitiesIn(f("Pasta"), ["gluten"])).toEqual(["gluten"]);
    expect(sensitivitiesIn(f("Tomato sauce", { hiddenIngredients: ["garlic", "onion"] }), ["garlic_onion"])).toEqual(["garlic_onion"]);
    expect(sensitivitiesIn(f("Protein bar", { ingredients: ["whey protein", "sorbitol"] }), ["lactose", "polyols"])).toEqual(["lactose", "polyols"]);
  });
  it("only reports what the user selected", () => {
    expect(sensitivitiesIn(f("Pasta with garlic"), ["lactose"])).toEqual([]);
    expect(sensitivitiesIn(f("Pasta with garlic"), [])).toEqual([]);
  });
  it("does not flag the obvious look-alikes", () => {
    expect(sensitivitiesIn(f("Almond milk"), ["lactose"])).toEqual([]);
    expect(sensitivitiesIn(f("Peanut butter"), ["lactose"])).toEqual([]);
    expect(sensitivitiesIn(f("Gluten-free bread"), ["gluten"])).toEqual([]);
    expect(sensitivitiesIn(f("Rice noodles"), ["gluten"])).toEqual([]);
    expect(sensitivitiesIn(f("Green beans"), ["legumes"])).toEqual([]);
    expect(sensitivitiesIn(f("Black beans"), ["legumes"])).toEqual(["legumes"]);
    expect(sensitivitiesIn(f("Milk chocolate"), ["lactose"])).toEqual(["lactose"]);
  });
});

describe("cleanSensitivities", () => {
  it("keeps known keys once, in standard order", () => {
    expect(cleanSensitivities(["gluten", "bogus", "lactose", "gluten"])).toEqual(["lactose", "gluten"]);
    expect(cleanSensitivities(null)).toEqual([]);
  });
});

describe("declaredStats", () => {
  const now = 1_000 * H;
  const meal = (id: number, hoursAgo: number, name: string) => ({ id, loggedAt: now - hoursAgo * H, foods: [f(name)] });
  it("compares meals with the food against the rest, and skips meals too recent to judge", () => {
    const meals = [meal(1, 50, "Cheese pizza"), meal(2, 40, "Cheese omelette"), meal(3, 30, "Rice and chicken"), meal(4, 20, "Salad"), meal(5, 2, "Yogurt")];
    const symptoms = [{ type: "bloating", loggedAt: now - 49 * H }, { type: "gas", loggedAt: now - 39 * H }, { type: "better_sleep", loggedAt: now - 29 * H }];
    const [s] = declaredStats(["lactose"], meals, symptoms, now);
    expect(s).toMatchObject({ key: "lactose", exposures: 2, hits: 2, otherMeals: 2, otherHits: 0 }); // meal 5 is too recent; positive outcomes don't count
  });
  it("returns nothing for an empty selection", () => {
    expect(declaredStats([], [meal(1, 50, "Cheese")], [], now)).toEqual([]);
  });
});
