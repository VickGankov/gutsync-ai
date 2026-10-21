// Trigger detection by counting, no AI involved.
// For each food / hidden ingredient and each symptom type: how often a meal containing it was
// followed by that symptom within the window, compared with meals without it.
// Meals logged less than a window ago are skipped, because their outcome is not known yet.

import { FOLLOW_UP_WINDOW_MS } from "./timeline";

// A pattern needs enough repeats to be more than coincidence. Even then it is only "possible":
// see shared/triggerConfirm.ts for how a food becomes confirmed.
export const MIN_EXPOSURES = 5;
export const MIN_HITS = 3;
/** The symptom must follow this much more often after the food than after other meals. */
export const MIN_LIFT = 0.25;

export const NEGATIVE_SYMPTOMS = [
  "bloating", "abdominal_pain", "gas", "nausea", "fatigue", "headache",
  "diarrhea", "constipation", "acid_reflux", "vomiting", "low_appetite",
] as const;

export interface TriggerMeal {
  id: number;
  loggedAt: number;
  foods: Array<{ name: string; hiddenIngredients?: string[] }>;
}
export interface TriggerSymptom { type: string; severity: number; loggedAt: number }

export interface TriggerStat {
  /** Display names, leader first. More than one when foods always appear together. */
  names: string[];
  symptom: string;
  exposures: number;
  hits: number;
  otherMeals: number;
  otherHits: number;
  rate: number;
  otherRate: number;
  avgSeverity: number;
  lastHitAt: number;
  /** Hits whose symptom came within 3 days after a logged dose, so the dose may be the cause. */
  hitsNearDose: number;
  status: "trigger" | "watching";
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

interface Candidate extends TriggerStat { mealIds: Set<number>; lift: number; fromHidden: boolean }

export const DOSE_NEAR_MS = 3 * 86_400_000;

function jaccard(a: Set<number>, b: Set<number>): number {
  let inter = 0;
  a.forEach(x => { if (b.has(x)) inter++; });
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function computeTriggers(
  meals: TriggerMeal[],
  symptoms: TriggerSymptom[],
  now: number = Date.now(),
  windowMs: number = FOLLOW_UP_WINDOW_MS,
  doseTimes: number[] = [],
): TriggerStat[] {
  const eligible = meals.filter(m => m.loggedAt <= now - windowMs);
  if (eligible.length === 0) return [];

  // key -> meal ids, and whether the key came from a flagged hidden ingredient
  const keyMeals = new Map<string, Set<number>>();
  const hiddenKeys = new Set<string>();
  for (const meal of eligible) {
    const keys = new Set<string>();
    for (const f of meal.foods) {
      const n = norm(f.name);
      if (n) keys.add(n);
      for (const h of f.hiddenIngredients ?? []) {
        const hk = norm(h);
        if (hk) { keys.add(hk); hiddenKeys.add(hk); }
      }
    }
    keys.forEach(k => {
      if (!keyMeals.has(k)) keyMeals.set(k, new Set());
      keyMeals.get(k)!.add(meal.id);
    });
  }

  const symptomTypes = Array.from(new Set(symptoms.map(s => s.type)))
    .filter(t => (NEGATIVE_SYMPTOMS as readonly string[]).includes(t));

  const kept: Candidate[] = [];

  for (const symptom of symptomTypes) {
    const ofType = symptoms.filter(s => s.type === symptom);
    // meal id -> strongest matching symptom inside the window
    const hitMeals = new Map<number, { severity: number; at: number }>();
    for (const meal of eligible) {
      const inWindow = ofType.filter(s => s.loggedAt >= meal.loggedAt && s.loggedAt - meal.loggedAt <= windowMs);
      if (inWindow.length > 0) {
        const worst = inWindow.reduce((a, b) => (b.severity > a.severity ? b : a));
        hitMeals.set(meal.id, { severity: worst.severity, at: worst.loggedAt });
      }
    }
    if (hitMeals.size === 0) continue;

    const candidates: Candidate[] = [];
    keyMeals.forEach((mealIds, key) => {
      const exposures = mealIds.size;
      let hits = 0, sevSum = 0, lastHitAt = 0, hitsNearDose = 0;
      mealIds.forEach(id => {
        const h = hitMeals.get(id);
        if (h) {
          hits++; sevSum += h.severity; lastHitAt = Math.max(lastHitAt, h.at);
          if (doseTimes.some(d => h.at >= d && h.at - d <= DOSE_NEAR_MS)) hitsNearDose++;
        }
      });
      if (hits === 0) return;
      const otherMeals = eligible.length - exposures;
      const otherHits = hitMeals.size - hits;
      const rate = hits / exposures;
      const otherRate = otherMeals > 0 ? otherHits / otherMeals : 0;
      const lift = rate - otherRate;
      const fromHidden = hiddenKeys.has(key);

      let status: "trigger" | "watching" | null = null;
      if (exposures >= MIN_EXPOSURES) {
        if (hits >= MIN_HITS && lift >= MIN_LIFT) status = "trigger";
      } else if (fromHidden || exposures >= 2) {
        status = "watching";
      }
      if (!status) return;

      candidates.push({
        names: [key], symptom, exposures, hits, otherMeals, otherHits, rate, otherRate,
        avgSeverity: Math.round((sevSum / hits) * 10) / 10, lastHitAt, hitsNearDose, status,
        mealIds, lift, fromHidden,
      });
    });

    candidates.sort((a, b) =>
      (a.status === b.status ? 0 : a.status === "trigger" ? -1 : 1) ||
      b.lift - a.lift || b.exposures - a.exposures || a.names[0].localeCompare(b.names[0]));

    // Foods that always appear together can't be told apart: show them as one linked entry.
    for (const c of candidates) {
      const twin = kept.find(k => k.symptom === symptom && jaccard(k.mealIds, c.mealIds) >= 0.8);
      if (twin) {
        if (!twin.names.includes(c.names[0])) twin.names.push(c.names[0]);
      } else {
        kept.push(c);
      }
    }
  }

  return kept
    .sort((a, b) =>
      (a.status === b.status ? 0 : a.status === "trigger" ? -1 : 1) ||
      b.lift - a.lift || b.exposures - a.exposures)
    .map(({ mealIds: _m, lift: _l, fromHidden: _f, ...stat }) => stat)
    .slice(0, 12);
}

/** "3 of 4 meals" */
export const ofMeals = (hits: number, exposures: number) =>
  `${hits} of ${exposures} meal${exposures === 1 ? "" : "s"}`;

export const pct = (rate: number) => `${Math.round(rate * 100)}%`;
