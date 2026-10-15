// Dose log helpers: formatting, injection-site rotation, schedule status and side effects by day since a dose.
// Pure and client/server safe. This only records and summarises what the user logged; it gives no dosing advice.

export const DAY_MS = 86_400_000;

export const SITES = ["abdomen_left", "abdomen_right", "thigh_left", "thigh_right", "arm_left", "arm_right"] as const;
export type Site = (typeof SITES)[number];
export const SITE_LABEL: Record<Site, string> = {
  abdomen_left: "Abdomen L", abdomen_right: "Abdomen R",
  thigh_left: "Thigh L", thigh_right: "Thigh R",
  arm_left: "Arm L", arm_right: "Arm R",
};

/** Quick-pick names (labels only; any other name can be typed). */
export const COMPOUND_PRESETS = [
  "Retatrutide", "BPC-157", "TB-500", "Ipamorelin", "CJC-1295", "GHK-Cu", "MOTS-c", "Tesamorelin",
] as const;

export interface DoseRow { id: number; compound: string; doseMcg: number; site: string | null; loggedAt: number }
export interface SymptomRow { type: string; severity: number; loggedAt: number }

/** 1000 -> "1 mg", 2500 -> "2.5 mg", 250 -> "250 mcg" */
export const fmtMg = (mcg: number) => (mcg < 1000 ? `${mcg} mcg` : `${Number((mcg / 1000).toFixed(3))} mg`);
export const mgToMcg = (mg: number) => Math.round(mg * 1000);

/** Next site in the rotation after the last used one (first site when none). */
export function nextSite(last: string | null | undefined): Site {
  const i = SITES.indexOf(last as Site);
  return SITES[(i + 1) % SITES.length];
}

export type DoseState = "none" | "upcoming" | "due" | "overdue";

export function doseStatus(doses: DoseRow[], intervalDays: number, now: number = Date.now()) {
  if (doses.length === 0) return { state: "none" as DoseState, latest: null, dayNumber: 0, nextDueAt: null, daysUntil: 0 };
  const sorted = [...doses].sort((a, b) => b.loggedAt - a.loggedAt);
  const latest = sorted[0];
  const sameCompound = sorted.filter(d => d.compound.toLowerCase() === latest.compound.toLowerCase());
  const first = sameCompound[sameCompound.length - 1];
  const nextDueAt = latest.loggedAt + intervalDays * DAY_MS;
  const daysUntil = Math.round((nextDueAt - now) / DAY_MS);
  const state: DoseState = now < nextDueAt - DAY_MS / 2 ? "upcoming" : now <= nextDueAt + DAY_MS / 2 ? "due" : "overdue";
  return {
    state, latest, nextDueAt, daysUntil,
    dayNumber: Math.floor((now - first.loggedAt) / DAY_MS) + 1,
  };
}

/** The most recent dose at or before `at`, if within `maxDays`, and how many whole days after it. */
export function dayAfterDose(doses: DoseRow[], at: number, maxDays = 7): { dose: DoseRow; day: number } | null {
  let best: DoseRow | null = null;
  for (const d of doses) if (d.loggedAt <= at && (!best || d.loggedAt > best.loggedAt)) best = d;
  if (!best) return null;
  const day = Math.floor((at - best.loggedAt) / DAY_MS);
  return day < maxDays ? { dose: best, day } : null;
}

const NEGATIVE = new Set([
  "bloating", "abdominal_pain", "gas", "nausea", "fatigue", "headache", "diarrhea", "constipation",
  "acid_reflux", "vomiting", "low_appetite", "injection_site_reaction", "dizziness", "racing_heart",
]);

/** Counts by day after the preceding dose (0 = first 24 h). Negative symptoms only. */
export function sideEffectsByDay(doses: DoseRow[], symptoms: SymptomRow[], days = 7) {
  const perDay = Array.from({ length: days }, (_, day) => ({ day, count: 0, severitySum: 0 }));
  const perType = new Map<string, { n: number; sev: number; byDay: number[] }>();
  for (const s of symptoms) {
    if (!NEGATIVE.has(s.type)) continue;
    const hit = dayAfterDose(doses, s.loggedAt, days);
    if (!hit) continue;
    perDay[hit.day].count++;
    perDay[hit.day].severitySum += s.severity;
    const t = perType.get(s.type) ?? { n: 0, sev: 0, byDay: Array(days).fill(0) };
    t.n++; t.sev += s.severity; t.byDay[hit.day]++;
    perType.set(s.type, t);
  }
  const chart = perDay.map(d => ({ day: d.day, count: d.count, avgSeverity: d.count ? Math.round((d.severitySum / d.count) * 10) / 10 : 0 }));
  const peaks = Array.from(perType.entries())
    .map(([type, t]) => ({ type, n: t.n, avgSeverity: Math.round((t.sev / t.n) * 10) / 10, peakDay: t.byDay.indexOf(Math.max(...t.byDay)) }))
    .filter(p => p.n >= 3)
    .sort((a, b) => b.n - a.n);
  return { chart, peaks, total: chart.reduce((a, d) => a + d.count, 0) };
}
