// Public food-checker data. Plain-language summaries of how common foods are generally classified in
// published low-FODMAP guidance (Monash University is the reference). This is NOT Monash's data and
// it deliberately gives no gram figures: serving size decides the result, and Monash's app has the
// current numbers. Only foods with a well-known, stable classification belong here.

export type Verdict = "high" | "low" | "serving";
export interface Food {
  slug: string;
  name: string;
  verdict: Verdict;
  group: string;
  /** Which FODMAP(s) drive the result, in plain words. */
  because: string;
  /** One or two sentences of nuance (serving size, ripeness, form). */
  note: string;
  /** Commonly suggested alternatives, only for high/serving foods. */
  swaps?: string[];
}

export const FOODS_UPDATED = "2026-11-04";

export const FOODS: Food[] = [
  { slug: "garlic", name: "Garlic", verdict: "high", group: "Vegetables", because: "fructans", note: "Even small amounts can bother people who react to fructans. Garlic-infused oil is commonly used instead, because fructans don't dissolve into oil.", swaps: ["Garlic-infused oil", "Chives (green part)", "Asafoetida in small amounts"] },
  { slug: "onion", name: "Onion", verdict: "high", group: "Vegetables", because: "fructans (and some GOS)", note: "This covers common onions and shallots. The green tops of spring onions are the usual low-FODMAP substitute.", swaps: ["Green tops of spring onions", "Chives", "Onion-infused oil"] },
  { slug: "apple", name: "Apple", verdict: "high", group: "Fruit", because: "excess fructose and sorbitol", note: "Fresh apple, apple juice and dried apple are all affected. Many people tolerate other fruit that is lower in these sugars.", swaps: ["Orange", "Strawberries", "Blueberries"] },
  { slug: "honey", name: "Honey", verdict: "high", group: "Sweeteners", because: "excess fructose", note: "Honey has more fructose than glucose, which is what matters here. Maple syrup is the common swap.", swaps: ["Maple syrup", "Table sugar in modest amounts"] },
  { slug: "wheat-bread", name: "Regular wheat bread", verdict: "high", group: "Grains", because: "fructans from wheat", note: "Normal serving sizes are usually high. Smaller amounts, and breads made with sourdough fermentation or without wheat, are often better tolerated.", swaps: ["Gluten-free bread without high-FODMAP ingredients", "Traditionally made sourdough spelt bread"] },
  { slug: "cows-milk", name: "Cow's milk", verdict: "high", group: "Dairy", because: "lactose", note: "Lactose-free milk is the usual swap, since the lactose is already broken down. Hard aged cheeses are naturally low in lactose.", swaps: ["Lactose-free milk", "Hard cheeses such as cheddar"] },
  { slug: "cashews", name: "Cashews", verdict: "high", group: "Nuts", because: "GOS and fructans", note: "Pistachios are also high. Walnuts, pecans and macadamias are the nuts most often listed as lower in FODMAPs, in measured servings.", swaps: ["Walnuts", "Macadamias", "Pecans"] },
  { slug: "cauliflower", name: "Cauliflower", verdict: "high", group: "Vegetables", because: "mannitol", note: "Broccoli heads are treated differently from cauliflower, and portion size changes the result. Check a current source for the vegetable you actually eat.", swaps: ["Carrot", "Zucchini in small servings", "Spinach"] },
  { slug: "mushrooms", name: "Mushrooms", verdict: "high", group: "Vegetables", because: "mannitol", note: "Common button mushrooms are high. Other varieties are classified differently, so the type matters.", swaps: ["Firm tofu", "Zucchini in small servings"] },
  { slug: "watermelon", name: "Watermelon", verdict: "high", group: "Fruit", because: "excess fructose, fructans and mannitol", note: "It contains several FODMAPs at once, so it is easy to overshoot even with a modest slice.", swaps: ["Orange", "Grapes", "Strawberries"] },
  { slug: "avocado", name: "Avocado", verdict: "serving", group: "Fruit", because: "sorbitol", note: "A small serving is generally treated as low and a larger one as high, so the amount decides it. Many people stay within a small portion.", swaps: ["Small portions only", "Olives"] },
  { slug: "banana", name: "Banana", verdict: "serving", group: "Fruit", because: "fructans and sorbitol rising as it ripens", note: "Firm, slightly underripe bananas are generally lower in FODMAPs than very ripe ones. Ripeness and portion both matter.", swaps: ["Firm, underripe banana", "Strawberries", "Blueberries"] },
  { slug: "oats", name: "Oats", verdict: "serving", group: "Grains", because: "GOS and fructans", note: "A small serving of plain rolled oats is generally low, and larger bowls get higher. Toppings like honey or apple can change the total.", swaps: ["Small portion of oats", "Rice porridge", "Quinoa flakes"] },
  { slug: "sweet-potato", name: "Sweet potato", verdict: "serving", group: "Vegetables", because: "mannitol", note: "A modest serving is generally low and a larger one is higher. White potato is low at normal servings.", swaps: ["Potato", "Carrot", "Pumpkin in small servings"] },
  { slug: "rice", name: "Rice", verdict: "low", group: "Grains", because: "it contains no meaningful FODMAPs", note: "White, brown and basmati rice are all generally low. Fried rice often adds garlic or onion, which changes the answer for the whole dish." },
  { slug: "eggs", name: "Eggs", verdict: "low", group: "Protein", because: "they contain almost no carbohydrate", note: "Eggs themselves aren't a FODMAP source. What you cook them with (onion, garlic, milk) is what usually matters." },
  { slug: "chicken", name: "Plain chicken", verdict: "low", group: "Protein", because: "plain meat contains no FODMAPs", note: "The seasoning, marinade or sauce is the usual problem. Garlic and onion powders are common in packaged chicken." },
  { slug: "carrots", name: "Carrots", verdict: "low", group: "Vegetables", because: "low levels of the main FODMAPs", note: "Raw and cooked carrots are both generally fine at normal servings." },
  { slug: "potatoes", name: "Potatoes", verdict: "low", group: "Vegetables", because: "low levels of the main FODMAPs", note: "Plain boiled, baked or mashed with lactose-free milk are generally low. Watch added onion, garlic or butter-and-cream sauces." },
  { slug: "strawberries", name: "Strawberries", verdict: "low", group: "Fruit", because: "low levels of the main FODMAPs", note: "Generally low in normal servings. Very large amounts of any fruit can add up." },
  { slug: "oranges", name: "Oranges", verdict: "low", group: "Fruit", because: "low levels of the main FODMAPs", note: "Whole oranges are generally low. Juice can be a different story because it concentrates the sugars." },
  { slug: "lactose-free-milk", name: "Lactose-free milk", verdict: "low", group: "Dairy", because: "the lactose has been broken down", note: "Check the label for added high-FODMAP ingredients such as inulin or chicory root in flavored versions." },
  { slug: "firm-tofu", name: "Firm tofu", verdict: "low", group: "Protein", because: "the soluble FODMAPs are drained off in processing", note: "Firm tofu is the usual one. Silken tofu is classified differently." },
  { slug: "spinach", name: "Spinach", verdict: "low", group: "Vegetables", because: "low levels of the main FODMAPs", note: "Generally low in normal servings, raw or cooked." },
  { slug: "maple-syrup", name: "Maple syrup", verdict: "low", group: "Sweeteners", because: "its sugars are balanced, without excess fructose", note: "Pure maple syrup, not pancake syrup, which is often blended with high-fructose ingredients." },
];

export function findFood(slug: string): Food | undefined { return FOODS.find(f => f.slug === slug); }

export const VERDICT_TEXT: Record<Verdict, { label: string; short: string }> = {
  high: { label: "High FODMAP", short: "High" },
  low: { label: "Low FODMAP", short: "Low" },
  serving: { label: "Depends on the serving", short: "Depends" },
};
