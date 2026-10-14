// Starter food facts. These are approximate, general-knowledge estimates (typical serving, typical
// preparation) — NOT Monash University data. Format: name|category|fodmap|protein g per 100 g|hidden ingredients (;)
// Foods not listed here are looked up by the AI once and then saved to the cache.

import { normalizeFoodKey, type FoodCategory, type FodmapLevel, type FoodFact } from "../shared/foodCache";

const RAW = `
chicken breast|protein|low|31|
chicken thigh|protein|low|26|
turkey|protein|low|29|
deli turkey|protein|low|18|
beef steak|protein|low|26|
ground beef|protein|low|26|
pork chop|protein|low|25|
bacon|protein|low|35|
ham|protein|low|21|
sausage|protein|moderate|14|garlic;onion;wheat filler
hot dog|protein|moderate|11|onion powder;garlic;wheat filler
salmon|protein|low|22|
tuna|protein|low|25|
shrimp|protein|low|24|
cod|protein|low|18|
egg|protein|low|13|
tofu|protein|low|8|
tempeh|protein|low|19|
whey isolate|protein|low|85|
whey protein powder|protein|moderate|75|lactose;sweeteners
protein shake|protein|moderate|8|lactose;sweeteners
protein bar|protein|high|20|chicory root fiber;sugar alcohols;honey
milk|dairy|high|3.4|lactose
lactose-free milk|dairy|low|3.4|
yogurt|dairy|high|4|lactose
greek yogurt|dairy|moderate|9|lactose
lactose-free yogurt|dairy|low|4|
cheddar cheese|dairy|low|25|
mozzarella|dairy|low|22|
parmesan|dairy|low|36|
cream cheese|dairy|low|6|
cottage cheese|dairy|moderate|11|lactose
butter|fat|low|1|
ice cream|dairy|high|3.5|lactose;high-fructose corn syrup
white rice|grain|low|2.7|
brown rice|grain|low|2.6|
oatmeal|grain|low|2.5|
quinoa|grain|low|4.4|
pasta|grain|moderate|5.8|wheat
white bread|grain|moderate|9|wheat;high-fructose corn syrup
whole wheat bread|grain|high|13|wheat
sourdough bread|grain|low|10|
gluten-free bread|grain|low|4|
wheat tortilla|grain|moderate|8|wheat
corn tortilla|grain|low|5|
bagel|grain|high|10|wheat
couscous|grain|high|3.8|wheat
pancake|grain|moderate|6|wheat;lactose
pizza|grain|high|11|wheat;garlic;onion;cheese
cracker|grain|moderate|9|wheat
rice cake|grain|low|7|
popcorn|grain|low|12|
potato|carb|low|2|
french fry|carb|low|3.4|
sweet potato|carb|moderate|1.6|
broccoli|vegetable|low|2.8|
carrot|vegetable|low|0.9|
cucumber|vegetable|low|0.7|
lettuce|vegetable|low|1.4|
spinach|vegetable|low|2.9|
kale|vegetable|low|4|
tomato|vegetable|low|0.9|
zucchini|vegetable|low|1.2|
bell pepper|vegetable|low|1|
green bean|vegetable|low|1.8|
eggplant|vegetable|low|1|
onion|vegetable|high|1|fructans
garlic|vegetable|high|6|fructans
mushroom|vegetable|high|3|mannitol
cauliflower|vegetable|high|1.9|mannitol
asparagus|vegetable|high|2.2|fructans
avocado|fat|moderate|2|sorbitol
corn|vegetable|moderate|3.3|sorbitol
cabbage|vegetable|moderate|1.3|
celery|vegetable|moderate|0.7|mannitol
brussels sprout|vegetable|moderate|3.4|
pea|vegetable|high|5|GOS
leek|vegetable|high|1.5|fructans
banana|fruit|moderate|1.1|fructans
apple|fruit|high|0.3|fructose;sorbitol
blueberry|fruit|low|0.7|
strawberry|fruit|low|0.7|
orange|fruit|low|0.9|
grape|fruit|low|0.7|
pineapple|fruit|low|0.5|
kiwi|fruit|low|1.1|
watermelon|fruit|high|0.6|fructose;mannitol
mango|fruit|high|0.8|fructose
pear|fruit|high|0.4|fructose;sorbitol
peach|fruit|high|0.9|sorbitol
cherry|fruit|high|1|sorbitol
raisin|fruit|high|3|fructose
date|fruit|high|2.5|fructose;sorbitol
lemon|fruit|low|1.1|
chickpea|other|high|8.9|GOS
lentil|other|high|9|GOS
black bean|other|high|8.9|GOS
kidney bean|other|high|8.7|GOS
baked bean|other|high|5|GOS;onion;high-fructose corn syrup
hummus|other|high|8|chickpeas;garlic
almond|fat|moderate|21|GOS
walnut|fat|low|15|
peanut|fat|low|26|
peanut butter|fat|low|25|
olive oil|fat|low|0|
coconut oil|fat|low|0|
tomato sauce|other|high|1.5|garlic;onion
marinara sauce|other|high|1.5|garlic;onion
ketchup|other|moderate|1|high-fructose corn syrup;onion powder
mayonnaise|fat|low|1|
mustard|other|low|4|
soy sauce|other|low|8|wheat
bbq sauce|other|high|1|high-fructose corn syrup;onion;garlic
ranch dressing|other|high|1|garlic powder;onion powder;buttermilk
honey|other|high|0.3|fructose
maple syrup|other|low|0|
granola bar|other|high|7|honey;chicory root fiber
dark chocolate|other|moderate|5|
coffee|other|low|0.1|
`;

export function parseSeed(raw: string = RAW): FoodFact[] {
  return raw
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(line => {
      const [name, category, fodmap, protein, hidden] = line.split("|");
      return {
        foodKey: normalizeFoodKey(name),
        name,
        category: category as FoodCategory,
        fodmap: fodmap as FodmapLevel,
        hiddenIngredients: hidden ? hidden.split(";").map(h => h.trim()).filter(Boolean) : [],
        proteinPer100gTenths: Math.round(parseFloat(protein) * 10),
        source: "seed" as const,
      };
    });
}

export const FOOD_SEED: FoodFact[] = parseSeed();
