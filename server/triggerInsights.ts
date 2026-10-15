// Trigger detection (counting) plus a cached, numbers-grounded AI explanation per trigger.

import { createHash } from "crypto";
import { invokeLLM } from "./_core/llm";
import { getMealsInRange, getSymptomsByUser, getDosesByUser, getDoseSchedules, getTriggerExplanation, saveTriggerExplanation } from "./db";
import { intervalsByCompound, isSpaced, compoundKey } from "../shared/dose";
import { computeTriggers, ofMeals, pct, type TriggerStat } from "../shared/triggers";
import type { MealFood, TriggerExplanation } from "../drizzle/schema";

const DAY_MS = 86_400_000;
const LOOKBACK_DAYS = 90;

export const triggerKey = (t: Pick<TriggerStat, "names" | "symptom">) => `${t.names.join("|")}:${t.symptom}`.slice(0, 255);

export const statsHash = (t: TriggerStat) =>
  createHash("sha1")
    .update(JSON.stringify([t.names, t.symptom, t.exposures, t.hits, t.otherMeals, t.otherHits, t.avgSeverity, t.hitsNearDose]))
    .digest("hex");

export async function loadTriggers(userId: number, now = Date.now()) {
  const [meals, symptoms, doses, schedules] = await Promise.all([
    getMealsInRange(userId, now - LOOKBACK_DAYS * DAY_MS, now),
    getSymptomsByUser(userId, 500),
    getDosesByUser(userId, 200),
    getDoseSchedules(userId),
  ]);
  // Daily compounds would put every symptom "near a dose", so only spaced ones count.
  const intervals = intervalsByCompound(
    doses.map(d => ({ id: d.id, compound: d.compound, doseMcg: d.doseMcg, site: d.site, loggedAt: d.loggedAt })),
    schedules.map(s => ({ compound: s.compoundKey, intervalDays: s.intervalDays })),
  );
  const spacedDoseTimes = doses.filter(d => isSpaced(intervals.get(compoundKey(d.compound)))).map(d => d.loggedAt);
  const recentSymptoms = symptoms.filter(s => s.loggedAt >= now - LOOKBACK_DAYS * DAY_MS);
  const triggers = computeTriggers(
    meals.map(m => ({ id: m.id, loggedAt: m.loggedAt, foods: m.foods as MealFood[] })),
    recentSymptoms.map(s => ({ type: s.type, severity: s.severity, loggedAt: s.loggedAt })),
    now,
    undefined,
    spacedDoseTimes,
  );
  return { triggers, mealCount: meals.length, symptomCount: recentSymptoms.length };
}

const SYSTEM_PROMPT = `You write short, honest explanations of food–symptom patterns for a gut-health tracking app.
You are given COUNTS computed from the user's own logs. Use only those numbers; never invent counts, dates or foods.

Rules:
- Quote the supplied numbers exactly ("3 of 4 meals", "75%", "17%").
- Be plain and calm. No diagnosis, no medical claims, no "you are intolerant". Say "may" and "suggests".
- Small samples are weak evidence. Say so when exposures are under 5.
- If several foods are listed together, say the data cannot tell them apart.
- Mention a FODMAP group (fructans, lactose, polyols, GOS, fructose) only if you are confident it applies, otherwise leave it out.
- The next step must be one concrete, safe action, such as testing the food alone in the app's Reintroduction challenge, a portion change, or logging a few more meals.
- Only fill seeProfessional if the symptom is vomiting, or the average severity is 4 or higher, or it keeps recurring; otherwise return an empty string.
- Each field is at most two short sentences.`;

export async function explainTrigger(
  stat: TriggerStat,
  invoke: typeof invokeLLM = invokeLLM,
): Promise<TriggerExplanation> {
  const result = await invoke({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          foods: stat.names,
          symptom: stat.symptom.replace(/_/g, " "),
          windowHours: 6,
          mealsWithFood: stat.exposures,
          followedBySymptom: stat.hits,
          rateWithFood: pct(stat.rate),
          mealsWithoutFood: stat.otherMeals,
          followedBySymptomWithoutFood: stat.otherHits,
          rateWithoutFood: pct(stat.otherRate),
          averageSeverityOutOf5: stat.avgSeverity,
          summary: `${ofMeals(stat.hits, stat.exposures)} with ${stat.names.join(" + ")} were followed by ${stat.symptom.replace(/_/g, " ")}`,
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "trigger_explanation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            shows: { type: "string", description: "What the data shows, with the numbers" },
            why: { type: "string", description: "Why it might be happening, hedged" },
            confidence: { type: "string", description: "How sure we can be, and what the data cannot tell" },
            nextStep: { type: "string", description: "One concrete next step" },
            seeProfessional: { type: "string", description: "Empty unless a professional is warranted" },
          },
          required: ["shows", "why", "confidence", "nextStep", "seeProfessional"],
          additionalProperties: false,
        },
      },
    },
  });
  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("Empty explanation response");
  const parsed = JSON.parse(content) as TriggerExplanation;
  for (const k of ["shows", "why", "confidence", "nextStep", "seeProfessional"] as const) {
    if (typeof parsed[k] !== "string") throw new Error(`Explanation missing ${k}`);
  }
  return parsed;
}

/** Cached when the counts have not changed since the text was written. */
export async function getOrCreateExplanation(userId: number, stat: TriggerStat): Promise<TriggerExplanation> {
  const key = triggerKey(stat);
  const hash = statsHash(stat);
  const cached = await getTriggerExplanation(userId, key);
  if (cached && cached.statsHash === hash) return cached.explanation as TriggerExplanation;
  const explanation = await explainTrigger(stat);
  await saveTriggerExplanation(userId, key, hash, explanation);
  return explanation;
}
