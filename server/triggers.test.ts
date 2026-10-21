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
      meal(200, ["Pasta"], ["garlic"]),
      meal(180, ["Soup"], ["garlic"]),
      meal(160, ["Bread"], ["garlic"]),
      meal(140, ["Curry"], ["garlic"]),
      meal(120, ["Stew"], ["garlic"]),
      meal(40, ["Rice"]),
      meal(30, ["Chicken"]),
      meal(20, ["Salad"]),
    ];
    // bloating 2 h after each garlic meal, never after the others
    const symptoms = [sym(198), sym(178), sym(158), sym(138), sym(118)];
    const r = computeTriggers(meals, symptoms, NOW);
    const garlic = r.find(t => t.names.includes("garlic"));
    expect(garlic).toMatchObject({ status: "trigger", symptom: "bloating", exposures: 5, hits: 5, otherHits: 0 });
    expect(garlic!.rate).toBe(1);
  });

  it("keeps a food seen only 3 or 4 times in 'watching', never a trigger", () => {
    const meals = [
      meal(100, ["Pasta"], ["garlic"]), meal(80, ["Soup"], ["garlic"]), meal(60, ["Bread"], ["garlic"]), meal(50, ["Curry"], ["garlic"]),
      meal(40, ["Rice"]), meal(30, ["Chicken"]), meal(20, ["Salad"]),
    ];
    const r = computeTriggers(meals, [sym(98), sym(78), sym(58), sym(48)], NOW);
    const garlic = r.find(t => t.names.includes("garlic"));
    expect(garlic).toMatchObject({ status: "watching", exposures: 4, hits: 4 });
    expect(r.some(t => t.status === "trigger")).toBe(false);
  });

  it("keeps a single occurrence in 'watching' without a trigger verdict", () => {
    const meals = [meal(50, ["Pasta"], ["garlic"]), meal(30, ["Rice"]), meal(20, ["Salad"])];
    const r = computeTriggers(meals, [sym(48)], NOW);
    expect(r.every(t => t.status === "watching")).toBe(true);
    expect(r.find(t => t.names.includes("garlic"))?.exposures).toBe(1);
  });

  it("does not flag a food when the symptom is just as common after other meals", () => {
    const meals = [
      meal(200, ["A"], ["onion"]), meal(180, ["B"], ["onion"]), meal(160, ["C"], ["onion"]), meal(140, ["G"], ["onion"]), meal(120, ["H"], ["onion"]),
      meal(40, ["D"]), meal(30, ["E"]), meal(20, ["F"]),
    ];
    const symptoms = [sym(198), sym(178), sym(38), sym(28), sym(18)];
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
    const both = ["garlic", "onion"];
    const meals = [
      meal(200, ["A"], both), meal(180, ["B"], both), meal(160, ["C"], both), meal(140, ["G"], both), meal(120, ["H"], both),
      meal(40, ["D"]), meal(30, ["E"]),
    ];
    const r = computeTriggers(meals, [sym(198), sym(178), sym(158), sym(138)], NOW);
    const entry = r.find(t => t.names.includes("garlic"));
    expect(entry?.names).toEqual(expect.arrayContaining(["garlic", "onion"]));
    expect(r.filter(t => t.names.includes("onion")).length).toBe(1);
  });

  it("counts hits that came within 3 days after a logged dose", () => {
    const meals = [
      meal(200, ["Pasta"], ["garlic"]), meal(180, ["Soup"], ["garlic"]), meal(160, ["Bread"], ["garlic"]),
      meal(140, ["Curry"], ["garlic"]), meal(120, ["Stew"], ["garlic"]),
      meal(40, ["Rice"]), meal(30, ["Chicken"]), meal(20, ["Salad"]),
    ];
    const symptoms = [sym(198), sym(178), sym(158), sym(138), sym(118)];
    const doses = [NOW - 260 * H]; // only the first symptom (62 h later) is within 3 days of it
    const garlic = computeTriggers(meals, symptoms, NOW, undefined, doses).find(t => t.names.includes("garlic"));
    expect(garlic?.hitsNearDose).toBe(1);
  });
});
