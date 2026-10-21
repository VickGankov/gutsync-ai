// A pattern in your logs is only "possible". It becomes "confirmed" when you test the food yourself with a
// completed reintroduction challenge. Foods are matched to challenge groups by plain keywords (a heuristic).

import { REINTRO_GROUP_INFO, type ReintroGroup, type ReintroOutcome } from "./reintro";

const KEYWORDS: Record<ReintroGroup, string[]> = {
  fructose: ["honey", "mango", "asparagus", "fructose", "agave"],
  lactose: ["milk", "yogurt", "yoghurt", "cheese", "cream", "lactose", "ice cream", "whey"],
  sorbitol: ["avocado", "blackberr", "sorbitol"],
  mannitol: ["mushroom", "cauliflower", "celery", "mannitol"],
  fructans_wheat: ["bread", "pasta", "cracker", "wheat", "toast", "bagel", "tortilla", "noodle", "bun", "flour"],
  fructans_garlic: ["garlic"],
  fructans_onion: ["onion", "shallot"],
  fructans_fruit: ["watermelon", "dried fruit", "persimmon"],
  gos: ["bean", "lentil", "chickpea", "hummus"],
};

export interface FinishedChallenge {
  foodGroup: string;
  status: string;
  outcome: ReintroOutcome | null;
  lowConfidence: number;
  finishedAt: number | null;
  startedAt: number;
}

export type Confirmation =
  | { state: "confirmed"; group: ReintroGroup; label: string }
  | { state: "retest"; group: ReintroGroup; label: string }
  | { state: "tolerated"; group: ReintroGroup; label: string };

/** Challenge groups a set of food names belongs to (usually none or one). */
export function groupsForNames(names: string[]): ReintroGroup[] {
  const lower = names.map(n => n.toLowerCase());
  return (Object.keys(KEYWORDS) as ReintroGroup[]).filter(g =>
    KEYWORDS[g].some(k => lower.some(n => new RegExp(`(^|[^a-z])${k}`).test(n))));
}

/**
 * What the user's own finished tests say about a pattern, or null when none apply.
 *  confirmed: a clean test caused a reaction (limit or avoid)
 *  retest:    a test reacted, but stress or poor sleep was logged, so it is not trusted yet
 *  tolerated: every matching group was tested and tolerated
 */
export function confirmationFor(names: string[], challenges: FinishedChallenge[]): Confirmation | null {
  const groups = groupsForNames(names);
  if (groups.length === 0) return null;

  const latest = new Map<ReintroGroup, FinishedChallenge>();
  for (const c of challenges) {
    if (c.status !== "completed" || !c.outcome) continue;
    const g = c.foodGroup as ReintroGroup;
    const prev = latest.get(g);
    if (!prev || (c.finishedAt ?? c.startedAt) > (prev.finishedAt ?? prev.startedAt)) latest.set(g, c);
  }

  const label = (g: ReintroGroup) => REINTRO_GROUP_INFO[g].label;
  for (const g of groups) {
    const c = latest.get(g);
    if (c && c.outcome !== "tolerated" && !c.lowConfidence) return { state: "confirmed", group: g, label: label(g) };
  }
  for (const g of groups) {
    const c = latest.get(g);
    if (c && c.outcome !== "tolerated" && c.lowConfidence) return { state: "retest", group: g, label: label(g) };
  }
  if (groups.every(g => latest.get(g)?.outcome === "tolerated")) {
    return { state: "tolerated", group: groups[0], label: label(groups[0]) };
  }
  return null;
}
