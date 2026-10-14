import { describe, it, expect } from "vitest";
import { computeTriggers } from "../shared/triggers";

const H = 3_600_000;
const NOW = 1000 * H;
let id = 0;
const meal = (hoursAgo: number, foods: string[], hidden: string[] = []) => ({
  id: ++id,
  loggedAt: NOW - hoursAgo * H,
  foods: foods.map((name, i) => ({ name, hiddenIngredients: i === 0 ? hidden : [] })),
});
const sym = (hoursAgo: number, type = "bloating", severity = 3) => ({ type, severity, loggedAt: NOW - hoursAgo * H });

describe("computeTriggers", () => {
  it("reports a trigger only with enough exposures and a clear lift over other meals", () => {
    const meals = [
      meal(100, ["Pasta"], ["garlic"]),
      meal(80, ["Soup"], ["garlic"]),
      meal(60, ["Bread"], ["garlic"]),
      meal(40, ["Rice"]),
      meal(30, ["Chicken"]),
      meal(20, ["Salad"]),
    ];
    // bloating 2 h after each garlic meal, never after the others
    const symptoms = [sym(98), sym(78), sym(58)];
    const r = computeTriggers(meals, symptoms, NOW);
    const garlic = r.find(t => t.names.includes("garlic"));
    expect(garlic).toMatchObject({ status: "trigger", symptom: "bloating", exposures: 3, hits: 3, otherHits: 0 });
    expect(garlic!.rate).toBe(1);
  });

  it("keeps a single occurrence in 'watching' without a trigger verdict", () => {
    const meals = [meal(50, ["Pasta"], ["garlic"]), meal(30, ["Rice"]), meal(20, ["Salad"])];
    const r = computeTriggers(meals, [sym(48)], NOW);
    expect(r.every(t => t.status === "watching")).toBe(true);
    expect(r.find(t => t.names.includes("garlic"))?.exposures).toBe(1);
  });

  it("does not flag a food when the symptom is just as common after other meals", () => {
    const meals = [
      meal(100, ["A"], ["onion"]), meal(80, ["B"], ["onion"]), meal(60, ["C"], ["onion"]),
      meal(40, ["D"]), meal(30, ["E"]), meal(20, ["F"]),
    ];
    const symptoms = [sym(98), sym(78), sym(38), sym(28), sym(18)];
    const r = computeTriggers(meals, symptoms, NOW);
    expect(r.find(t => t.status === "trigger" && t.names.includes("onion"))).toBeUndefined();
  });

  it("skips meals whose outcome window is not finished and ignores positive outcomes", () => {
    const meals = [meal(2, ["Pasta"], ["garlic"])];
    expect(computeTriggers(meals, [sym(1)], NOW)).toEqual([]);
    const old = [meal(50, ["Pasta"], ["garlic"])];
    expect(computeTriggers(old, [sym(48, "better_digestion")], NOW)).toEqual([]);
  });

  it("links foods that always appear together into one entry", () => {
    const meals = [
      meal(100, ["A"], ["garlic", "onion"]), meal(80, ["B"], ["garlic", "onion"]), meal(60, ["C"], ["garlic", "onion"]),
      meal(40, ["D"]), meal(30, ["E"]),
    ];
    const r = computeTriggers(meals, [sym(98), sym(78), sym(58)], NOW);
    const entry = r.find(t => t.names.includes("garlic"));
    expect(entry?.names).toEqual(expect.arrayContaining(["garlic", "onion"]));
    expect(r.filter(t => t.names.includes("onion")).length).toBe(1);
  });
});
