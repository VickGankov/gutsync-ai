// Helpers for the shared food-facts cache. Pure, so they are unit tested directly.

export type FoodCategory = "protein" | "carb" | "fat" | "vegetable" | "fruit" | "dairy" | "grain" | "other";
export type FodmapLevel = "low" | "moderate" | "high";

export interface FoodFact {
  foodKey: string;
  name: string;
  category: FoodCategory;
  fodmap: FodmapLevel;
  hiddenIngredients: string[];
  /** Protein grams per 100 g, in tenths. */
  proteinPer100gTenths: number;
  /** Fiber grams per 100 g, in tenths. null = not looked up yet (older cache rows). */
  fiberPer100gTenths?: number | null;
  source: "seed" | "ai";
}

function singular(word: string): string {
  if (word.length <= 3) return word;
  if (/(ss|us|is)$/.test(word)) return word;
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (/(oes|ches|shes|xes|sses)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

/** Lowercase, strip accents/punctuation, singularize each word. "Grilled Chicken Breasts" -> "grilled chicken breast". */
export function normalizeFoodKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map(singular)
    .join(" ")
    .slice(0, 120);
}

export function proteinForPortion(proteinPer100gTenths: number, grams: number): number {
  const g = Number.isFinite(grams) ? Math.min(2000, Math.max(0, grams)) : 100;
  return Math.round(((proteinPer100gTenths / 10) * g) / 100);
}

/** Estimated fiber grams in a portion, rounded to 0.5 g. */
export function fiberForPortion(fiberPer100gTenths: number, grams: number): number {
  const g = Number.isFinite(grams) ? Math.min(2000, Math.max(0, grams)) : 100;
  return Math.round(((fiberPer100gTenths / 10) * g) / 100 * 2) / 2;
}

export function displayName(name: string): string {
  const t = name.trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
}
