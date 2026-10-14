// Two-stage meal analysis: the vision model only identifies foods (fast), facts come from our
// food cache, and the AI is asked about foods we haven't seen before (then cached for everyone).

import { invokeLLM } from "./_core/llm";
import { FOOD_SEED } from "./foodSeed";
import {
  displayName, normalizeFoodKey, proteinForPortion,
  type FoodFact, type FoodCategory, type FodmapLevel,
} from "../shared/foodCache";
import type { MealFood } from "../drizzle/schema";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export interface Analysis { foods: MealFood[]; mealType: MealType; summary: string }
export interface Identified { foods: Array<{ name: string; grams: number }>; mealType: MealType; summary: string }

export interface Deps {
  identify(imageUrl: string): Promise<Identified>;
  lookup(items: Array<{ key: string; name: string }>): Promise<FoodFact[]>;
  getFacts(keys: string[]): Promise<FoodFact[]>;
  saveFacts(facts: FoodFact[]): Promise<void>;
  /** Original single-call analysis, used if anything in the fast path fails. */
  legacy(imageUrl: string): Promise<Analysis>;
}

const CATEGORIES: FoodCategory[] = ["protein", "carb", "fat", "vegetable", "fruit", "dairy", "grain", "other"];
const FODMAPS: FodmapLevel[] = ["low", "moderate", "high"];
const MEAL_TYPES: MealType[] = ["breakfast", "lunch", "dinner", "snack"];

export async function analyzeWithCache(imageUrl: string, deps: Deps, log: (msg: string) => void = console.log): Promise<Analysis> {
  const t0 = Date.now();
  try {
    const ident = await deps.identify(imageUrl);
    const t1 = Date.now();
    if (!ident.foods.length) return { foods: [], mealType: ident.mealType, summary: ident.summary };

    const items = ident.foods.map(f => ({ ...f, key: normalizeFoodKey(f.name) })).filter(f => f.key);
    const keys = Array.from(new Set(items.map(i => i.key)));

    let known: FoodFact[] = [];
    try { known = await deps.getFacts(keys); } catch { /* cache unavailable: treat everything as unknown */ }
    const byKey = new Map(known.map(f => [f.foodKey, f]));

    const missing = keys.filter(k => !byKey.has(k));
    if (missing.length) {
      const names = missing.map(k => ({ key: k, name: items.find(i => i.key === k)!.name }));
      const fresh = await deps.lookup(names);
      const freshByKey = new Map(fresh.map(f => [f.foodKey, f]));
      if (missing.some(k => !freshByKey.has(k))) throw new Error("lookup missing foods");
      fresh.forEach(f => byKey.set(f.foodKey, f));
      deps.saveFacts(fresh).catch(() => { /* caching is best-effort */ });
    }

    const foods: MealFood[] = items.map(i => {
      const f = byKey.get(i.key)!;
      return {
        name: displayName(i.name),
        category: f.category,
        fodmap: f.fodmap,
        hiddenIngredients: f.hiddenIngredients,
        proteinGrams: proteinForPortion(f.proteinPer100gTenths, i.grams),
      };
    });
    log(`[analyze] identify=${t1 - t0}ms total=${Date.now() - t0}ms foods=${keys.length} cacheHits=${keys.length - missing.length}`);
    return { foods, mealType: ident.mealType, summary: ident.summary };
  } catch (err) {
    console.warn("[analyze] fast path failed, using single-call analysis:", err instanceof Error ? err.message : err);
    return deps.legacy(imageUrl);
  }
}

// ─── Real implementations ───

