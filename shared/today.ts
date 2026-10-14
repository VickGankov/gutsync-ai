// Pure logic for the Home "Today" card, kept free of React so it can be unit tested.

export const POSITIVE_SYMPTOM_TYPES = new Set([
  "energy_boost",
  "better_digestion",
  "improved_mood",
  "better_sleep",
  "clearer_skin",
  "reduced_brain_fog",
]);

export type TodayNudge =
  | { kind: "reintro"; href: "/reintro" }
  | { kind: "meal"; href: "/log" }
  | { kind: "feeling"; href: "/log" }
  | { kind: "protein"; href: "/progress"; remainingG: number }
  | { kind: "done"; href: null };

export interface TodaySummary {
  mealsToday: number;
  symptomsToday: number;
  /** Worst symptom logged today (negative symptoms only). */
  worst: { type: string; severity: number } | null;
  lastMealAt: number | null;
  lastSymptom: { type: string; loggedAt: number } | null;
  nudge: TodayNudge;
}

export function summarizeToday(p: {
  now: number;
  /** Local midnight today, in ms. */
  startOfDay: number;
  hour: number;
  meals: Array<{ loggedAt: number }>;
  symptoms: Array<{ type: string; severity: number; loggedAt: number }>;
  proteinG: number | null;
  proteinTargetG: number | null;
  reintroCheckInPending: boolean;
}): TodaySummary {
  const mealsToday = p.meals.filter(m => m.loggedAt >= p.startOfDay);
  const symptomsToday = p.symptoms.filter(s => s.loggedAt >= p.startOfDay);
  const negativeToday = symptomsToday.filter(s => !POSITIVE_SYMPTOM_TYPES.has(s.type));
  const worst = negativeToday.reduce<TodaySummary["worst"]>(
    (w, s) => (!w || s.severity > w.severity ? { type: s.type, severity: s.severity } : w),
    null,
  );
  const lastMealAt = p.meals.reduce<number | null>((t, m) => (t === null || m.loggedAt > t ? m.loggedAt : t), null);
  const lastSym = p.symptoms
    .filter(s => !POSITIVE_SYMPTOM_TYPES.has(s.type))
    .reduce<{ type: string; loggedAt: number } | null>(
      (t, s) => (!t || s.loggedAt > t.loggedAt ? { type: s.type, loggedAt: s.loggedAt } : t),
      null,
    );

  const HOUR = 3_600_000;
  let nudge: TodayNudge;
  if (p.reintroCheckInPending) {
    nudge = { kind: "reintro", href: "/reintro" };
  } else if (mealsToday.length === 0 && p.hour >= 11) {
    nudge = { kind: "meal", href: "/log" };
  } else if (negativeToday.length === 0 && lastMealAt !== null && lastMealAt >= p.startOfDay && p.now - lastMealAt >= 2 * HOUR) {
    nudge = { kind: "feeling", href: "/log" };
  } else if (p.proteinG !== null && p.proteinTargetG && p.hour >= 17 && p.proteinG < p.proteinTargetG * 0.8) {
    nudge = { kind: "protein", href: "/progress", remainingG: Math.round(p.proteinTargetG - p.proteinG) };
  } else {
    nudge = { kind: "done", href: null };
  }

  return {
    mealsToday: mealsToday.length,
    symptomsToday: negativeToday.length,
    worst,
    lastMealAt,
    lastSymptom: lastSym,
    nudge,
  };
}
