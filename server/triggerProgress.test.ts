import { describe, it, expect } from "vitest";
import { firstTriggerProgress, mostRepeatedFood, type ProgressTrigger } from "../shared/triggerProgress";

const D = 86_400_000;
const NOW = Date.UTC(2026, 10, 4, 20, 0, 0);
const meal = (daysAgo: number, ...foods: string[]) => ({ loggedAt: NOW - daysAgo * D, foods: foods.map(name => ({ name })) });
const sym = (daysAgo: number, type = "bloating") => ({ type, loggedAt: NOW - daysAgo * D });
const base = { now: NOW, tzOffsetMinutes: 0, triggers: [] as ProgressTrigger[], challenges: [] as any[] };
const trig = (over: Partial<ProgressTrigger> = {}): ProgressTrigger => ({
  names: ["garlic"], symptom: "bloating", exposures: 6, hits: 4, rate: 0.67, otherRate: 0.1, status: "trigger", confirmation: null, ...over,
});

describe("firstTriggerProgress", () => {
  it("starts with a prompt to log a meal", () => {
    const r = firstTriggerProgress({ ...base, meals: [], symptoms: [] });
    expect(r.stage).toBe("start");
    expect(r.cta).toMatchObject({ kind: "log_meal" });
  });
  it("counts days logged, not meals", () => {
    const r = firstTriggerProgress({ ...base, meals: [meal(1, "oats"), meal(1, "rice"), meal(1, "egg")], symptoms: [] });
    expect(r.steps[0]).toMatchObject({ have: 1, need: 4, done: false });
    expect(r.headline).toBe("1 of 4 days logged");
  });
  it("asks for symptoms once there are enough days, ignoring positive ones", () => {
    const meals = [1, 2, 3, 4].map(d => meal(d, "oats"));
    const r = firstTriggerProgress({ ...base, meals, symptoms: [sym(1, "better_digestion"), sym(2)] });
    expect(r.stage).toBe("building");
    expect(r.steps[1].have).toBe(1);
    expect(r.cta).toMatchObject({ kind: "log_symptom" });
  });
  it("shows the most repeated food as a real count", () => {
    const meals = [1, 2, 3, 4].map(d => meal(d, "Oats", "banana"));
    const r = firstTriggerProgress({ ...base, meals, symptoms: [sym(1), sym(2), sym(3)] });
    expect(r.headline).toBe("Oats: 4 of 5 meals");
  });
  it("offers a 3-day test for a possible pattern and says it is not confirmed", () => {
    const r = firstTriggerProgress({ ...base, meals: [1, 2, 3, 4, 5].map(d => meal(d, "garlic bread")), symptoms: [sym(1), sym(2), sym(3)], triggers: [trig()] });
    expect(r.stage).toBe("pattern");
    expect(r.detail).toMatch(/not confirmed/);
    expect(r.cta).toMatchObject({ kind: "test", group: "fructans_garlic", href: "/reintro?group=fructans_garlic" });
  });
  it("has no test button when the pattern maps to no testable group", () => {
    const r = firstTriggerProgress({ ...base, meals: [meal(1, "x")], symptoms: [], triggers: [trig({ names: ["blueberries"] })] });
    expect(r.stage).toBe("pattern");
    expect(r.cta).toBeNull();
  });
  it("tracks a test in progress", () => {
    const r = firstTriggerProgress({ ...base, meals: [meal(1, "x")], symptoms: [], triggers: [trig()], challenges: [{ foodGroup: "fructans_garlic", testFood: "Garlic", status: "active", startedAt: NOW - 1 * D }] });
    expect(r.stage).toBe("testing");
    expect(r.headline).toBe("Test in progress: Garlic, day 2 of 3");
    expect(r.cta).toMatchObject({ kind: "check_in" });
  });
  it("only calls it confirmed after a clean test reacted", () => {
    const tolerated = trig({ confirmation: { state: "tolerated", group: "fructans_garlic", label: "Fructans — garlic" } });
    expect(firstTriggerProgress({ ...base, meals: [meal(1, "x")], symptoms: [], triggers: [tolerated] }).stage).not.toBe("confirmed");
    const retest = trig({ confirmation: { state: "retest", group: "fructans_garlic", label: "Fructans — garlic" } });
    expect(firstTriggerProgress({ ...base, meals: [meal(1, "x")], symptoms: [], triggers: [retest] }).stage).not.toBe("confirmed");
    const ok = trig({ confirmation: { state: "confirmed", group: "fructans_garlic", label: "Fructans — garlic" } });
    const r = firstTriggerProgress({ ...base, meals: [meal(1, "x")], symptoms: [], triggers: [ok] });
    expect(r.stage).toBe("confirmed");
    expect(r.steps.every(s => s.done)).toBe(true);
  });
  it("does not offer to retest a group that already finished", () => {
    const r = firstTriggerProgress({ ...base, meals: [meal(1, "x")], symptoms: [], triggers: [trig()], challenges: [{ foodGroup: "fructans_garlic", testFood: "Garlic", status: "completed", startedAt: NOW - 9 * D }] });
    expect(r.cta).toBeNull();
  });
});

describe("mostRepeatedFood", () => {
  it("counts a food once per meal and ignores case", () => {
    expect(mostRepeatedFood([{ loggedAt: 1, foods: [{ name: "Rice" }, { name: "rice" }] }, { loggedAt: 2, foods: [{ name: "RICE" }] }])).toEqual({ name: "Rice", meals: 2 });
    expect(mostRepeatedFood([])).toBeNull();
  });
});
