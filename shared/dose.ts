// Dose log helpers: formatting, injection-site rotation, schedule status and side effects by day since a dose.
// Pure and client/server safe. This only records and summarises what the user logged; it gives no dosing advice.

import { minGapDays, parseSchedule, type Schedule } from "./doseSchedule";

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

export const compoundKey = (name: string) => name.toLowerCase().replace(/\s+/g, " ").trim();

/** `days` is the smallest gap between doses (for weekday and cycle schedules too), `schedule` the full plan. */
export interface Interval { name: string; days: number; explicit: boolean; schedule: Schedule }

export interface ScheduleRow { compound: string; intervalDays: number; kind?: string | null; weekdays?: string | null; cycleOn?: number | null; cycleOff?: number | null; cycleStart?: string | null }

/**
 * Days between doses for each compound: the schedule the user set, otherwise the median gap
 * between their own logged doses of that compound, otherwise 7.
 */
export function intervalsByCompound(
  doses: DoseRow[],
  schedules: ScheduleRow[] = [],
): Map<string, Interval> {
  const out = new Map<string, Interval>();
  const byKey = new Map<string, DoseRow[]>();
  for (const d of doses) {
    const k = compoundKey(d.compound);
    byKey.set(k, [...(byKey.get(k) ?? []), d]);
  }
  const explicit = new Map(schedules.map(x => [compoundKey(x.compound), parseSchedule(x)]));
  byKey.forEach((list, k) => {
    const sorted = [...list].sort((a, b) => a.loggedAt - b.loggedAt);
    const name = sorted[sorted.length - 1].compound;
    if (explicit.has(k)) { const sc = explicit.get(k)!; out.set(k, { name, days: minGapDays(sc), explicit: true, schedule: sc }); return; }
    const gaps = sorted.slice(1).map((d, i) => (d.loggedAt - sorted[i].loggedAt) / DAY_MS).sort((a, b) => a - b);
    const median = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 7;
    const days = Math.max(1, Math.round(median));
    out.set(k, { name, days, explicit: false, schedule: { kind: "interval", days } });
  });
  return out;
}

/** One status per compound, most recently dosed first. */
export function statusByCompound(
  doses: DoseRow[],
  intervals: Map<string, Interval>,
  now: number = Date.now(),
) {
  const keys = Array.from(intervals.keys());
  return keys
    .map(k => {
      const list = doses.filter(d => compoundKey(d.compound) === k);
      const iv = intervals.get(k)!;
      return { key: k, name: iv.name, interval: iv, ...doseStatus(list, iv.days, now) };
    })
    .sort((a, b) => (b.latest?.loggedAt ?? 0) - (a.latest?.loggedAt ?? 0));
}

/** Compounds taken less often than daily, so "day N after a dose" means something. */
export const isSpaced = (iv: Interval | undefined) => !!iv && iv.days >= 2;

/** For one symptom time: the latest dose of each spaced compound that is within `maxDays`. */
export function dosesBefore(doses: DoseRow[], intervals: Map<string, Interval>, at: number, maxDays = 7) {
  const out: Array<{ dose: DoseRow; day: number }> = [];
  intervals.forEach((iv, k) => {
    if (!isSpaced(iv)) return;
    const hit = dayAfterDose(doses.filter(d => compoundKey(d.compound) === k), at, maxDays);
    if (hit) out.push(hit);
  });
  return out.sort((a, b) => a.day - b.day);
}

/** The most recent dose at or before `at`, if within `maxDays`, and how many whole days after it. */
export function dayAfterDose(doses: DoseRow[], at: number, maxDays = 7): { dose: DoseRow; day: number } | null {
  let best: DoseRow | null = null;
  for (const d of doses) if (d.loggedAt <= at && (!best || d.loggedAt > best.loggedAt)) best = d;
  if (!best) return null;
  const day = Math.floor((at - best.loggedAt) / DAY_MS);
  return day < maxDays ? { dose: best, day } : null;
}

export const NEGATIVE_SYMPTOMS = new Set([
  "bloating", "abdominal_pain", "gas", "nausea", "fatigue", "headache", "diarrhea", "constipation",
  "acid_reflux", "vomiting", "low_appetite", "injection_site_reaction", "dizziness", "racing_heart",
  "flushing", "water_retention", "joint_pain",
]);

/** Counts by day after the preceding dose (0 = first 24 h). Negative symptoms only. */
export function sideEffectsByDay(doses: DoseRow[], symptoms: SymptomRow[], days = 7) {
  const perDay = Array.from({ length: days }, (_, day) => ({ day, count: 0, severitySum: 0 }));
  const perType = new Map<string, { n: number; sev: number; byDay: number[] }>();
  for (const s of symptoms) {
    if (!NEGATIVE_SYMPTOMS.has(s.type)) continue;
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

// ─── Injection site rotation ───

export interface SiteUse { site: Site; lastAt: number | null; daysAgo: number | null; count28: number; reactions: number }

/**
 * For each site: when it was last used, how often in the last 28 days, and how many times an
 * injection-site reaction was logged within `reactionDays` after a dose there. Counts what was
 * logged; a reaction logged near a dose does not prove the site caused it.
 */
export function siteUsage(doses: DoseRow[], symptoms: SymptomRow[] = [], now: number = Date.now(), reactionDays = 3): SiteUse[] {
  const withSite = doses.filter(d => (SITES as readonly string[]).includes(d.site ?? ""));
  const reactions = new Map<string, number>();
  for (const s of symptoms) {
    if (s.type !== "injection_site_reaction") continue;
    let hit: DoseRow | null = null;
    for (const d of withSite) if (d.loggedAt <= s.loggedAt && s.loggedAt - d.loggedAt <= reactionDays * DAY_MS && (!hit || d.loggedAt > hit.loggedAt)) hit = d;
    if (hit) reactions.set(hit.site!, (reactions.get(hit.site!) ?? 0) + 1);
  }
  return SITES.map(site => {
    const here = withSite.filter(d => d.site === site);
    const lastAt = here.length ? Math.max(...here.map(d => d.loggedAt)) : null;
    return {
      site, lastAt,
      daysAgo: lastAt === null ? null : Math.max(0, Math.floor((now - lastAt) / DAY_MS)),
      count28: here.filter(d => now - d.loggedAt <= 28 * DAY_MS).length,
      reactions: reactions.get(site) ?? 0,
    };
  });
}

/** The site rested longest (never-used first; ties keep the usual order). Skips sites with a logged reaction when another is free of one. */
export function suggestSite(usage: SiteUse[]): Site {
  const pool = usage.some(u => u.reactions === 0) ? usage.filter(u => u.reactions === 0) : usage;
  return [...pool].sort((a, b) => (a.lastAt ?? -Infinity) - (b.lastAt ?? -Infinity))[0].site;
}

/** A plain note when the chosen site was used very recently while a more rested one exists. */
export function siteReuseNote(usage: SiteUse[], chosen: Site, recentDays = 3): string | null {
  const u = usage.find(x => x.site === chosen);
  if (!u || u.daysAgo === null || u.daysAgo >= recentDays) return null;
  const rested = usage.some(x => x.site !== chosen && (x.daysAgo === null || x.daysAgo > u.daysAgo!));
  if (!rested) return null;
  const when = u.daysAgo === 0 ? "today" : u.daysAgo === 1 ? "yesterday" : `${u.daysAgo} days ago`;
  return `${SITE_LABEL[chosen]} was used ${when}. Another site has had longer to rest.`;
}
