// Two-stage meal analysis: the vision model only identifies foods (fast), facts come from our
// food cache, and the AI is asked about foods we haven't seen before (then cached for everyone).

import { invokeLLM } from "./_core/llm";
import { FOOD_SEED } from "./foodSeed";
import {
  displayName, normalizeFoodKey, proteinForPortion, fiberForPortion,
  type FoodFact, type FoodCategory, type FodmapLevel,
} from "../shared/foodCache";
import { classifyIngredients } from "../shared/ingredients";
import { shortProductName } from "./productLookup";
import type { MealFood } from "../drizzle/schema";

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export interface Timings { path: "fast" | "legacy"; identifyMs: number; lookupMs: number; totalMs: number; foods: number; cacheHits: number }
export interface Analysis { foods: MealFood[]; mealType: MealType; summary: string; timings?: Timings }
export interface IdentifiedFood { name: string; grams: number; packaged: boolean; labelIngredients: string[]; labelProteinG: number; likelyTriggers?: string[]; drinkMl?: number }
export interface Identified { foods: IdentifiedFood[]; mealType: MealType; summary: string }

export interface Deps {
  identify(imageUrl: string): Promise<Identified>;
  lookup(items: Array<{ key: string; name: string }>): Promise<FoodFact[]>;
  getFacts(keys: string[]): Promise<FoodFact[]>;
  saveFacts(facts: FoodFact[]): Promise<void>;
  /** Fill in fiber for cached foods that predate fiber tracking. */
  saveFiber?(rows: Array<{ foodKey: string; fiberPer100gTenths: number }>): Promise<void>;
  /** Optional packaged-product lookup (Open Food Facts) returning a real ingredient list. */
  findProduct?(name: string): Promise<{ name: string; ingredients: string[] } | null>;
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

    // One entry per product: merge repeats of the same item the model listed twice.
    const merged = new Map<string, IdentifiedFood & { key: string }>();
    for (const f of ident.foods) {
      const key = normalizeFoodKey(f.name);
      if (!key) continue;
      const prev = merged.get(key);
      if (!prev) { merged.set(key, { ...f, key }); continue; }
      merged.set(key, {
        ...prev,
        grams: prev.grams + f.grams,
        packaged: prev.packaged || f.packaged,
        labelIngredients: f.labelIngredients.length > prev.labelIngredients.length ? f.labelIngredients : prev.labelIngredients,
        likelyTriggers: Array.from(new Set([...(prev.likelyTriggers ?? []), ...(f.likelyTriggers ?? [])])),
        labelProteinG: Math.max(prev.labelProteinG, f.labelProteinG),
        drinkMl: Math.max(prev.drinkMl ?? 0, f.drinkMl ?? 0),
      });
    }
    const items = Array.from(merged.values());

    // Packaged products are never cached by name (ingredients differ by brand). If the label's
    // ingredient list was legible we classify it directly; otherwise the AI estimates.
    const labelled = items.filter(i => i.packaged && i.labelIngredients.length >= 2);
    const packagedGuess = items.filter(i => i.packaged && i.labelIngredients.length < 2);
    const generic = items.filter(i => !i.packaged);

    // Real ingredient lists from the product database beat any estimate; look them up in parallel.
    const dbHits = new Map<string, { name: string; ingredients: string[] }>();
    if (deps.findProduct && packagedGuess.length) {
      await Promise.all(packagedGuess.map(async i => {
        const hit = await deps.findProduct!(i.name).catch(() => null);
        if (hit && hit.ingredients.length >= 2) dbHits.set(i.key, hit);
      }));
    }

    const genericKeys = Array.from(new Set(generic.map(i => i.key)));
    let known: FoodFact[] = [];
    if (genericKeys.length) {
      try { known = await deps.getFacts(genericKeys); } catch { /* cache unavailable: treat everything as unknown */ }
    }
    const byKey = new Map(known.map(f => [f.foodKey, f]));
    const missing = genericKeys.filter(k => !byKey.has(k));
    // Cached before fiber tracking (fiber is explicitly null): ask once, then remember it.
    const needFiber = genericKeys.filter(k => byKey.has(k) && byKey.get(k)!.fiberPer100gTenths === null);

    // One lookup call covers unknown generic foods and un-labelled packaged products.
    // Un-labelled packaged products get NO AI lookup: it could only invent ingredients from the name.
    const toLookup = [...missing, ...needFiber].map(k => ({ key: k, name: generic.find(i => i.key === k)!.name }));
    const lookedUp = new Map<string, FoodFact>();
    let lookupMs = 0;
    if (toLookup.length) {
      const tl = Date.now();
      const fresh = await deps.lookup(toLookup);
      lookupMs = Date.now() - tl;
      fresh.forEach(f => lookedUp.set(f.foodKey, f));
      if (missing.some(k => !lookedUp.has(k))) throw new Error("lookup missing foods");
      const toSave = fresh.filter(f => missing.includes(f.foodKey));
      if (toSave.length) deps.saveFacts(toSave).catch(() => { /* caching is best-effort */ });
      const fiberRows = fresh
        .filter(f => needFiber.includes(f.foodKey) && typeof f.fiberPer100gTenths === "number")
        .map(f => ({ foodKey: f.foodKey, fiberPer100gTenths: f.fiberPer100gTenths as number }));
      if (fiberRows.length && deps.saveFiber) deps.saveFiber(fiberRows).catch(() => { /* best-effort */ });
    }

