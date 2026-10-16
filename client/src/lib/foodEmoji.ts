// Picks an emoji for a meal with no photo, from its food names. Order matters: first match wins,
// so specific words sit above generic ones. Returns null when nothing matches (caller shows a meal-type icon).

const RULES: [RegExp, string][] = [
  [/\b(pizza)\b/, "🍕"], [/\b(burger|cheeseburger)\b/, "🍔"], [/\b(taco|burrito|quesadilla)s?\b/, "🌮"],
  [/\b(sushi|sashimi|maki)\b/, "🍣"], [/\b(ramen|noodle|pho)s?\b/, "🍜"], [/\b(spaghetti|pasta|penne|macaroni|lasagna|gnocchi)\b/, "🍝"],
  [/\b(hot ?dog|sausage|bratwurst)s?\b/, "🌭"], [/\b(sandwich|sub|panini|wrap)s?\b/, "🥪"], [/\b(fries|french fries)\b/, "🍟"],
  [/\b(salad)s?\b/, "🥗"], [/\b(soup|stew|broth|chili)\b/, "🍲"], [/\b(curry)\b/, "🍛"], [/\b(rice|risotto)\b/, "🍚"],
  [/\b(egg|eggs|omelet|omelette|scrambled)\b/, "🥚"], [/\b(bacon)\b/, "🥓"], [/\b(steak|beef|brisket|lamb|pork|ribs?)\b/, "🥩"],
  [/\b(chicken|turkey|drumstick|wings?)\b/, "🍗"], [/\b(salmon|tuna|fish|cod|shrimp|prawn|seafood|tilapia)\b/, "🐟"],
  [/\b(cheese|cheddar|mozzarella|parmesan)\b/, "🧀"], [/\b(yogurt|yoghurt|kefir|skyr)\b/, "🥣"], [/\b(milk|latte|cappuccino)\b/, "🥛"],
  [/\b(oat|oats|oatmeal|porridge|cereal|granola|muesli)\b/, "🥣"], [/\b(pancake|waffle|crepe)s?\b/, "🥞"],
  [/\b(bagel)s?\b/, "🥯"], [/\b(croissant)s?\b/, "🥐"], [/\b(toast|bread|bun|roll|baguette|sourdough)s?\b/, "🍞"],
  [/\b(pretzel)s?\b/, "🥨"], [/\b(cookie|biscuit)s?\b/, "🍪"], [/\b(cake|cupcake|brownie|muffin|pie)s?\b/, "🍰"],
  [/\b(ice ?cream|gelato|sorbet)\b/, "🍨"], [/\b(chocolate|candy|sweets?)\b/, "🍫"], [/\b(donut|doughnut)s?\b/, "🍩"],
  [/\b(popcorn)\b/, "🍿"], [/\b(chips|crisps|nachos)\b/, "🥔"], [/\b(potato|potatoes|hash ?brown)\b/, "🥔"],
  [/\b(banana)s?\b/, "🍌"], [/\b(apple)s?\b/, "🍎"], [/\b(pear)s?\b/, "🍐"], [/\b(orange|mandarin|clementine|tangerine)s?\b/, "🍊"],
  [/\b(lemon|lime)s?\b/, "🍋"], [/\b(strawberr(y|ies))\b/, "🍓"], [/\b(blueberr(y|ies)|blackberr(y|ies)|raspberr(y|ies)|berries)\b/, "🫐"],
  [/\b(grape)s?\b/, "🍇"], [/\b(watermelon|melon|cantaloupe)\b/, "🍉"], [/\b(peach|nectarine|apricot)s?\b/, "🍑"],
  [/\b(cherr(y|ies))\b/, "🍒"], [/\b(pineapple)\b/, "🍍"], [/\b(mango)e?s?\b/, "🥭"], [/\b(kiwi)s?\b/, "🥝"], [/\b(avocado|guacamole)s?\b/, "🥑"],
  [/\b(tomato)e?s?\b/, "🍅"], [/\b(carrot)s?\b/, "🥕"], [/\b(corn)\b/, "🌽"], [/\b(broccoli|cauliflower)\b/, "🥦"],
  [/\b(cucumber|zucchini|courgette)s?\b/, "🥒"], [/\b(pepper|capsicum)s?\b/, "🫑"], [/\b(onion|garlic|leek)s?\b/, "🧅"],
  [/\b(mushroom)s?\b/, "🍄"], [/\b(spinach|kale|lettuce|greens|arugula)\b/, "🥬"], [/\b(bean|beans|lentil|lentils|chickpea|chickpeas|hummus)\b/, "🫘"],
  [/\b(peanut|almond|walnut|cashew|pistachio|nut|nuts|trail mix)s?\b/, "🥜"], [/\b(butter)\b/, "🧈"],
  [/\b(coffee|espresso|americano)\b/, "☕"], [/\b(tea|matcha|chai)\b/, "🍵"], [/\b(smoothie|shake|protein|whey|juice)\b/, "🥤"],
  [/\b(water|sparkling|seltzer|soda|cola)\b/, "🥤"], [/\b(beer|ale|lager)\b/, "🍺"], [/\b(wine)\b/, "🍷"],
];

export function foodEmoji(names: string[]): string | null {
  for (const raw of names) {
    const n = raw.toLowerCase();
    for (const [re, emoji] of RULES) if (re.test(n)) return emoji;
  }
  return null;
}
