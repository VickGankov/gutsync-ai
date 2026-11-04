// "Path to your first confirmed trigger": where the person is, and the one next step.
// Pure: built from counts the app already has. It never tells anyone a food is a trigger; the same
// rules as the Insights page apply (a pattern is only "possible" until a clean 3-day test reacts).

import { MIN_DAYS, MIN_EXPOSURES, MIN_HITS, NEGATIVE_SYMPTOMS, type TriggerStat } from "./triggers";
import { groupsForNames, type Confirmation } from "./triggerConfirm";
import { REINTRO_GROUP_INFO, CHALLENGE_DAYS, currentChallengeDay, type ReintroGroup } from "./reintro";

export interface ProgressMeal { loggedAt: number; foods: Array<{ name: string }> }
export interface ProgressSymptom { type: string; loggedAt: number }
export interface ProgressTrigger extends Pick<TriggerStat, "names" | "symptom" | "exposures" | "hits" | "otherRate" | "rate" | "status"> {
  confirmation: Confirmation | null;
}
export interface ProgressChallenge { foodGroup: string; testFood: string; status: string; startedAt: number }

export type StepKey = "meals" | "symptoms" | "repeats" | "pattern" | "test";
export interface Step { key: StepKey; label: string; done: boolean; have: number; need: number; hint: string }

export type Cta =
  | { kind: "log_meal"; label: string; href: string }
  | { kind: "log_symptom"; label: string; href: string }
  | { kind: "test"; label: string; href: string; group: ReintroGroup }
  | { kind: "check_in"; label: string; href: string }
  | null;

export interface FirstTriggerProgress {
  stage: "start" | "building" | "pattern" | "testing" | "confirmed";
  headline: string;
  detail: string;
  steps: Step[];
  cta: Cta;
}

const norm = (s: string) => s.trim().toLowerCase();

/** The food logged most often, so "3 of 5 meals" is a real number for the person. */
export function mostRepeatedFood(meals: ProgressMeal[]): { name: string; meals: number } | null {
  const counts = new Map<string, { name: string; meals: Set<number> }>();
  meals.forEach((m, i) => {
    for (const f of m.foods) {
      const k = norm(f.name);
      if (!k) continue;
      if (!counts.has(k)) counts.set(k, { name: f.name.trim(), meals: new Set() });
      counts.get(k)!.meals.add(i);
    }
  });
  let best: { name: string; meals: number } | null = null;
  counts.forEach(v => { if (!best || v.meals.size > best.meals) best = { name: v.name, meals: v.meals.size }; });
  return best;
}

