// The doctor-ready report, as plain data. Pure: give it the rows, get back the sections. The PDF file only draws this.
// Rules: counts and the user's own words only. No diagnosis, no advice, and no claim that anything caused anything.

import type { MealFood } from "../../drizzle/schema";
import { NEGATIVE_SYMPTOMS } from "../../shared/triggers";
import type { TriggerStat } from "../../shared/triggers";
import type { Confirmation } from "../../shared/triggerConfirm";
import { REINTRO_GROUP_INFO, type ReintroGroup } from "../../shared/reintro";
import { rangeStatus, rangeText, type RangeStatus } from "../../shared/labs";
import { fmtMg } from "../../shared/dose";
import { estimatedOneRepMax } from "../fitness";

const DAY = 86_400_000;
const NEG = new Set<string>(NEGATIVE_SYMPTOMS as readonly string[]);

export interface ReportInput {
  generatedAt: number;
  from: number;
  to: number;
  /** JS Date.getTimezoneOffset() of the person's device (minutes behind UTC). */
  tzOffsetMinutes: number;
  name: string | null;
  includeLabs: boolean;
  includeProtocol: boolean;
  meals: Array<{ mealType: string; foods: MealFood[]; loggedAt: number; notes?: string | null }>;
  symptoms: Array<{ type: string; severity: number; loggedAt: number; notes?: string | null }>;
  weights: Array<{ weightLb10: number; loggedAt: number }>;
  waists: Array<{ waistIn10: number; loggedAt: number }>;
  intake: Array<{ kind: string; amount: number; loggedAt: number }>;
  lifts: Array<{ exercise: string; weightLb: number; reps: number; loggedAt: number }>;
  doses: Array<{ compound: string; doseMcg: number; site: string | null; loggedAt: number }>;
  supplements: Array<{ id: number; name: string; dose: string | null }>;
  supplementLogs: Array<{ supplementId: number; dateKey: string }>;
  labs: Array<{ marker: string; value: number; unit: string; refLow: number | null; refHigh: number | null; drawnOn: string }>;
  challenges: Array<{ foodGroup: string; testFood: string; status: string; outcome: string | null; lowConfidence: number; startedAt: number; finishedAt: number | null }>;
  triggers: Array<TriggerStat & { confirmation: Confirmation | null }>;
  triggerLookbackDays: number;
}

export interface SeriesPoint { t: number; v: number }
export interface ReportModel {
  title: string;
  name: string | null;
  periodLabel: string;
  generatedLabel: string;
  overview: { periodDays: number; daysLogged: number; meals: number; symptomEntries: number };
  symptoms: Array<{ label: string; count: number; days: number; avg: number; max: number }>;
  positives: Array<{ label: string; count: number }>;
  triggers: Array<{
    names: string; symptom: string; hits: number; exposures: number; days: number;
    rate: string; otherRate: string; range: string; sample: string; status: string; note: string | null;
  }>;
  triggerLookbackDays: number;
  reintro: Array<{ group: string; food: string; result: string; date: string }>;
  body: {
    weight: { start: number; end: number; change: number; min: number; max: number; points: SeriesPoint[]; entries: number } | null;
    waist: { start: number; end: number; change: number; entries: number } | null;
  };
  nutrition: { proteinAvgG: number | null; proteinDays: number; waterAvgOz: number | null; waterDays: number } | null;
  strength: Array<{ exercise: string; first: number; last: number; change: number; entries: number }>;
  labs: Array<{ marker: string; unit: string; value: number; drawnOn: string; range: string | null; status: RangeStatus | null; previous: { value: number; drawnOn: string } | null }> | null;
  protocol: {
    compounds: Array<{ name: string; count: number; first: string; last: string; typical: string }>;
    supplements: Array<{ name: string; dose: string | null; daysTaken: number }>;
  } | null;
  diary: { days: Array<{ date: string; lines: string[] }>; truncatedFrom: string | null };
}

