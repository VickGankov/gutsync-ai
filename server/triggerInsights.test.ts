import { describe, it, expect, vi, beforeEach } from "vitest";

const store = new Map<string, { statsHash: string; explanation: unknown }>();
const invoke = vi.fn();

vi.mock("./db", () => ({
  getMealsInRange: vi.fn(),
  getSymptomsByUser: vi.fn(),
  getDosesByUser: vi.fn(),
  getTriggerExplanation: vi.fn(async (_u: number, key: string) => store.get(key) ?? null),
  saveTriggerExplanation: vi.fn(async (_u: number, key: string, statsHash: string, explanation: unknown) => {
    store.set(key, { statsHash, explanation });
  }),
}));
vi.mock("./_core/llm", () => ({ invokeLLM: (...a: unknown[]) => invoke(...a) }));

import { explainTrigger, getOrCreateExplanation } from "./triggerInsights";
import type { TriggerStat } from "../shared/triggers";

const stat: TriggerStat = {
  names: ["garlic", "onion"], symptom: "bloating", exposures: 4, hits: 3, otherMeals: 12, otherHits: 2,
  rate: 0.75, otherRate: 2 / 12, avgSeverity: 3.7, lastHitAt: 1, hitsNearDose: 0, status: "trigger",
};
const good = { shows: "a", why: "b", confidence: "c", nextStep: "d", seeProfessional: "" };
const reply = (obj: unknown) => ({ choices: [{ message: { content: JSON.stringify(obj) } }] });

beforeEach(() => { store.clear(); invoke.mockReset(); });

describe("explainTrigger", () => {
  it("sends the computed counts, not raw logs, and returns the parsed fields", async () => {
    invoke.mockResolvedValue(reply(good));
    const out = await explainTrigger(stat);
    expect(out).toEqual(good);
    const sent = JSON.parse(invoke.mock.calls[0][0].messages[1].content);
    expect(sent).toMatchObject({ mealsWithFood: 4, followedBySymptom: 3, rateWithFood: "75%", rateWithoutFood: "17%" });
  });

  it("rejects a response with a missing field", async () => {
    invoke.mockResolvedValue(reply({ shows: "a" }));
    await expect(explainTrigger(stat)).rejects.toThrow();
  });
});

describe("getOrCreateExplanation", () => {
  it("reuses the cached text while the counts are unchanged and rewrites when they change", async () => {
    invoke.mockResolvedValue(reply(good));
    await getOrCreateExplanation(1, stat);
    await getOrCreateExplanation(1, stat);
    expect(invoke).toHaveBeenCalledTimes(1);
    await getOrCreateExplanation(1, { ...stat, exposures: 5, hits: 4 });
    expect(invoke).toHaveBeenCalledTimes(2);
  });
});
