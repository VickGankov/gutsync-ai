// A believable fake person for tests and for eyeballing the PDF. Not real data.
import type { ReportInput } from "./model";
import { computeTriggers } from "../../shared/triggers";
import { confirmationFor, type FinishedChallenge } from "../../shared/triggerConfirm";

const H = 3_600_000, D = 24 * H;
export const NOW = Date.UTC(2026, 9, 28, 20, 0, 0);

export function fixtureInput(over: Partial<ReportInput> = {}): ReportInput {
  const food = (name: string, hidden: string[] = []) => ({ name, category: "other" as const, fodmap: "low" as const, hiddenIngredients: hidden });
  const meals: ReportInput["meals"] = [];
  const symptoms: ReportInput["symptoms"] = [];
  for (let d = 29; d >= 0; d--) {
    const day = NOW - d * D;
    meals.push({ mealType: "breakfast", foods: [food("Oats with blueberries")], loggedAt: day - 12 * H });
    meals.push({ mealType: "lunch", foods: [food("Chicken rice bowl")], loggedAt: day - 8 * H });
    if (d % 3 === 0) {
      meals.push({ mealType: "dinner", foods: [food("Garlic pasta", ["garlic", "onion"])], loggedAt: day - 3 * H });
      if (d % 6 !== 0 || d < 10) symptoms.push({ type: "bloating", severity: 3 + (d % 2), loggedAt: day - 1 * H });
    } else meals.push({ mealType: "dinner", foods: [food("Salmon with potatoes")], loggedAt: day - 3 * H });
  }
  symptoms.push({ type: "fatigue", severity: 2, loggedAt: NOW - 4 * D }, { type: "better_sleep", severity: 3, loggedAt: NOW - 2 * D });
  const weights = Array.from({ length: 22 }, (_, i) => ({ weightLb10: Math.round((194 - i * 0.28 + Math.sin(i) * 0.6) * 10), loggedAt: NOW - (29 - i) * D - 2 * H }));
  const triggers = computeTriggers(meals.map((m, id) => ({ id, loggedAt: m.loggedAt, foods: m.foods })), symptoms.map(s => ({ type: s.type, severity: s.severity, loggedAt: s.loggedAt })), NOW);
  const challenges = [{ foodGroup: "lactose", testFood: "Regular milk", status: "completed", outcome: "tolerated" as "tolerated" | null, lowConfidence: 0, startedAt: NOW - 20 * D, finishedAt: NOW - 17 * D }];
  return {
    generatedAt: NOW, from: NOW - 30 * D, to: NOW, tzOffsetMinutes: 420, name: "Sam Demo",
    includeLabs: true, includeProtocol: true,
    meals, symptoms, weights, waists: [{ waistIn10: 340, loggedAt: NOW - 28 * D }, { waistIn10: 331, loggedAt: NOW - 1 * D }],
    intake: Array.from({ length: 14 }, (_, i) => ({ kind: i % 2 ? "water" : "protein", amount: i % 2 ? 1800 : 140, loggedAt: NOW - i * D - 5 * H })),
    lifts: [
      { exercise: "Bench press", weightLb: 155, reps: 8, loggedAt: NOW - 27 * D }, { exercise: "Bench press", weightLb: 165, reps: 8, loggedAt: NOW - 2 * D },
      { exercise: "Squat", weightLb: 205, reps: 5, loggedAt: NOW - 26 * D }, { exercise: "Squat", weightLb: 205, reps: 6, loggedAt: NOW - 3 * D },
    ],
    doses: [{ compound: "Compound A", doseMcg: 2000, site: "abdomen_left", loggedAt: NOW - 9 * D }, { compound: "Compound A", doseMcg: 2000, site: "abdomen_right", loggedAt: NOW - 2 * D }, { compound: "Compound B", doseMcg: 250, site: null, loggedAt: NOW - 1 * D }],
    supplements: [{ id: 1, name: "Magnesium", dose: "400 mg" }, { id: 2, name: "Vitamin D", dose: "2000 IU" }],
    supplementLogs: [{ supplementId: 1, dateKey: "2026-10-27" }, { supplementId: 1, dateKey: "2026-10-26" }, { supplementId: 2, dateKey: "2026-10-27" }],
    labs: [
      { marker: "LDL cholesterol", value: 142, unit: "mg/dL", refLow: null, refHigh: 100, drawnOn: "2026-09-12" },
      { marker: "LDL cholesterol", value: 128, unit: "mg/dL", refLow: null, refHigh: 100, drawnOn: "2026-10-20" },
      { marker: "Vitamin D (25-OH)", value: 38, unit: "ng/mL", refLow: 30, refHigh: 100, drawnOn: "2026-10-20" },
    ],
    challenges,
    triggers: triggers.map(t => ({ ...t, confirmation: confirmationFor(t.names, challenges as FinishedChallenge[]) })),
    triggerLookbackDays: 90,
    ...over,
  };
}