    const built: MealFood[] = items.map(i => {
      if (labelled.includes(i)) {
        const v = classifyIngredients(i.labelIngredients);
        return {
          name: shortProductName(i.name), category: "other" as const, fodmap: v.fodmap, hiddenIngredients: v.triggers,
          ...(i.labelProteinG > 0 ? { proteinGrams: Math.round(i.labelProteinG) } : {}),
          packaged: true, basis: "label" as const, ingredients: i.labelIngredients,
        };
      }
      const hit = dbHits.get(i.key);
      if (hit) {
        const v = classifyIngredients(hit.ingredients);
        return {
          name: shortProductName(i.name), category: "other" as const, fodmap: v.fodmap, hiddenIngredients: v.triggers,
          ...(i.labelProteinG > 0 ? { proteinGrams: Math.round(i.labelProteinG) } : {}),
          packaged: true, basis: "database" as const, ingredients: hit.ingredients,
        };
      }
      if (i.packaged) {
        // No legible label: use the model's own read of the front of the pack, but never contradict a sugar-free claim.
        const sugarFree = /\b(zero|diet|sugar[- ]?free|no sugar|unsweetened)\b/i.test(i.name);
        const likely = (i.likelyTriggers ?? []).filter(t => !(sugarFree && /sugar|syrup|fructose|glucose|honey|agave/i.test(t)));
        const verdict = classifyIngredients(likely);
        return {
          name: shortProductName(i.name), category: "other" as const, fodmap: likely.length ? verdict.fodmap : sugarFree ? "low" as const : "moderate" as const,
          hiddenIngredients: likely,
          ...(i.labelProteinG > 0 ? { proteinGrams: Math.round(i.labelProteinG) } : {}),
          packaged: true, basis: "estimate" as const,
        };
      }
      const f = byKey.get(i.key) ?? lookedUp.get(i.key)!;
      // Fiber: the cached value when there is one, else the one just looked up (older rows had none).
      const fiberTenths = typeof f.fiberPer100gTenths === "number" ? f.fiberPer100gTenths : lookedUp.get(i.key)?.fiberPer100gTenths;
      return {
        name: displayName(i.name), category: f.category, fodmap: f.fodmap, hiddenIngredients: f.hiddenIngredients,
        // A protein amount the person stated (typed entry) beats the per-100 g estimate.
        proteinGrams: i.labelProteinG > 0 ? Math.round(i.labelProteinG) : proteinForPortion(f.proteinPer100gTenths, i.grams),
        ...(typeof fiberTenths === "number" ? { fiberGrams: fiberForPortion(fiberTenths, i.grams) } : {}),
      };
    });
    const foods: MealFood[] = built.map((f, idx) => (items[idx].drinkMl ? { ...f, volumeMl: items[idx].drinkMl } : f));
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

const IDENTIFY_PROMPT = `You identify foods in meal photos for a gut-health tracker. Return JSON only.
- foods: every distinct food or drink item visible, including visible sauces and dressings. For each: name, estimatedGrams (grams or mL of that item in the visible portion), packaged, labelIngredients, likelyTriggers, drinkMl, labelProteinG.
- One entry per physical item. Never list a package and its contents separately, and never list the same product twice (a bottle and its label are one item).
- For unpackaged food use plain, generic, singular, lowercase names without cooking adjectives: "chicken breast", "white rice", "broccoli", "tomato sauce", "egg".
- For a packaged or branded product (bottle, can, wrapper, box), set packaged=true (any bottled or canned drink, snack, bar or boxed item with a brand on it is packaged, even if it looks like plain lemonade or juice) and name it exactly as printed on the package: brand plus product name and flavor, e.g. "Kirkland Signature zero sugar vitamin water, lemonade". Read the whole label; if it says zero sugar, diet or sparkling, say so in the name.
- labelIngredients: if the product's ingredient list is legible anywhere in the photo, transcribe it exactly as printed, one entry per ingredient. Otherwise an empty array. Never guess ingredients.
- likelyTriggers: only for packaged items whose ingredient list is NOT legible. List the FODMAP-relevant ingredients this product very likely contains (e.g. "high-fructose corn syrup", "sorbitol", "inulin", "lactose", "garlic", "onion"), judged from the brand, product type and front-of-pack claims. Zero sugar, diet, sugar free or zero calorie drinks contain no sugar or syrup: list only sweeteners that are actually likely (sucralose and acesulfame potassium are fine, leave them out). If unsure, leave a trigger out. Empty array when none are likely.
- drinkMl: for non-alcoholic drinks only (water, juice, soda, tea, coffee, milk, sports drinks, vitamin water), the volume in mL being consumed: use the size printed on the container if visible (20 FL OZ = 591 mL, 16.9 FL OZ = 500 mL, 12 FL OZ = 355 mL), otherwise a typical size for the container shown. 0 for food and alcoholic drinks.
- labelProteinG: grams of protein per container or serving shown on a nutrition label or front panel for what is being consumed; 0 if not visible.
- mealType: breakfast, lunch, dinner or snack, inferred from the foods.
- summary: one short sentence describing the meal.
If there is no food in the photo, return an empty foods array.`;

/** Same rules for typed descriptions: there is no label to read and no photo to look at. */
const IDENTIFY_TEXT_PROMPT = IDENTIFY_PROMPT
  .replace("in meal photos for a gut-health tracker", "in a typed description of what someone ate, for a gut-health tracker")
  .replace("every distinct food or drink item visible, including visible sauces and dressings", "every distinct food or drink item mentioned, including sauces and dressings")
  .replace("grams or mL of that item in the visible portion", "grams or mL of that item: use any quantity the person gave (e.g. 2 eggs, a cup of rice, 12 oz coffee), otherwise a typical single serving")
  .replace("- labelIngredients: if the product's ingredient list is legible anywhere in the photo, transcribe it exactly as printed, one entry per ingredient. Otherwise an empty array. Never guess ingredients.", "- labelIngredients: always an empty array for a typed description. Never guess ingredients.")
  .replace("- labelProteinG: grams of protein per container or serving shown on a nutrition label or front panel for what is being consumed; 0 if not visible.", "- labelProteinG: grams of protein the person explicitly stated for that item (e.g. \"a shake with 25g of protein\" is 25 for the shake). Only a number they wrote for that item; never estimate. 0 if they gave none.")
  .replace("If there is no food in the photo, return an empty foods array.", "If the text does not describe any food or drink, return an empty foods array.");

const IDENTIFY_FORMAT = {
  type: "json_schema" as const,
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
              likelyTriggers: { type: "array", items: { type: "string" } },
              drinkMl: { type: "number" },
              labelProteinG: { type: "number" },
            },
            required: ["name", "estimatedGrams", "packaged", "labelIngredients", "likelyTriggers", "drinkMl", "labelProteinG"],
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
};

