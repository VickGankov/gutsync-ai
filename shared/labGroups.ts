// Grouping for the marker picker. Categories are a convenience for finding things, matched on the
// marker's name. A name that matches nothing lands in "Other", so no marker is ever hidden.
// "Needs attention" means the latest value is outside the range printed on the person's own report.

import type { RangeStatus } from "./labs";

export const CATEGORY_ORDER = [
  "Hormones", "Metabolic", "Lipids", "Thyroid", "Liver", "Kidney",
  "Blood count", "Vitamins & minerals", "Electrolytes", "Inflammation", "Other",
] as const;
export type LabCategory = (typeof CATEGORY_ORDER)[number];

// First match wins, so more specific names come first ("hemoglobin a1c" is metabolic, not blood count).
const RULES: Array<[LabCategory, RegExp]> = [
  ["Metabolic", /a1c|glucose|insulin|fructosamine|c-peptide/],
  ["Thyroid", /\btsh\b|thyro|\bt3\b|\bt4\b/],
  ["Lipids", /cholesterol|\bldl|\bhdl|triglycerid|apo ?[ab]\b|lipoprotein|lp\(a\)/],
  ["Hormones", /testosterone|estradiol|\be2\b|shbg|\blh\b|\bfsh\b|prolactin|cortisol|dhea|igf|somatomedin|growth hormone|progesterone|z.?score/],
  ["Liver", /\balt\b|\bast\b|\bggt\b|alkaline|alk phos|bilirubin|albumin|alanine|aspartate/],
  ["Kidney", /creatinine|egfr|glomerular|\bbun\b|urea|cystatin|uric/],
  ["Inflammation", /crp|c-reactive|\besr\b|sed rate|homocysteine|fibrinogen/],
  ["Vitamins & minerals", /vitamin|b12|folate|ferritin|\biron\b|tibc|transferrin|magnesium|zinc|selenium|copper/],
  ["Electrolytes", /sodium|potassium|calcium|chloride|bicarbonate|\bco2\b|phosph/],
  ["Blood count", /hemoglobin|hematocrit|\brbc\b|\bwbc\b|platelet|\bmcv\b|\bmch|\brdw\b|neutrophil|lymphocyte|monocyte|eosinophil|basophil|red blood|white blood/],
];

export function categoryOf(marker: string): LabCategory {
  const low = marker.toLowerCase();
  return RULES.find(([, re]) => re.test(low))?.[0] ?? "Other";
}

export type GroupMode = "category" | "alpha";
export interface PickerItem { marker: string; status: RangeStatus | null }
export interface PickerGroup<T> { title: string; items: T[] }

const byName = (a: { marker: string }, b: { marker: string }) => a.marker.localeCompare(b.marker, undefined, { sensitivity: "base", numeric: true });

/**
 * Category mode: out-of-range markers first under "Needs attention" (each marker appears once), then the
 * categories in a fixed order. A-Z mode: one group per first letter ("#" for names starting with a digit
 * or symbol). Empty groups are dropped. Optional `query` filters by name first.
 */
export function groupMarkers<T extends PickerItem>(items: T[], mode: GroupMode, query = ""): PickerGroup<T>[] {
  const q = query.trim().toLowerCase();
  const list = (q ? items.filter(i => i.marker.toLowerCase().includes(q)) : items).slice().sort(byName);
  if (mode === "alpha") {
    const m = new Map<string, T[]>();
    for (const i of list) {
      const c = i.marker.trim().charAt(0).toUpperCase();
      const k = /[A-Z]/.test(c) ? c : "#";
      m.set(k, [...(m.get(k) ?? []), i]);
    }
    return Array.from(m.entries()).sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b))).map(([title, items]) => ({ title, items }));
  }
  const attention = list.filter(i => i.status === "above" || i.status === "below");
  const rest = list.filter(i => !(i.status === "above" || i.status === "below"));
  const groups: PickerGroup<T>[] = [{ title: "Needs attention", items: attention }];
  for (const cat of CATEGORY_ORDER) groups.push({ title: cat, items: rest.filter(i => categoryOf(i.marker) === cat) });
  return groups.filter(g => g.items.length > 0);
}
