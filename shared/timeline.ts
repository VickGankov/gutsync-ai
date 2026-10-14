// Links each symptom to the meal it most plausibly followed.
// Rule: the latest meal at or before the symptom, if it was within the window (default 6 h).
// Cutting at "latest meal" also means a later meal takes over from an earlier one.
// This shows what came after a meal; it does not claim the meal caused it.

export const FOLLOW_UP_WINDOW_MS = 6 * 3_600_000;

export interface TimedRow { id: number; loggedAt: number }

export function attributeSymptoms<M extends TimedRow, S extends TimedRow>(
  meals: M[],
  symptoms: S[],
  windowMs: number = FOLLOW_UP_WINDOW_MS,
): {
  byMeal: Map<number, Array<{ symptom: S; afterMs: number }>>;
  bySymptom: Map<number, { meal: M; afterMs: number }>;
} {
  const byMeal = new Map<number, Array<{ symptom: S; afterMs: number }>>();
  const bySymptom = new Map<number, { meal: M; afterMs: number }>();
  const mealsNewestFirst = [...meals].sort((a, b) => b.loggedAt - a.loggedAt);

  for (const symptom of [...symptoms].sort((a, b) => a.loggedAt - b.loggedAt)) {
    const meal = mealsNewestFirst.find(m => m.loggedAt <= symptom.loggedAt);
    if (!meal) continue;
    const afterMs = symptom.loggedAt - meal.loggedAt;
    if (afterMs > windowMs) continue;
    bySymptom.set(symptom.id, { meal, afterMs });
    byMeal.set(meal.id, [...(byMeal.get(meal.id) ?? []), { symptom, afterMs }]);
  }
  return { byMeal, bySymptom };
}

/** "25 min later" / "2 h later" */
export function formatGap(ms: number, suffix: "later" | "earlier"): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min ${suffix}`;
  const h = Math.round((min / 60) * 2) / 2;
  return `${h} h ${suffix}`;
}
