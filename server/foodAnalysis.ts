// Two-stage meal analysis: the vision model only identifies foods (fast), facts come from our
// food cache, and the AI is asked about foods we haven't seen before (then cached for everyone).

import { invokeLLM } from "./_core/llm";
import { FOOD_SEED } from "./foodSeed";
import {
  displayName, normalizeFoodKey, proteinForPortion,
  type FoodFact, type FoodCategory, type FodmapLevel,
} from "../shared/foodCache";
import { classifyIngredients } from "../shared/ingredients";
import type { MealFood } from "../drizzle/schema";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export interface Timings { path: "fast" | "legacy"; identifyMs: number; lookupMs: number; totalMs: number; foods: number; cacheHits: number }
export interface Analysis { foods: MealFood[]; mealType: MealType; summary: string; timings?: Timings }
export interface IdentifiedFood { name: string; grams: number; packaged: boolean; labelIngredients: string[]; labelProteinG: number }
export interface Identified { foods: IdentifiedFood[]; mealType: MealType; summary: string }

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

    // Packaged products are never cached by name (ingredients differ by brand). If the label's
    // ingredient list was legible we classify it directly; otherwise the AI estimates.
    const labelled = items.filter(i => i.packaged && i.labelIngredients.length >= 2);
    const packagedGuess = items.filter(i => i.packaged && i.labelIngredients.length < 2);
    const generic = items.filter(i => !i.packaged);

    const genericKeys = Array.from(new Set(generic.map(i => i.key)));
    let known: FoodFact[] = [];
    if (genericKeys.length) {
      try { known = await deps.getFacts(genericKeys); } catch { /* cache unavailable: treat everything as unknown */ }
    }
    const byKey = new Map(known.map(f => [f.foodKey, f]));
    const missing = genericKeys.filter(k => !byKey.has(k));

    // One lookup call covers unknown generic foods and un-labelled packaged products.
    const guessKeys = Array.from(new Set(packagedGuess.map(i => `pkg ${i.key}`)));
    const toLookup = [
      ...missing.map(k => ({ key: k, name: generic.find(i => i.key === k)!.name })),
      ...guessKeys.map(k => ({ key: k, name: packagedGuess.find(i => `pkg ${i.key}` === k)!.name })),
    ];
    const lookedUp = new Map<string, FoodFact>();
    let lookupMs = 0;
    if (toLookup.length) {
      const tl = Date.now();
      const fresh = await deps.lookup(toLookup);
      lookupMs = Date.now() - tl;
      fresh.forEach(f => lookedUp.set(f.foodKey, f));
      if (toLookup.some(i => !lookedUp.has(i.key))) throw new Error("lookup missing foods");
      const toSave = fresh.filter(f => missing.includes(f.foodKey));
      if (toSave.length) deps.saveFacts(toSave).catch(() => { /* caching is best-effort */ });
    }

    const foods: MealFood[] = items.map(i => {
      if (labelled.includes(i)) {
        const v = classifyIngredients(i.labelIngredients);
        return {
          name: displayName(i.name), category: "other" as const, fodmap: v.fodmap, hiddenIngredients: v.triggers,
          ...(i.labelProteinG > 0 ? { proteinGrams: Math.round(i.labelProteinG) } : {}),
          packaged: true, basis: "label" as const,
        };
      }
      if (i.packaged) {
        const f = lookedUp.get(`pkg ${i.key}`)!;
        return {
          name: displayName(i.name), category: f.category, fodmap: f.fodmap, hiddenIngredients: f.hiddenIngredients,
          proteinGrams: i.labelProteinG > 0 ? Math.round(i.labelProteinG) : proteinForPortion(f.proteinPer100gTenths, i.grams),
          packaged: true, basis: "estimate" as const,
        };
      }
      const f = byKey.get(i.key) ?? lookedUp.get(i.key)!;
      return {
        name: displayName(i.name), category: f.category, fodmap: f.fodmap, hiddenIngredients: f.hiddenIngredients,
        proteinGrams: proteinForPortion(f.proteinPer100gTenths, i.grams),
      };
    });
    const timings: Timings = {
      path: "fast", identifyMs: t1 - t0, lookupMs, totalMs: Date.now() - t0,
      foods: items.length, cacheHits: genericKeys.length - missing.length,
    };
    log(`[analyze] ${JSON.stringify(timings)}`);
    return { foods, mealType: ident.mealType, summary: ident.summary, timings };
  } catch (err) {
    console.warn("[analyze] fast path failed, using single-call analysis:", err instanceof Error ? err.message : err);
    const legacy = await deps.legacy(imageUrl);
    return { ...legacy, timings: { path: "legacy", identifyMs: 0, lookupMs: 0, totalMs: Date.now() - t0, foods: legacy.foods.length, cacheHits: 0 } };
  }
}

