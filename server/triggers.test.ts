import { describe, it, expect } from "vitest";
import { computeTriggers, wilsonInterval, sampleLabel, MIN_DAYS } from "../shared/triggers";

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
      meal(100, ["Eggs"]),
      meal(80, ["Fish"]),
      meal(60, ["Oats"]),
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

  it("does not call a food a trigger when it is eaten on too few different days", () => {
    // five garlic meals all on the same day, each followed by bloating
    const base = NOW - 300 * H;
    const same = [0, 1, 2, 3, 4].map(i => ({ id: ++id, loggedAt: base + i * H, foods: [{ name: "Snack", hiddenIngredients: ["garlic"] }] }));
    const others = [meal(100, ["A"]), meal(90, ["B"]), meal(80, ["C"]), meal(70, ["D"]), meal(60, ["E"])];
    const symptoms = same.map(m => ({ type: "bloating", severity: 3, loggedAt: m.loggedAt + 30 * 60_000 }));
    const garlic = computeTriggers([...same, ...others], symptoms, NOW).find(t => t.names.includes("garlic"));
    expect(garlic?.status).toBe("watching");
    expect(garlic?.days).toBe(1);
    expect(garlic!.days).toBeLessThan(MIN_DAYS);
  });

  it("marks a food eaten in most meals as 'common' instead of a trigger", () => {
    // coffee with 8 of 10 meals, bloating after most of them, but little to compare against
    const meals = Array.from({ length: 10 }, (_, i) => meal(300 - i * 24, i < 8 ? ["Coffee"] : ["Water"]));
    const symptoms = meals.slice(0, 6).map(m => ({ type: "bloating", severity: 2, loggedAt: m.loggedAt + 2 * H }));
    const r = computeTriggers(meals, symptoms, NOW);
    const coffee = r.find(t => t.names.includes("coffee"));
    expect(coffee?.status).toBe("common");
    expect(r.some(t => t.status === "trigger" && t.names.includes("coffee"))).toBe(false);
  });

  it("lists triggers before watching before common", () => {
    const meals = Array.from({ length: 10 }, (_, i) => meal(300 - i * 24, i < 8 ? ["Coffee"] : ["Water"]));
    const symptoms = meals.slice(0, 6).map(m => ({ type: "bloating", severity: 2, loggedAt: m.loggedAt + 2 * H }));
    const order = computeTriggers(meals, symptoms, NOW).map(t => t.status);
    const rank = { trigger: 0, watching: 1, common: 2 } as const;
    expect([...order].sort((a, b) => rank[a] - rank[b])).toEqual(order);
  });
});

describe("wilsonInterval and sampleLabel", () => {
  it("is wide for a small sample and tight for a large one", () => {
    const small = wilsonInterval(4, 5);
    const large = wilsonInterval(80, 100);
    expect(small.high - small.low).toBeGreaterThan(0.4);
    expect(large.high - large.low).toBeLessThan(0.2);
    expect(small.low).toBeGreaterThanOrEqual(0);
    expect(small.high).toBeLessThanOrEqual(1);
    expect(wilsonInterval(0, 0)).toEqual({ low: 0, high: 1 });
  });
  it("ties the sample description to the number of meals", () => {
    expect([sampleLabel(5), sampleLabel(8), sampleLabel(14), sampleLabel(15)]).toEqual(["small", "fair", "fair", "larger"]);
  });
});