// ── date helpers (all in the person's own time zone) ──────────────────────────
const local = (ts: number, tz: number) => new Date(ts - tz * 60_000);
const keyOf = (ts: number, tz: number) => local(ts, tz).toISOString().slice(0, 10);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(ts: number, tz: number): string {
  const d = local(ts, tz);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
function fmtKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
function fmtTime(ts: number, tz: number): string {
  const d = local(ts, tz);
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const symptomLabel = (t: string) => cap(t.replace(/_/g, " "));
const pct = (r: number) => `${Math.round(r * 100)}%`;
const round1 = (n: number) => Math.round(n * 10) / 10;

function sampleText(exposures: number): string {
  return exposures < 8 ? "small sample" : exposures < 15 ? "fair sample" : "larger sample";
}

export function buildReport(i: ReportInput): ReportModel {
  const tz = i.tzOffsetMinutes;
  const inRange = <T extends { loggedAt: number }>(rows: T[]) => rows.filter(r => r.loggedAt >= i.from && r.loggedAt <= i.to);
  const meals = inRange(i.meals), symptoms = inRange(i.symptoms);
  const periodDays = Math.max(1, Math.round((i.to - i.from) / DAY));

  const loggedDays = new Set([...meals, ...symptoms].map(r => keyOf(r.loggedAt, tz)));

  // Symptoms (negative ones in the table; positive outcomes as a short line)
  const byType = new Map<string, { n: number; sum: number; max: number; days: Set<string> }>();
  for (const s of symptoms) {
    const e = byType.get(s.type) ?? { n: 0, sum: 0, max: 0, days: new Set<string>() };
    e.n++; e.sum += s.severity; e.max = Math.max(e.max, s.severity); e.days.add(keyOf(s.loggedAt, tz));
    byType.set(s.type, e);
  }
  const symptomRows = Array.from(byType.entries()).filter(([t]) => NEG.has(t) || !isPositive(t))
    .map(([t, e]) => ({ label: symptomLabel(t), count: e.n, days: e.days.size, avg: round1(e.sum / e.n), max: e.max }))
    .sort((a, b) => b.count - a.count);
  const positives = Array.from(byType.entries()).filter(([t]) => isPositive(t))
    .map(([t, e]) => ({ label: symptomLabel(t), count: e.n })).sort((a, b) => b.count - a.count);

  // Possible triggers (as the app currently sees them) with honest wording
  const triggers = i.triggers.filter(t => t.status !== "common").map(t => ({
    names: t.names.join(" + "),
    symptom: symptomLabel(t.symptom),
    hits: t.hits, exposures: t.exposures, days: t.days,
    rate: pct(t.rate), otherRate: pct(t.otherRate),
    range: `${pct(t.rateLow)} to ${pct(t.rateHigh)}`,
    sample: sampleText(t.exposures),
    status: t.status === "trigger" ? "Possible" : "Too early to tell",
    note: t.confirmation ? confirmationNote(t.confirmation) : null,
  }));

  const reintro = i.challenges.filter(c => c.status === "completed" && c.outcome).sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0)).map(c => ({
    group: REINTRO_GROUP_INFO[c.foodGroup as ReintroGroup]?.label ?? c.foodGroup,
    food: c.testFood,
    result: c.outcome === "tolerated" ? "Tolerated" : c.outcome === "limit" ? "Reacted at a larger portion" : "Reacted",
    date: fmtDate(c.finishedAt ?? c.startedAt, tz),
  }));

  // Body
  const weights = inRange(i.weights).sort((a, b) => a.loggedAt - b.loggedAt);
  const weight = weights.length ? (() => {
    const vals = weights.map(w => w.weightLb10 / 10);
    return { start: vals[0], end: vals[vals.length - 1], change: round1(vals[vals.length - 1] - vals[0]), min: Math.min(...vals), max: Math.max(...vals), points: weights.map(w => ({ t: w.loggedAt, v: w.weightLb10 / 10 })), entries: weights.length };
  })() : null;
  const waists = inRange(i.waists).sort((a, b) => a.loggedAt - b.loggedAt);
  const waist = waists.length ? { start: waists[0].waistIn10 / 10, end: waists[waists.length - 1].waistIn10 / 10, change: round1((waists[waists.length - 1].waistIn10 - waists[0].waistIn10) / 10), entries: waists.length } : null;

  // Nutrition: averages over the days that have entries, so skipped days don't drag them down
  const intake = inRange(i.intake);
  const sumByDay = (kind: string) => {
    const m = new Map<string, number>();
    for (const r of intake.filter(x => x.kind === kind)) m.set(keyOf(r.loggedAt, tz), (m.get(keyOf(r.loggedAt, tz)) ?? 0) + r.amount);
    return m;
  };
  const prot = sumByDay("protein"), water = sumByDay("water");
  const avg = (m: Map<string, number>) => (m.size ? Array.from(m.values()).reduce((a, b) => a + b, 0) / m.size : null);
  const nutrition = prot.size || water.size ? {
    proteinAvgG: avg(prot) == null ? null : Math.round(avg(prot)!), proteinDays: prot.size,
    waterAvgOz: avg(water) == null ? null : Math.round((avg(water)! / 29.5735) * 10) / 10, waterDays: water.size,
  } : null;

  // Strength: estimated one-rep max, first vs last entry in the period, per exercise
  const liftsBy = new Map<string, typeof i.lifts>();
  for (const l of inRange(i.lifts).sort((a, b) => a.loggedAt - b.loggedAt)) liftsBy.set(l.exercise, [...(liftsBy.get(l.exercise) ?? []), l]);
  const strength = Array.from(liftsBy.entries()).map(([exercise, rows]) => {
    const f = estimatedOneRepMax(rows[0].weightLb, rows[0].reps), l = estimatedOneRepMax(rows[rows.length - 1].weightLb, rows[rows.length - 1].reps);
    return { exercise, first: f, last: l, change: l - f, entries: rows.length };
  }).sort((a, b) => b.entries - a.entries).slice(0, 6);

  // Labs: latest per marker (in the latest entry's unit), with the lab's own printed range
  let labs: ReportModel["labs"] = null;
  if (i.includeLabs) {
    const byMarker = new Map<string, typeof i.labs>();
    for (const r of i.labs) byMarker.set(r.marker, [...(byMarker.get(r.marker) ?? []), r]);
    labs = Array.from(byMarker.entries()).map(([marker, rows]) => {
      const sorted = [...rows].sort((a, b) => a.drawnOn.localeCompare(b.drawnOn));
      const latest = sorted[sorted.length - 1];
      const prev = [...sorted].reverse().find(r => r !== latest && r.unit === latest.unit) ?? null;
      return { marker, unit: latest.unit, value: latest.value, drawnOn: latest.drawnOn, range: rangeText(latest.refLow, latest.refHigh), status: rangeStatus(latest.value, latest.refLow, latest.refHigh), previous: prev ? { value: prev.value, drawnOn: prev.drawnOn } : null };
    }).sort((a, b) => a.marker.localeCompare(b.marker));
  }

  // Protocol: doses in the period and supplements taken
  let protocol: ReportModel["protocol"] = null;
  if (i.includeProtocol) {
    const doses = inRange(i.doses).sort((a, b) => a.loggedAt - b.loggedAt);
    const byC = new Map<string, typeof doses>();
    for (const d of doses) byC.set(d.compound, [...(byC.get(d.compound) ?? []), d]);
    const compounds = Array.from(byC.entries()).map(([name, rows]) => {
      const doseCounts = new Map<number, number>();
      for (const r of rows) doseCounts.set(r.doseMcg, (doseCounts.get(r.doseMcg) ?? 0) + 1);
      const typical = Array.from(doseCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
      const distinct = doseCounts.size;
      return { name, count: rows.length, first: fmtDate(rows[0].loggedAt, tz), last: fmtDate(rows[rows.length - 1].loggedAt, tz), typical: distinct > 1 ? `${fmtMg(typical)} (most common; ${distinct} different doses)` : fmtMg(typical) };
    }).sort((a, b) => b.count - a.count);
    const fromKey = keyOf(i.from, tz), toKey = keyOf(i.to, tz);
    const taken = new Map<number, Set<string>>();
    for (const l of i.supplementLogs) if (l.dateKey >= fromKey && l.dateKey <= toKey) taken.set(l.supplementId, (taken.get(l.supplementId) ?? new Set()).add(l.dateKey));
    const supplements = i.supplements.map(s => ({ name: s.name, dose: s.dose, daysTaken: taken.get(s.id)?.size ?? 0 })).filter(s => s.daysTaken > 0).sort((a, b) => b.daysTaken - a.daysTaken);
    protocol = compounds.length || supplements.length ? { compounds, supplements } : { compounds: [], supplements: [] };
  }

  // Diary: the most recent 14 logged days in the period, oldest first, to keep the report readable
  const dayMap = new Map<string, Array<{ at: number; text: string }>>();
  const add = (at: number, text: string) => { const k = keyOf(at, tz); dayMap.set(k, [...(dayMap.get(k) ?? []), { at, text }]); };
  for (const m of meals) add(m.loggedAt, `${fmtTime(m.loggedAt, tz)}  ${cap(m.mealType)}: ${foodsText(m.foods)}${m.notes ? ` (${m.notes})` : ""}`);
  for (const s of symptoms) add(s.loggedAt, `${fmtTime(s.loggedAt, tz)}  Symptom: ${symptomLabel(s.type)}, severity ${s.severity}/5${s.notes ? ` (${s.notes})` : ""}`);
  const allKeys = Array.from(dayMap.keys()).sort();
  const MAX_DAYS = 14;
  const shown = allKeys.slice(-MAX_DAYS);
  const diary = {
    days: shown.map(k => ({ date: fmtKey(k), lines: dayMap.get(k)!.sort((a, b) => a.at - b.at).map(x => x.text) })),
    truncatedFrom: allKeys.length > MAX_DAYS ? fmtKey(shown[0]) : null,
  };

  return {
    title: "Food, symptom and health log",
    name: i.name,
    periodLabel: `${fmtDate(i.from, tz)} to ${fmtDate(i.to, tz)} (${periodDays} days)`,
    generatedLabel: fmtDate(i.generatedAt, tz),
    overview: { periodDays, daysLogged: loggedDays.size, meals: meals.length, symptomEntries: symptoms.length },
    symptoms: symptomRows, positives, triggers, triggerLookbackDays: i.triggerLookbackDays, reintro,
    body: { weight, waist }, nutrition, strength, labs, protocol, diary,
  };
}

function isPositive(t: string) {
  return ["energy_boost", "better_digestion", "improved_mood", "better_sleep", "clearer_skin", "reduced_brain_fog"].includes(t);
}

function foodsText(foods: MealFood[]): string {
  return foods.map(f => (f.hiddenIngredients?.length ? `${f.name} (flagged: ${f.hiddenIngredients.join(", ")})` : f.name)).join("; ") || "no foods listed";
}

function confirmationNote(c: Confirmation): string {
  if (c.state === "confirmed") return `Matches the patient's ${c.label} reintroduction test: reacted`;
  if (c.state === "tolerated") return `Patient completed a ${c.label} reintroduction test and tolerated it`;
  return `${c.label} reintroduction test was inconclusive; retest suggested by the app`;
}
