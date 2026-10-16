// Blood work helpers: marker names, range checks, and "what you were taking" runs for the chart overlay.
// Everything here shows timing only. Nothing claims a supplement or dose caused a change.

export interface MarkerInfo { name: string; unit: string; aliases: string[] }

/** Common markers with the unit most US labs print. Aliases help match what an imported report calls them. */
export const COMMON_MARKERS: MarkerInfo[] = [
  { name: "Vitamin D (25-OH)", unit: "ng/mL", aliases: ["vitamin d", "25-hydroxy", "25 hydroxy", "25-oh", "25(oh)d"] },
  { name: "Ferritin", unit: "ng/mL", aliases: ["ferritin"] },
  { name: "Iron", unit: "µg/dL", aliases: ["iron, serum", "serum iron", "iron"] },
  { name: "Vitamin B12", unit: "pg/mL", aliases: ["vitamin b12", "b12", "cobalamin"] },
  { name: "Folate", unit: "ng/mL", aliases: ["folate", "folic acid"] },
  { name: "Magnesium", unit: "mg/dL", aliases: ["magnesium"] },
  { name: "Zinc", unit: "µg/dL", aliases: ["zinc"] },
  { name: "TSH", unit: "µIU/mL", aliases: ["tsh", "thyroid stimulating"] },
  { name: "Hemoglobin A1C", unit: "%", aliases: ["a1c", "hba1c", "hemoglobin a1c"] },
  { name: "Glucose (fasting)", unit: "mg/dL", aliases: ["glucose"] },
  { name: "Insulin", unit: "µIU/mL", aliases: ["insulin"] },
  { name: "Total cholesterol", unit: "mg/dL", aliases: ["cholesterol, total", "total cholesterol"] },
  { name: "LDL cholesterol", unit: "mg/dL", aliases: ["ldl"] },
  { name: "HDL cholesterol", unit: "mg/dL", aliases: ["hdl"] },
  { name: "Triglycerides", unit: "mg/dL", aliases: ["triglycerides"] },
  { name: "hs-CRP", unit: "mg/L", aliases: ["hs-crp", "c-reactive", "crp"] },
  { name: "Testosterone (total)", unit: "ng/dL", aliases: ["testosterone, total", "testosterone total", "testosterone"] },
  { name: "Free testosterone", unit: "pg/mL", aliases: ["testosterone, free", "free testosterone"] },
  { name: "Estradiol", unit: "pg/mL", aliases: ["estradiol", "e2"] },
  { name: "SHBG", unit: "nmol/L", aliases: ["shbg", "sex hormone binding"] },
  { name: "LH", unit: "mIU/mL", aliases: ["luteinizing", "lh"] },
  { name: "FSH", unit: "mIU/mL", aliases: ["follicle stimulating", "fsh"] },
  { name: "IGF-1", unit: "ng/mL", aliases: ["igf-1", "igf-i", "igf 1", "somatomedin"] },
  { name: "Cortisol", unit: "µg/dL", aliases: ["cortisol"] },
  { name: "ALT", unit: "U/L", aliases: ["alt", "alanine"] },
  { name: "AST", unit: "U/L", aliases: ["ast", "aspartate"] },
  { name: "Creatinine", unit: "mg/dL", aliases: ["creatinine"] },
  { name: "eGFR", unit: "mL/min/1.73m²", aliases: ["egfr", "glomerular"] },
  { name: "Hemoglobin", unit: "g/dL", aliases: ["hemoglobin"] },
  { name: "Hematocrit", unit: "%", aliases: ["hematocrit"] },
  { name: "Calcium", unit: "mg/dL", aliases: ["calcium"] },
  { name: "Potassium", unit: "mmol/L", aliases: ["potassium"] },
  { name: "Sodium", unit: "mmol/L", aliases: ["sodium"] },
];

/** Map a printed marker name to our canonical name when it clearly matches; otherwise keep it, tidied. */
export function normalizeMarker(raw: string): string {
  const name = raw.replace(/\s+/g, " ").trim().slice(0, 60);
  const low = name.toLowerCase();
  // Exact canonical match first, then the longest alias contained in the printed name.
  const exact = COMMON_MARKERS.find(m => m.name.toLowerCase() === low);
  if (exact) return exact.name;
  let best: { name: string; len: number } | null = null;
  for (const m of COMMON_MARKERS) {
    for (const a of m.aliases) {
      const hit = a.length <= 3 ? new RegExp(`(^|[^a-z])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`).test(low) : low.includes(a);
      if (hit && (!best || a.length > best.len)) best = { name: m.name, len: a.length };
    }
  }
  // "Free testosterone" must not collapse into total testosterone just because it contains the word.
  if (best && /free/.test(low) && best.name === "Testosterone (total)") return "Free testosterone";
  return best ? best.name : name;
}

export type RangeStatus = "below" | "in" | "above";
/** Compare to the range printed on the user's own report. No range means no verdict. */
export function rangeStatus(value: number, low?: number | null, high?: number | null): RangeStatus | null {
  if (low == null && high == null) return null;
  if (low != null && value < low) return "below";
  if (high != null && value > high) return "above";
  return "in";
}

export interface LabPoint { value: number; unit: string; drawnOn: string }

/** Points in one unit only (the most recent entry's unit), with a count of any left out for a different unit. */
export function pointsInLatestUnit<T extends LabPoint>(rows: T[]): { points: T[]; unit: string | null; skipped: number } {
  if (rows.length === 0) return { points: [], unit: null, skipped: 0 };
  const sorted = [...rows].sort((a, b) => a.drawnOn.localeCompare(b.drawnOn));
  const unit = sorted[sorted.length - 1].unit;
  const points = sorted.filter(r => r.unit === unit);
  return { points, unit, skipped: sorted.length - points.length };
}

/** Change between the last two points. Needs at least two. */
export function changeSincePrevious(points: LabPoint[]): { delta: number; pct: number | null; fromOn: string; toOn: string } | null {
  if (points.length < 2) return null;
  const a = points[points.length - 2], b = points[points.length - 1];
  return { delta: b.value - a.value, pct: a.value !== 0 ? ((b.value - a.value) / Math.abs(a.value)) * 100 : null, fromOn: a.drawnOn, toOn: b.drawnOn };
}

// ─── "What you were taking" runs ───────────────────────────────────────────

export interface Run { label: string; dose: string | null; startOn: string; endOn: string; kind: "supplement" | "compound" }

const dayNum = (key: string) => Math.round(Date.parse(`${key}T00:00:00Z`) / 86_400_000);

/**
 * Group dated entries for one item into runs. A run ends when the dose text changes or the gap between
 * entries is more than `maxGapDays` (a break shows as two runs).
 */
export function buildRuns(label: string, kind: Run["kind"], entries: { dateKey: string; dose: string | null }[], maxGapDays: number): Run[] {
  const sorted = [...entries].sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  const runs: Run[] = [];
  for (const e of sorted) {
    const last = runs[runs.length - 1];
    if (last && last.dose === e.dose && dayNum(e.dateKey) - dayNum(last.endOn) <= maxGapDays) last.endOn = e.dateKey;
    else runs.push({ label, dose: e.dose, startOn: e.dateKey, endOn: e.dateKey, kind });
  }
  return runs;
}

/** Position 0..1 of a date inside [from, to]. */
export function positionOf(dateKey: string, fromKey: string, toKey: string): number {
  const span = Math.max(1, dayNum(toKey) - dayNum(fromKey));
  return Math.min(1, Math.max(0, (dayNum(dateKey) - dayNum(fromKey)) / span));
}

export const daysBetween = (a: string, b: string) => dayNum(b) - dayNum(a);
