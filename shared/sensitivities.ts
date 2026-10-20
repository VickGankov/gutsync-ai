// Foods the user says they suspect. This only flags and counts; it never decides what a trigger is.
// Matching is an approximate keyword check on food names, flagged hidden ingredients and ingredient lists.

import { FOLLOW_UP_WINDOW_MS } from "./timeline";
import { NEGATIVE_SYMPTOMS } from "./triggers";

export interface SensitivityInfo { key: string; label: string; /** Short form for tags on a food, e.g. "Gluten". */ short: string; hint: string; test: RegExp; ignore?: RegExp }

export const SENSITIVITIES: SensitivityInfo[] = [
  {
    key: "lactose", short: "Lactose", label: "Lactose / dairy", hint: "milk, cheese, yogurt, cream, whey",
    test: /\b(milk|cream|cheese|yogh?urt|kefir|whey|butter|ice cream|custard|ricotta|mascarpone|cottage|lactose|latte|cappuccino|pudding|paneer|queso|alfredo)\b/i,
    ignore: /\b(peanut|almond|cashew|nut|coconut|oat|soy|rice|cocoa|cacao|shea|hemp|pea)\s+(milk|butter|cream|yogh?urt)\b|\blactose[- ]free\b/gi,
  },
  {
    key: "gluten", short: "Gluten", label: "Gluten", hint: "wheat, rye, barley, bread, pasta",
    test: /\b(wheat|rye|barley|gluten|bread|toast|bagel|pasta|noodles?|spaghetti|macaroni|flour|couscous|seitan|crackers?|pizza|tortilla|pancakes?|waffles?|croissant|muffin|biscuits?|pita|buns?|cake|cookies?|beer|ramen|udon|dumplings?)\b/i,
    ignore: /\bgluten[- ]free\s+\w+|\b(rice|corn|almond|coconut|oat|buckwheat|chickpea|potato|tapioca)\s+(flour|noodles?|pasta)\b/gi,
  },
  { key: "garlic_onion", short: "Garlic & onion", label: "Garlic & onion", hint: "garlic, onion, shallot, leek", test: /\b(garlic|onions?|shallots?|leeks?|scallions?|spring onions?)\b/i },
  {
    key: "fructose", short: "Fructose", label: "Fructose", hint: "honey, apple, pear, mango, HFCS",
    test: /\b(honey|agave|fructose|hfcs|high[- ]fructose|corn syrup|apples?|pears?|mango(es)?|watermelon|cherry|cherries|fruit juice)\b/i,
  },
  {
    key: "polyols", short: "Polyols", label: "Sugar alcohols & polyols", hint: "sorbitol, mushrooms, avocado, stone fruit",
    test: /\b(sorbitol|mannitol|xylitol|maltitol|isomalt|erythritol|sugar alcohols?|polyols?|mushrooms?|cauliflower|avocados?|peach(es)?|plums?|apricots?|nectarines?|prunes?|blackberr(y|ies))\b/i,
  },
  {
    key: "legumes", short: "Beans & lentils", label: "Beans & lentils", hint: "beans, lentils, chickpeas, hummus",
    test: /\b(beans?|lentils?|chickpeas?|hummus|falafel|peas|soybeans?|edamame)\b/i,
    ignore: /\bgreen beans?\b/gi,
  },
];

export const SENSITIVITY_KEYS = SENSITIVITIES.map(s => s.key);
export const sensitivityShort = (key: string) => SENSITIVITIES.find(s => s.key === key)?.short ?? key;
export const sensitivityLabel = (key: string) => SENSITIVITIES.find(s => s.key === key)?.label ?? key;

/** Keep only known keys, no duplicates, in the standard order. */
export function cleanSensitivities(keys: unknown): string[] {
  const set = new Set(Array.isArray(keys) ? keys : []);
  return SENSITIVITY_KEYS.filter(k => set.has(k));
}

export interface FlaggableFood { name: string; hiddenIngredients?: string[]; ingredients?: string[] }

/** Which of the selected sensitivities a food seems to contain. */
export function sensitivitiesIn(food: FlaggableFood, selected: string[]): string[] {
  if (selected.length === 0) return [];
  const text = [food.name, ...(food.hiddenIngredients ?? []), ...(food.ingredients ?? [])].join(" ; ");
  return SENSITIVITIES.filter(s => {
    if (!selected.includes(s.key)) return false;
    const cleaned = s.ignore ? text.replace(s.ignore, " ") : text;
    return s.test.test(cleaned);
  }).map(s => s.key);
}

export interface FlagMeal { id: number; loggedAt: number; foods: FlaggableFood[] }
export interface FlagSymptom { type: string; loggedAt: number }

export interface DeclaredStat {
  key: string; label: string;
  exposures: number; hits: number; otherMeals: number; otherHits: number;
}

/**
 * For each selected sensitivity: of the meals containing it, how many were followed by any negative symptom
 * within the window, next to the same figure for the user's other meals. Meals too recent to know are left out.
 */
export function declaredStats(
  selected: string[], meals: FlagMeal[], symptoms: FlagSymptom[],
  now: number = Date.now(), windowMs: number = FOLLOW_UP_WINDOW_MS,
): DeclaredStat[] {
  const negative = symptoms.filter(s => (NEGATIVE_SYMPTOMS as readonly string[]).includes(s.type));
  const eligible = meals.filter(m => m.loggedAt <= now - windowMs);
  const followed = new Map(eligible.map(m => [m.id, negative.some(s => s.loggedAt >= m.loggedAt && s.loggedAt - m.loggedAt <= windowMs)]));
  return cleanSensitivities(selected).map(key => {
    let exposures = 0, hits = 0, otherMeals = 0, otherHits = 0;
    for (const m of eligible) {
      const has = m.foods.some(f => sensitivitiesIn(f, [key]).length > 0);
      const hit = followed.get(m.id) ? 1 : 0;
      if (has) { exposures++; hits += hit; } else { otherMeals++; otherHits += hit; }
    }
    return { key, label: sensitivityLabel(key), exposures, hits, otherMeals, otherHits };
  });
}