// ─── Real implementations ───

export async function identifyFoods(imageUrl: string): Promise<Identified> {
  const result = await invokeLLM({
    maxTokens: 4096,
    reasoningEffort: "none",
    messages: [
      {
        role: "system",
        content: `You identify foods in meal photos for a gut-health tracker. Return JSON only.
- foods: every distinct food or drink item visible, including visible sauces and dressings. For each: name, estimatedGrams (grams or mL of that item in the visible portion), packaged, labelIngredients, labelProteinG.
- For unpackaged food use plain, generic, singular, lowercase names without cooking adjectives: "chicken breast", "white rice", "broccoli", "tomato sauce", "egg".
- For a packaged or branded product (bottle, can, wrapper, box), set packaged=true (any bottled or canned drink, snack, bar or boxed item with a brand on it is packaged, even if it looks like plain lemonade or juice) and name it exactly as printed on the package: brand plus product name and flavor, e.g. "Kirkland Signature zero sugar vitamin water, lemonade". Read the whole label; if it says zero sugar, diet or sparkling, say so in the name.
- labelIngredients: if the product's ingredient list is legible anywhere in the photo, transcribe it exactly as printed, one entry per ingredient. Otherwise an empty array. Never guess ingredients.
- labelProteinG: grams of protein per container or serving shown on a nutrition label or front panel for what is being consumed; 0 if not visible.
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
                properties: {
                  name: { type: "string" },
                  estimatedGrams: { type: "number" },
                  packaged: { type: "boolean" },
                  labelIngredients: { type: "array", items: { type: "string" } },
                  labelProteinG: { type: "number" },
                },
                required: ["name", "estimatedGrams", "packaged", "labelIngredients", "labelProteinG"],
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
      .map((f: any): IdentifiedFood => ({
        name: f.name.trim(),
        grams: typeof f.estimatedGrams === "number" && f.estimatedGrams > 0 ? f.estimatedGrams : 100,
        packaged: f.packaged === true,
        labelIngredients: Array.isArray(f.labelIngredients) ? f.labelIngredients.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim()) : [],
        labelProteinG: typeof f.labelProteinG === "number" && f.labelProteinG > 0 ? f.labelProteinG : 0,
      })),
    mealType: parsed.mealType,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
}

export async function lookupFoodFacts(items: Array<{ key: string; name: string }>): Promise<FoodFact[]> {
  const result = await invokeLLM({
    maxTokens: 4096,
    reasoningEffort: "none",
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

export interface LabelRead { productName: string; ingredients: string[]; proteinGrams: number }

/** Read the ingredient list (and protein, if shown) from a photo of a product label. */
export async function readLabelImage(imageUrl: string): Promise<LabelRead> {
  const result = await invokeLLM({
    maxTokens: 4096,
    reasoningEffort: "none",
    messages: [
      {
        role: "system",
        content: `You read food product labels. Return JSON only.
- ingredients: the ingredient list transcribed exactly as printed, one entry per ingredient (keep sub-ingredients in parentheses with their parent). If no ingredient list is legible, return an empty array. Never guess.
- productName: brand and product name if visible on this photo, else an empty string.
- proteinGrams: grams of protein for the amount in one container/serving from the nutrition facts if legible, else 0.`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Read this product label." },
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "label_read",
        strict: true,
        schema: {
          type: "object",
          properties: {
            ingredients: { type: "array", items: { type: "string" } },
            productName: { type: "string" },
            proteinGrams: { type: "number" },
          },
          required: ["ingredients", "productName", "proteinGrams"],
          additionalProperties: false,
        },
      },
    },
  });
  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") throw new Error("empty label response");
  const parsed = JSON.parse(content);
  return {
    ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim()) : [],
    productName: typeof parsed.productName === "string" ? parsed.productName.trim() : "",
    proteinGrams: typeof parsed.proteinGrams === "number" && parsed.proteinGrams > 0 ? parsed.proteinGrams : 0,
  };
}

let seeded: Promise<void> | null = null;
/** Insert the starter foods once per process (ignored if they already exist). */
export function ensureFoodSeed(saveFacts: (f: FoodFact[]) => Promise<void>): Promise<void> {
  if (!seeded) seeded = saveFacts(FOOD_SEED).catch(() => { seeded = null; });
  return seeded;
}
