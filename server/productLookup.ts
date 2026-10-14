// Looks packaged products up in Open Food Facts (open data, ODbL: https://world.openfoodfacts.org)
// so we can classify their real ingredient list instead of guessing from the front of the pack.
// Results (including misses) are cached in our own table so each product is fetched once.

import { normalizeFoodKey } from "../shared/foodCache";

export interface ProductMatch { name: string; ingredients: string[] }
export interface ProductCacheRow { productKey: string; name: string; ingredients: string[]; found: boolean; createdAt: Date }

const SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const USER_AGENT = "GutSync/1.0 (https://gutsync-ai.onrender.com; vasil.gankov@gmail.com)";
const MISS_RETRY_MS = 7 * 24 * 3600 * 1000;
const STOP = new Set(["the", "and", "with", "flavored", "flavor", "natural", "beverage", "drink", "water", "enhanced"]);

const words = (s: string) => new Set(s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w)));

/** Split an "ingredients_text" string on top-level commas; drops percentages and emphasis markers. */
export function parseIngredients(text: string): string[] {
  const out: string[] = [];
  let depth = 0, cur = "";
  for (const ch of text.replace(/_/g, "")) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";" || ch === ".") && depth === 0) { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out
    .map(s => s.replace(/^\s*(ingredients?|contains)\s*:\s*/i, "").replace(/\s*\d+(\.\d+)?\s*%/g, "").trim())
    .filter(s => s.length > 1 && s.length < 120)
    .slice(0, 80);
}

/** Pick the search hit that best matches the product name; null if nothing is close enough. */
export function pickBestProduct(query: string, hits: Array<{ product_name?: string; brands?: string; ingredients_text?: string }>): ProductMatch | null {
  const q = words(query);
  if (!q.size) return null;
  let best: { score: number; match: ProductMatch } | null = null;
  for (const h of hits) {
    const text = (h.ingredients_text ?? "").trim();
    if (!text) continue;
    const label = `${h.brands ?? ""} ${h.product_name ?? ""}`;
    const hw = words(label);
    const overlap = Array.from(q).filter(w => hw.has(w)).length;
    const score = overlap / q.size;
    const ingredients = parseIngredients(text);
    if (ingredients.length < 2) continue;
    if (!best || score > best.score) best = { score, match: { name: (h.product_name ?? "").trim() || query, ingredients } };
  }
  // Need most of the distinctive words (brand + product) to agree, or we would attach the wrong product.
  return best && best.score >= 0.6 ? best.match : null;
}

export async function searchOpenFoodFacts(query: string, fetchImpl: typeof fetch = fetch, timeoutMs = 4000): Promise<ProductMatch | null> {
  const url = `${SEARCH_URL}?${new URLSearchParams({
    search_terms: query, search_simple: "1", action: "process", json: "1", page_size: "8",
    fields: "product_name,brands,ingredients_text",
  })}`;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" }, signal: ctl.signal });
    if (!res.ok) return null;
    const data = await res.json() as { products?: Array<{ product_name?: string; brands?: string; ingredients_text?: string }> };
    return pickBestProduct(query, data.products ?? []);
  } catch {
    return null; // timeout, rate limit, network: fall back to the front-of-pack estimate
  } finally {
    clearTimeout(timer);
  }
}

export interface ProductStore {
  get(key: string): Promise<ProductCacheRow | null>;
  save(row: { productKey: string; name: string; ingredients: string[]; found: boolean }): Promise<void>;
}

/** Cache-first product lookup. Never throws. */
export async function findProduct(
  name: string,
  store: ProductStore,
  search: (q: string) => Promise<ProductMatch | null> = q => searchOpenFoodFacts(q),
): Promise<ProductMatch | null> {
  const key = `pkg ${normalizeFoodKey(name)}`.slice(0, 160);
  try {
    const cached = await store.get(key);
    if (cached) {
      if (cached.found) return { name: cached.name, ingredients: cached.ingredients };
      if (Date.now() - new Date(cached.createdAt).getTime() < MISS_RETRY_MS) return null;
    }
  } catch { /* cache unavailable: just search */ }
  const match = await search(name);
  store.save({ productKey: key, name: match?.name ?? name, ingredients: match?.ingredients ?? [], found: !!match }).catch(() => {});
  return match;
}
