/**
 * FODMAP Classification Explanations
 * 
 * Provides transparent, research-based explanations for why foods
 * are classified as high, moderate, or low FODMAP.
 * 
 * This builds user trust by showing the reasoning behind classifications,
 * not just the label.
 */

export const FODMAP_EXPLANATIONS: Record<string, Record<string, string>> = {
  // Fruits
  apple: {
    high: "Apples contain high levels of fructose and sorbitol, both fermentable carbohydrates that can trigger IBS symptoms.",
    moderate: "Some apple varieties are lower in fructose. Granny Smith apples are a moderate option.",
    low: "Bananas, blueberries, and grapes are low-FODMAP fruits that are generally well-tolerated.",
  },
  banana: {
    low: "Bananas are low in fermentable carbohydrates and are well-tolerated by most people with IBS.",
  },
  strawberry: {
    low: "Strawberries are low in FODMAPs and are a good fruit choice for low-FODMAP diets.",
  },
  mango: {
    high: "Mangoes are high in fructose, which exceeds glucose levels and can be poorly absorbed.",
  },
  pear: {
    high: "Pears contain high levels of fructose and sorbitol, making them high-FODMAP.",
  },

  // Vegetables
  garlic: {
    high: "Garlic is one of the highest FODMAP foods due to very high fructan content. Even small amounts can trigger symptoms.",
    note: "Garlic-infused oil (where solids are removed) is low-FODMAP.",
  },
  onion: {
    high: "Onions contain high levels of fructans, making them a major trigger for many people with IBS.",
    note: "Garlic and onions are often hidden in sauces, dressings, and prepared foods.",
  },
  broccoli: {
    moderate: "Broccoli is moderate in FODMAPs. Small portions (1 cup) are typically tolerated.",
  },
  carrot: {
    low: "Carrots are low in FODMAPs and are a good vegetable choice.",
  },
  spinach: {
    low: "Spinach is low in FODMAPs and is well-tolerated.",
  },
  tomato: {
    low: "Tomatoes are low in FODMAPs, though some people are sensitive to nightshades.",
  },

  // Grains
  wheat: {
    high: "Wheat contains high levels of fructans. Bread, pasta, and cereals made from wheat are high-FODMAP.",
  },
  rice: {
    low: "White and brown rice are low in FODMAPs and are staple foods in low-FODMAP diets.",
  },
  oats: {
    moderate: "Oats are moderate in FODMAPs. Small portions (1/2 cup dry) are typically tolerated.",
  },

  // Dairy
  milk: {
    high: "Regular cow's milk contains lactose, which is a FODMAP. Lactose-free milk is low-FODMAP.",
  },
  yogurt: {
    moderate: "Plain yogurt is moderate in FODMAPs due to lactose content. Lactose-free yogurt is low-FODMAP.",
  },
  cheese: {
    low: "Hard cheeses are low in lactose and are low-FODMAP. Soft cheeses may be higher.",
  },

  // Proteins
  chicken: {
    low: "Chicken is low in FODMAPs and is a staple protein in low-FODMAP diets.",
  },
  beef: {
    low: "Beef is low in FODMAPs and is a good protein choice.",
  },
  salmon: {
    low: "Salmon is low in FODMAPs and provides omega-3 fatty acids.",
  },
  beans: {
    high: "Beans are high in oligosaccharides (a type of FODMAP) and can cause significant bloating.",
  },
  lentils: {
    high: "Lentils are high in oligosaccharides and are high-FODMAP.",
  },

  // Sweeteners
  honey: {
    high: "Honey is high in fructose and is high-FODMAP.",
  },
  "high fructose corn syrup": {
    high: "HFCS is high in fructose and is high-FODMAP.",
  },
  sugar: {
    low: "Regular sugar (sucrose) is low-FODMAP.",
  },
  stevia: {
    low: "Stevia is a low-FODMAP sweetener.",
  },
};

/**
 * Get explanation for a food's FODMAP classification
 */
export function getFODMAPExplanation(
  foodName: string,
  level: "low" | "moderate" | "high"
): string {
  const normalized = foodName.toLowerCase();
  const explanations = FODMAP_EXPLANATIONS[normalized];

  if (!explanations) {
    return getGenericExplanation(level);
  }

  return explanations[level] || getGenericExplanation(level);
}

/**
 * Generic explanations when specific food data isn't available
 */
function getGenericExplanation(level: "low" | "moderate" | "high"): string {
  const explanations: Record<string, string> = {
    high: "This food contains high levels of fermentable carbohydrates (FODMAPs) that can trigger IBS symptoms like bloating, gas, and abdominal pain in sensitive individuals.",
    moderate: "This food contains moderate levels of FODMAPs. Portion size matters—small amounts may be tolerated, but larger portions could trigger symptoms.",
    low: "This food is low in fermentable carbohydrates and is generally well-tolerated by people following a low-FODMAP diet.",
  };

  return explanations[level] || "Classification based on FODMAP research.";
}

/**
 * Get a note about hidden FODMAPs (e.g., garlic in sauces)
 */
export function getHiddenFODMAPNote(foodName: string): string | null {
  const normalized = foodName.toLowerCase();
  const explanations = FODMAP_EXPLANATIONS[normalized];

  if (!explanations || !explanations.note) {
    return null;
  }

  return explanations.note;
}