export function firstTriggerProgress(p: {
  now: number;
  tzOffsetMinutes: number;
  meals: ProgressMeal[];
  symptoms: ProgressSymptom[];
  triggers: ProgressTrigger[];
  challenges: ProgressChallenge[];
}): FirstTriggerProgress {
  const dayKey = (ts: number) => Math.floor((ts - p.tzOffsetMinutes * 60_000) / 86_400_000);
  const mealDays = new Set(p.meals.map(m => dayKey(m.loggedAt))).size;
  const negatives = p.symptoms.filter(s => (NEGATIVE_SYMPTOMS as readonly string[]).includes(s.type)).length;
  const repeat = mostRepeatedFood(p.meals);
  const possible = p.triggers.filter(t => t.status === "trigger");
  const confirmed = p.triggers.find(t => t.confirmation?.state === "confirmed");
  const active = p.challenges.find(c => c.status === "active");

  // A detected pattern already needed 5 exposures, so that step can't be "not done" at the same time.
  const repeatsHave = possible.length > 0 ? MIN_EXPOSURES : Math.min(repeat?.meals ?? 0, MIN_EXPOSURES);
  const steps: Step[] = [
    { key: "meals", label: "Log meals on 4 different days", have: Math.min(mealDays, MIN_DAYS), need: MIN_DAYS, done: mealDays >= MIN_DAYS, hint: "Snap or type what you eat. It takes a few seconds." },
    { key: "symptoms", label: "Log how you feel", have: Math.min(negatives, MIN_HITS), need: MIN_HITS, done: negatives >= MIN_HITS, hint: "A symptom needs a meal before it to match. Log bloating, pain, gas and so on when they happen." },
    { key: "repeats", label: "Eat a food 5 times", have: repeatsHave, need: MIN_EXPOSURES, done: repeatsHave >= MIN_EXPOSURES, hint: "One meal says nothing. A pattern needs the same food several times." },
    { key: "pattern", label: "Find a possible pattern", have: possible.length > 0 ? 1 : 0, need: 1, done: possible.length > 0, hint: "Triggerplate counts how often symptoms follow each food." },
    { key: "test", label: "Confirm it with a 3-day test", have: confirmed ? 1 : 0, need: 1, done: !!confirmed, hint: "Test one food group alone for 3 days, in small and then larger amounts." },
  ];

  if (confirmed) {
    const c = confirmed.confirmation;
    const label = c && c.state === "confirmed" ? c.label : confirmed.names[0];
    return {
      stage: "confirmed", steps: steps.map(x => ({ ...x, done: true, have: x.need })), cta: null,
      headline: `Confirmed: ${label.toLowerCase()} reacted in a clean test`,
      detail: "That's your first result from your own data. You can test another group from Insights.",
    };
  }

  if (active) {
    const day = Math.min(CHALLENGE_DAYS, Math.max(1, currentChallengeDay(active.startedAt, p.now, p.tzOffsetMinutes)));
    return {
      stage: "testing", steps,
      headline: `Test in progress: ${active.testFood}, day ${day} of ${CHALLENGE_DAYS}`,
      detail: "Eat today's amount, then check in on how your gut felt.",
      cta: { kind: "check_in", label: "Check in", href: "/reintro" },
    };
  }

  if (possible.length > 0) {
    const top = possible[0];
    const group = groupsForNames(top.names).find(g => !p.challenges.some(c => c.foodGroup === g && c.status === "completed"));
    const what = `${top.names.join(" + ")} → ${top.symptom.replace(/_/g, " ")}`;
    return {
      stage: "pattern", steps,
      headline: `A possible pattern: ${what}`,
      detail: group
        ? `Possible, not confirmed. A 3-day test of ${REINTRO_GROUP_INFO[group].label.toLowerCase()} is how you find out.`
        : "Possible, not confirmed. Keep logging to see whether it holds up.",
      cta: group ? { kind: "test", label: `Test ${REINTRO_GROUP_INFO[group].label.toLowerCase()}`, href: `/reintro?group=${group}`, group } : null,
    };
  }

  // Not there yet: point at the earliest step that isn't done.
  const next = steps.find(s => !s.done)!;
  if (p.meals.length === 0) {
    return { stage: "start", steps, headline: "Find your first trigger", detail: "Log a meal to begin. It takes about 2 weeks of normal eating to see a pattern.", cta: { kind: "log_meal", label: "Log a meal", href: "/log?tab=food" } };
  }
  if (next.key === "symptoms") {
    return { stage: "building", steps, headline: `${next.have} of ${next.need} symptom entries so far`, detail: next.hint, cta: { kind: "log_symptom", label: "Log a symptom", href: "/log?tab=symptoms" } };
  }
  if (next.key === "repeats" && repeat) {
    return { stage: "building", steps, headline: `${repeat.name}: ${repeat.meals} of ${MIN_EXPOSURES} meals`, detail: "Your most repeated food so far. A pattern needs about 5 meals with the same food.", cta: { kind: "log_meal", label: "Log a meal", href: "/log?tab=food" } };
  }
  return {
    stage: "building", steps,
    headline: next.key === "meals" ? `${next.have} of ${next.need} days logged` : "Keep going: no clear pattern yet",
    detail: next.key === "meals" ? next.hint : "Nothing stands out yet, which is a fine result. Keep logging normally and Triggerplate keeps counting.",
    cta: { kind: "log_meal", label: "Log a meal", href: "/log?tab=food" },
  };
}
