// Pure helpers for fitness tracking (protein, water, weight, lifts).
// Kept free of DB access so they can be unit tested directly.

import type { MealFood } from "../drizzle/schema";

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Local calendar date (YYYY-MM-DD) for a timestamp, given the client's getTimezoneOffset(). */
export function localDateKey(ts: number, tzOffsetMinutes: number): string {
  return new Date(ts - tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** Sum of AI/user protein estimates across a meal's food items. */
export function mealProteinGrams(foods: MealFood[] | null | undefined): number {
  if (!Array.isArray(foods)) return 0;
  return foods.reduce((sum, f) => {
    const g = typeof f.proteinGrams === "number" && Number.isFinite(f.proteinGrams) ? f.proteinGrams : 0;
    return sum + Math.max(0, g);
  }, 0);
}

/** Epley estimated one-rep max. Returns the weight itself for single reps. */
export function estimatedOneRepMax(weightLb: number, reps: number): number {
  if (reps <= 1) return weightLb;
  return Math.round(weightLb * (1 + reps / 30));
}

export interface DaySummary {
  date: string;
  proteinG: number;
  waterMl: number;
  /** Latest weigh-in that day, in lb, or null. */
  weightLb: number | null;
}

export interface LiftPoint {
  date: string;
  weightLb: number;
  reps: number;
  sets: number;
  e1rm: number;
}

export function buildFitnessSummary(params: {
  now: number;
  days: number;
  tzOffsetMinutes: number;
  meals: Array<{ foods: MealFood[]; loggedAt: number }>;
  intake: Array<{ kind: "protein" | "water"; amount: number; loggedAt: number }>;
  weights: Array<{ weightLb10: number; loggedAt: number }>;
  lifts: Array<{ exercise: string; weightLb: number; reps: number; sets: number; loggedAt: number }>;
}) {
  const { now, days, tzOffsetMinutes } = params;
  const key = (ts: number) => localDateKey(ts, tzOffsetMinutes);

  const byDate = new Map<string, DaySummary & { weightTs: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const date = key(now - i * DAY_MS);
    if (!byDate.has(date)) byDate.set(date, { date, proteinG: 0, waterMl: 0, weightLb: null, weightTs: -1 });
  }

  for (const m of params.meals) {
    const d = byDate.get(key(m.loggedAt));
    if (d) d.proteinG += mealProteinGrams(m.foods);
  }
  for (const e of params.intake) {
    const d = byDate.get(key(e.loggedAt));
    if (!d) continue;
    if (e.kind === "protein") d.proteinG += e.amount;
    else d.waterMl += e.amount;
  }
  for (const w of params.weights) {
    const d = byDate.get(key(w.loggedAt));
    if (d && w.loggedAt > d.weightTs) {
      d.weightTs = w.loggedAt;
      d.weightLb = w.weightLb10 / 10;
    }
  }

  const daysOut: DaySummary[] = Array.from(byDate.values()).map(({ weightTs: _ignored, ...rest }) => ({
    ...rest,
    proteinG: Math.round(rest.proteinG),
  }));

  // Lifts grouped by exercise (case-insensitive), oldest first, best set per day.
  const liftMap = new Map<string, { name: string; points: Map<string, LiftPoint> }>();
  for (const l of [...params.lifts].sort((a, b) => a.loggedAt - b.loggedAt)) {
    const id = l.exercise.trim().toLowerCase();
    if (!id) continue;
    if (!liftMap.has(id)) liftMap.set(id, { name: l.exercise.trim(), points: new Map() });
    const entry = liftMap.get(id)!;
    const date = key(l.loggedAt);
    const point: LiftPoint = { date, weightLb: l.weightLb, reps: l.reps, sets: l.sets, e1rm: estimatedOneRepMax(l.weightLb, l.reps) };
    const prev = entry.points.get(date);
    if (!prev || point.e1rm >= prev.e1rm) entry.points.set(date, point);
  }
  const lifts = Array.from(liftMap.values()).map(({ name, points }) => {
    const series = Array.from(points.values());
    const first = series[0];
    const last = series[series.length - 1];
    const changePct = first && last && first.e1rm > 0 ? Math.round(((last.e1rm - first.e1rm) / first.e1rm) * 1000) / 10 : 0;
    return { exercise: name, series, changePct };
  });

  // Weekly weight change rate from first and last weigh-in in the window.
  const weighed = daysOut.filter(d => d.weightLb !== null);
  let weeklyChangePct: number | null = null;
  if (weighed.length >= 2) {
    const first = weighed[0];
    const last = weighed[weighed.length - 1];
    const spanDays = (Date.parse(last.date) - Date.parse(first.date)) / DAY_MS;
    if (spanDays >= 3 && first.weightLb) {
      weeklyChangePct = Math.round((((last.weightLb! - first.weightLb) / first.weightLb) * 100 * (7 / spanDays)) * 100) / 100;
    }
  }

  return {
    days: daysOut,
    today: daysOut[daysOut.length - 1],
    lifts,
    weeklyChangePct,
  };
}