async function runIdentify(system: string, user: Array<Record<string, unknown>> | string): Promise<Identified> {
  const result = await invokeLLM({
    maxTokens: 4096,
    reasoningEffort: "none",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user as any },
    ],
    response_format: IDENTIFY_FORMAT,
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
        drinkMl: typeof f.drinkMl === "number" && f.drinkMl > 0 ? Math.min(5000, Math.round(f.drinkMl)) : 0,
        likelyTriggers: Array.isArray(f.likelyTriggers) ? f.likelyTriggers.filter((x: unknown) => typeof x === "string" && x.trim()).map((x: string) => x.trim()) : [],
        labelProteinG: typeof f.labelProteinG === "number" && f.labelProteinG > 0 ? f.labelProteinG : 0,
      })),
    mealType: parsed.mealType,
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
}

export async function identifyFoods(imageUrl: string): Promise<Identified> {
  return runIdentify(IDENTIFY_PROMPT, [
    { type: "text", text: "Identify the foods in this meal photo." },
    { type: "image_url", image_url: { url: imageUrl, detail: "auto" } },
  ]);
}

/** Identify foods from what the person typed. The "image" argument of analyzeWithCache carries the text. */
export async function identifyFoodsFromText(text: string): Promise<Identified> {
  return runIdentify(IDENTIFY_TEXT_PROMPT, `What I ate: ${text.trim().slice(0, 600)}`);
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
proteinPer100g (grams of protein per 100 g, as typically prepared/cooked),
and fiberPer100g (grams of dietary fiber per 100 g, as typically prepared/cooked; 0 if none). Echo each food's "key" exactly.`,
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
                  fiberPer100g: { type: "number" },
                },
                required: ["key", "category", "fodmap", "hiddenIngredients", "proteinPer100g", "fiberPer100g"],
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
      fiberPer100gTenths: typeof f.fiberPer100g === "number" && Number.isFinite(f.fiberPer100g)
        ? Math.round(Math.min(100, Math.max(0, f.fiberPer100g)) * 10)
        : null,
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

/** Merge a label read into the analysed foods: the best-matching packaged item (else the first) takes the label's facts. */
export function applyLabelToFoods(foods: MealFood[], label: { productName: string; ingredients: string[]; proteinGrams: number }): MealFood[] {
  if (!foods.length || label.ingredients.length < 2) return foods;
  const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2));
  const lw = words(label.productName);
  const score = (f: MealFood) => (f.packaged ? 100 : 0) + Array.from(words(f.name)).filter(w => lw.has(w)).length;
  let best = 0;
  foods.forEach((f, i) => { if (score(f) > score(foods[best])) best = i; });
  const v = classifyIngredients(label.ingredients);
  return foods.map((f, i) => i !== best ? f : {
    ...f,
    name: label.productName ? shortProductName(label.productName) : f.name,
    fodmap: v.fodmap,
    hiddenIngredients: v.triggers,
    ...(label.proteinGrams > 0 ? { proteinGrams: Math.round(label.proteinGrams) } : {}),
    packaged: true,
    basis: "label" as const,
    ingredients: label.ingredients,
  });
}