export async function identifyFoods(imageUrl: string): Promise<Identified> {
  const result = await invokeLLM({
    maxTokens: 4096,
    messages: [
      {
        role: "system",
        content: `You identify foods in meal photos for a gut-health tracker. Return JSON only.
- foods: every distinct food item visible, including visible sauces and dressings. For each: name and estimatedGrams (grams of that item in the visible portion).
- Use plain, generic, singular, lowercase names without cooking adjectives or brands: "chicken breast", "white rice", "broccoli", "tomato sauce", "egg".
- mealType: breakfast, lunch, dinner or snack, inferred from the foods.
- summary: one short sentence describing the meal.
If there is no food in the photo, return an empty foods array.`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Identify the foods in this meal photo." },
          { type: "image_url", image_url: { url: imageUrl, detail: "auto" } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "food_identification",
        strict: true,
        schema: {
          type: "object",
          properties: {
            foods: {
              type: "array",
              items: {
                type: "object",
                properties: { name: { type: "string" }, estimatedGrams: { type: "number" } },
                required: ["name", "estimatedGrams"],
                additionalProperties: false,
              },
            },
            mealType: { type: "string", enum: MEAL_TYPES },
            summary: { type: "string" },
          },
          required: ["foods", "mealType", "summary"],
          additionalProperties: false,
        },
      },
    },
  });
  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("empty identification response");
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed.foods) || !MEAL_TYPES.includes(parsed.mealType)) throw new Error("bad identification shape");
  return {
    foods: parsed.foods
      .filter((f: any) => f && typeof f.name === "string" && f.name.trim())
      .map((f: any) => ({ name: f.name.trim(), grams: typeof f.estimatedGrams === "number" && f.estimatedGrams > 0 ? f.estimatedGrams : 100 })),
    mealType: parsed.mealType,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
}

export async function lookupFoodFacts(items: Array<{ key: string; name: string }>): Promise<FoodFact[]> {
  const result = await invokeLLM({
    maxTokens: 4096,
    messages: [
      {
        role: "system",
        content: `You provide gut-health facts for foods, for people with IBS. Return JSON only.
For each food give: category, fodmap (low/moderate/high for a typical serving, following common low-FODMAP diet guidance),
hiddenIngredients (ingredients typically present in the usual preparation that are common IBS triggers, e.g. garlic, onion, wheat, lactose, high-fructose corn syrup; empty if none),
and proteinPer100g (grams of protein per 100 g, as typically prepared/cooked). Echo each food's "key" exactly.`,
      },
      { role: "user", content: JSON.stringify(items) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "food_facts",
        strict: true,
        schema: {
          type: "object",
          properties: {
            foods: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string" },
                  category: { type: "string", enum: CATEGORIES },
                  fodmap: { type: "string", enum: FODMAPS },
                  hiddenIngredients: { type: "array", items: { type: "string" } },
                  proteinPer100g: { type: "number" },
                },
                required: ["key", "category", "fodmap", "hiddenIngredients", "proteinPer100g"],
                additionalProperties: false,
              },
            },
          },
          required: ["foods"],
          additionalProperties: false,
        },
      },
    },
  });
  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("empty lookup response");
  const parsed = JSON.parse(content);
  const nameByKey = new Map(items.map(i => [i.key, i.name]));
  const facts: FoodFact[] = [];
  for (const f of Array.isArray(parsed.foods) ? parsed.foods : []) {
    if (!f || !nameByKey.has(f.key) || !CATEGORIES.includes(f.category) || !FODMAPS.includes(f.fodmap)) continue;
    if (typeof f.proteinPer100g !== "number" || !Number.isFinite(f.proteinPer100g)) continue;
    facts.push({
      foodKey: f.key,
      name: nameByKey.get(f.key)!,
      category: f.category,
      fodmap: f.fodmap,
      hiddenIngredients: Array.isArray(f.hiddenIngredients) ? f.hiddenIngredients.filter((h: unknown) => typeof h === "string").slice(0, 8) : [],
      proteinPer100gTenths: Math.round(Math.min(100, Math.max(0, f.proteinPer100g)) * 10),
      source: "ai",
    });
  }
  return facts;
}

let seeded: Promise<void> | null = null;
/** Insert the starter foods once per process (ignored if they already exist). */
export function ensureFoodSeed(saveFacts: (f: FoodFact[]) => Promise<void>): Promise<void> {
  if (!seeded) seeded = saveFacts(FOOD_SEED).catch(() => { seeded = null; });
  return seeded;
}
