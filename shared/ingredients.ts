// Deterministic FODMAP-trigger detection for ingredient lists read from a product label.
// Approximate, general guidance — not Monash data. Artificial sweeteners such as sucralose,
// acesulfame potassium, aspartame and stevia are not FODMAPs and are intentionally not flagged.

export type Fodmap = "low" | "moderate" | "high";

const HIGH: Array<[RegExp, string]> = [
  [/high[- ]?fructose|corn syrup solids?|\bhfcs\b/i, "high-fructose corn syrup"],
  [/\bfructose\b/i, "fructose"],
  [/agave/i, "agave"],
  [/\bhoney\b/i, "honey"],
  [/sorbitol/i, "sorbitol"],
  [/mannitol/i, "mannitol"],
  [/xylitol/i, "xylitol"],
  [/maltitol/i, "maltitol"],
  [/isomalt/i, "isomalt"],
  [/lactitol/i, "lactitol"],
  [/sugar alcohol|polyol/i, "sugar alcohols"],
  [/inulin/i, "inulin"],
  [/chicory/i, "chicory root fiber"],
  [/oligofructose|fructooligosaccharide|\bfos\b/i, "fructo-oligosaccharides"],
  [/galacto-?oligosaccharide|\bgos\b/i, "galacto-oligosaccharides"],
  [/garlic/i, "garlic"],
  [/onion|shallot|leek/i, "onion"],
  [/apple (juice|puree|concentrate)|pear (juice|puree|concentrate)/i, "apple/pear juice"],
];

const MODERATE: Array<[RegExp, string]> = [
  [/lactose/i, "lactose"],
  [/\b(skim |nonfat |whole )?milk( powder| solids| protein)?\b(?! ?(chocolate))/i, "milk"],
  [/\bwhey( protein)?( concentrate)?\b/i, "whey"],
  [/\bcream\b|buttermilk/i, "dairy"],
  [/\bwheat\b|\brye\b|barley/i, "wheat/rye/barley"],
  [/erythritol/i, "erythritol"],
  [/polydextrose/i, "polydextrose"],
  [/cashew|pistachio/i, "cashew/pistachio"],
];

export interface IngredientVerdict {
  triggers: string[];
  fodmap: Fodmap;
}

export function classifyIngredients(ingredients: string[]): IngredientVerdict {
  const high = new Set<string>();
  const moderate = new Set<string>();
  for (const raw of ingredients) {
    const text = raw.trim();
    if (!text) continue;
    for (const [re, label] of HIGH) if (re.test(text)) high.add(label);
    for (const [re, label] of MODERATE) if (re.test(text)) moderate.add(label);
  }
  const fodmap: Fodmap = high.size ? "high" : moderate.size ? "moderate" : "low";
  return { triggers: [...Array.from(high), ...Array.from(moderate)], fodmap };
}
