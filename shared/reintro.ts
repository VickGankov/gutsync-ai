// FODMAP reintroduction ("challenge") protocol — shared by client and server.
//
// Structure follows the commonly used low-FODMAP reintroduction approach:
// test one FODMAP group at a time over 3 days with increasing amounts, then a
// washout of a few low-FODMAP days before the next group. Test foods and
// amounts below are starting suggestions only — the user can change them, and
// the UI tells them to confirm with their dietitian.

export const REINTRO_GROUPS = [
  "fructose",
  "lactose",
  "sorbitol",
  "mannitol",
  "fructans_wheat",
  "fructans_garlic",
  "fructans_onion",
  "fructans_fruit",
  "gos",
] as const;

export type ReintroGroup = (typeof REINTRO_GROUPS)[number];

export interface ReintroGroupInfo {
  id: ReintroGroup;
  label: string;
  emoji: string;
  testFood: string;
  /** Suggested amounts for day 1, 2, 3. */
  doses: [string, string, string];
  examples: string;
}

export const REINTRO_GROUP_INFO: Record<ReintroGroup, ReintroGroupInfo> = {
  fructose: { id: "fructose", label: "Fructose", emoji: "🍯", testFood: "Honey", doses: ["1 tsp", "2 tsp", "1 tbsp"], examples: "Honey, mango, asparagus" },
  lactose: { id: "lactose", label: "Lactose", emoji: "🥛", testFood: "Regular milk", doses: ["½ cup", "¾ cup", "1 cup"], examples: "Milk, yogurt, soft cheese" },
  sorbitol: { id: "sorbitol", label: "Sorbitol", emoji: "🍑", testFood: "Avocado", doses: ["¼ avocado", "⅓ avocado", "½ avocado"], examples: "Avocado, blackberries, sugar-free gum" },
  mannitol: { id: "mannitol", label: "Mannitol", emoji: "🍄", testFood: "Button mushrooms", doses: ["¼ cup", "½ cup", "1 cup"], examples: "Mushrooms, cauliflower, celery" },
  fructans_wheat: { id: "fructans_wheat", label: "Fructans — wheat", emoji: "🍞", testFood: "Wheat bread", doses: ["1 slice", "2 slices", "3 slices"], examples: "Bread, pasta, crackers" },
  fructans_garlic: { id: "fructans_garlic", label: "Fructans — garlic", emoji: "🧄", testFood: "Garlic", doses: ["¼ clove", "½ clove", "1 clove"], examples: "Garlic, garlic powder" },
  fructans_onion: { id: "fructans_onion", label: "Fructans — onion", emoji: "🧅", testFood: "Onion", doses: ["1 tbsp", "¼ onion", "½ onion"], examples: "Onion, shallots, onion powder" },
  fructans_fruit: { id: "fructans_fruit", label: "Fructans — fruit", emoji: "🍉", testFood: "Watermelon", doses: ["¼ cup", "½ cup", "1 cup"], examples: "Watermelon, dried fruit, persimmon" },
  gos: { id: "gos", label: "GOS", emoji: "🫘", testFood: "Canned chickpeas", doses: ["¼ cup", "½ cup", "1 cup"], examples: "Beans, lentils, chickpeas" },
};

export const CHALLENGE_DAYS = 3;
export const WASHOUT_DAYS = 3;
/** Severity (0–5) at or above which a day counts as a reaction. */
export const REACTION_THRESHOLD = 3;

export interface ReintroCheckIn {
  day: 1 | 2 | 3;
  /** Overall gut symptom severity, 0 (none) – 5 (severe). */
  severity: number;
  /** Confounders that make the day's result less reliable. */
  stressed: boolean;
  poorSleep: boolean;
  /** Whether the user actually ate the dose that day. */
  ateDose: boolean;
  note?: string;
  loggedAt: number;
}

export type ReintroOutcome = "tolerated" | "limit" | "avoid";

export interface ReintroAssessment {
  outcome: ReintroOutcome;
  /** Highest day whose dose was tolerated (0 = none). */
  toleratedDay: 0 | 1 | 2 | 3;
  /** True when a confounder was logged on or before the reaction day. */
  lowConfidence: boolean;
  reason: string;
}

/**
 * Turn daily check-ins into a result. A day counts as a reaction when
 * severity >= REACTION_THRESHOLD and the dose was eaten. The first reacting day
 * decides the outcome (the challenge stops there — the dose isn't increased):
 *   no reaction  -> tolerated (all three amounts)
 *   day 2 or 3   -> limit to the previous day's amount
 *   day 1        -> avoid for now (retest later)
 * Returns null while the challenge is still in progress.
 */
export function assessChallenge(checkIns: ReintroCheckIn[]): ReintroAssessment | null {
  const days = [...checkIns].sort((a, b) => a.day - b.day);
  const firstReaction = days.find(c => c.ateDose && c.severity >= REACTION_THRESHOLD);
  if (!firstReaction) {
    const complete = [1, 2, 3].every(d => days.some(c => c.day === d));
    if (!complete) return null;
  }
  const upTo = firstReaction ? days.filter(c => c.day <= firstReaction.day) : days;
  const lowConfidence = upTo.some(c => c.stressed || c.poorSleep || !c.ateDose);

  if (!firstReaction) {
    return {
      outcome: "tolerated",
      toleratedDay: 3,
      lowConfidence,
      reason: "No significant symptoms at any of the three amounts.",
    };
  }
  if (firstReaction.day === 1) {
    return {
      outcome: "avoid",
      toleratedDay: 0,
      lowConfidence,
      reason: "Symptoms at the smallest amount. Avoid for now and consider retesting later.",
    };
  }
  return {
    outcome: "limit",
    toleratedDay: (firstReaction.day - 1) as 1 | 2,
    lowConfidence,
    reason: `Symptoms appeared on day ${firstReaction.day}. The day ${firstReaction.day - 1} amount seems tolerated.`,
  };
}

/** Which challenge day (1–3) is due now, or null if the 3 days are done. */
export function currentChallengeDay(startedAt: number, now: number, tzOffsetMinutes: number): number {
  const dayKey = (ts: number) => Math.floor((ts - tzOffsetMinutes * 60_000) / 86_400_000);
  return dayKey(now) - dayKey(startedAt) + 1;
}
