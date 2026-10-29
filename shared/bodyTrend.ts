// Weight trend, rate of change and "what else moved" helpers. Pure: the page feeds in what it loaded.
//
// Honesty rules baked in here:
//  - A rate needs enough weigh-ins over enough days, otherwise we say "not enough data" instead of a number.
//  - Rates use a median-of-slopes fit, so one salty-dinner weigh-in can't swing the headline.
//  - Anything about a dose is timing only. When several changes cluster together we say they can't be separated.

import { DAY_MS } from "./dose";

export interface WeighIn { date: string; lb: number }

export const dayNum = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
const median = (xs: number[]) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Exponentially smoothed weight ("trend weight"). Each day pulls the trend ~20% toward the scale,
 * and a gap of g days pulls 1 - 0.8^g, so missing days neither freeze nor jolt the line.
 */
export function trendSeries(points: WeighIn[]): Array<WeighIn & { trend: number }> {
  const out: Array<WeighIn & { trend: number }> = [];
  let trend = 0, prev = 0;
  points.forEach((p, i) => {
    const d = dayNum(p.date);
    if (i === 0) trend = p.lb;
    else trend = trend + (1 - Math.pow(0.8, Math.max(1, d - prev))) * (p.lb - trend);
    prev = d;
    out.push({ ...p, trend: round1(trend) });
  });
  return out;
}

/** Median of all pairwise slopes (Theil-Sen): ignores a stray outlier. Slope is in y units per x unit. */
export function theilSen(xs: number[], ys: number[]): number | null {
  const slopes: number[] = [];
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      if (xs[j] !== xs[i]) slopes.push((ys[j] - ys[i]) / (xs[j] - xs[i]));
    }
  }
  return slopes.length ? median(slopes) : null;
}

export interface Rate {
  /** Pounds per week; negative is loss. */
  lbPerWeek: number;
  /** Percent of body weight per week. */
  pctPerWeek: number;
  /** Weigh-ins used and the days they span. */
  n: number;
  spanDays: number;
}

/**
 * Rate of change over weigh-ins dated from..to (inclusive). Returns null unless there are at least
 * `minPoints` weigh-ins spanning at least `minSpan` days.
 */
export function rateBetween(points: WeighIn[], from: string, to: string, minPoints = 4, minSpan = 7): Rate | null {
  const f = dayNum(from), t = dayNum(to);
  const pts = points.filter(p => dayNum(p.date) >= f && dayNum(p.date) <= t);
  if (pts.length < minPoints) return null;
  const xs = pts.map(p => dayNum(p.date));
  const spanDays = xs[xs.length - 1] - xs[0];
  if (spanDays < minSpan) return null;
  const slope = theilSen(xs, pts.map(p => p.lb));
  if (slope === null) return null;
  const base = median(pts.map(p => p.lb));
  return { lbPerWeek: round2(slope * 7), pctPerWeek: round2(((slope * 7) / base) * 100), n: pts.length, spanDays };
}

/** Rate over the `windowDays` ending at the latest weigh-in. */
export function recentRate(points: WeighIn[], windowDays = 14): Rate | null {
  if (points.length === 0) return null;
  const last = points[points.length - 1].date;
  return rateBetween(points, addDays(last, -(windowDays - 1)), last);
}

export interface GoalEta {
  state: "reached" | "projected" | "away" | "unknown";
  remainingLb: number;
  /** Earliest and latest projected dates, from the fastest and slowest of the recent rates that point toward the goal. */
  from?: string;
  to?: string;
}

/** When the goal is reached if the recent pace holds. Uses every rate given that points the right way. */
export function goalEta(currentLb: number, goalLb: number, rates: Array<Rate | null>, today: string): GoalEta {
  const remaining = round1(goalLb - currentLb);
  if (Math.abs(remaining) < 0.5) return { state: "reached", remainingLb: 0 };
  const usable = rates.filter((r): r is Rate => !!r && Math.sign(r.lbPerWeek) === Math.sign(remaining) && Math.abs(r.lbPerWeek) >= 0.1);
  if (usable.length === 0) return { state: rates.some(Boolean) ? "away" : "unknown", remainingLb: remaining };
  const weeks = usable.map(r => Math.abs(remaining) / Math.abs(r.lbPerWeek));
  const soon = Math.min(...weeks), late = Math.max(...weeks);
  if (soon > 104) return { state: "away", remainingLb: remaining };
  return {
    state: "projected", remainingLb: remaining,
    from: addDays(today, Math.round(soon * 7)), to: addDays(today, Math.round(Math.min(late, 104) * 7)),
  };
}

// ── Fat or muscle? ─────────────────────────────────────────────────────────

export type SignalState = "good" | "neutral" | "watch" | "unknown";
export interface Signal { key: "pace" | "strength" | "waist" | "protein"; label: string; state: SignalState; detail: string }

export interface LiftSeries { exercise: string; series: Array<{ date: string; e1rm: number }> }

export function retentionCheck(p: {
  weighIns: WeighIn[];
  waists: Array<{ date: string; inches: number }>;
  lifts: LiftSeries[];
  proteinAvgG: number | null;
  proteinTargetG: number;
  today: string;
  windowDays?: number;
}): { signals: Signal[]; verdict: "unknown" | "watch" | "good" | "neutral"; headline: string } {
  const win = p.windowDays ?? 28;
  const from = addDays(p.today, -(win - 1));
  const rate = recentRate(p.weighIns, 14);
  const losing = !!rate && rate.pctPerWeek <= -0.25;
  const signals: Signal[] = [];

  // Pace
  if (!rate) {
    signals.push({ key: "pace", label: "Pace", state: "unknown", detail: "Needs 4 or more weigh-ins spread over a week." });
  } else if (rate.pctPerWeek <= -1) {
    signals.push({ key: "pace", label: "Pace", state: "watch", detail: `Down ${Math.abs(rate.lbPerWeek)} lb a week (${Math.abs(rate.pctPerWeek)}%). Faster than about 1% a week makes losing muscle more likely.` });
  } else if (losing) {
    signals.push({ key: "pace", label: "Pace", state: "good", detail: `Down ${Math.abs(rate.lbPerWeek)} lb a week (${Math.abs(rate.pctPerWeek)}%). A steady pace.` });
  } else {
    signals.push({ key: "pace", label: "Pace", state: "neutral", detail: rate.pctPerWeek >= 0.25 ? `Up ${rate.lbPerWeek} lb a week.` : "Holding steady." });
  }

  // Strength: change in best estimated one-rep max, first to last session in the window
  const lifts = p.lifts
    .map(l => {
      const s = l.series.filter(x => x.date >= from && x.date <= p.today).sort((a, b) => a.date.localeCompare(b.date));
      if (s.length < 2 || dayNum(s[s.length - 1].date) - dayNum(s[0].date) < 7 || s[0].e1rm <= 0) return null;
      return { name: l.exercise, pct: round1(((s[s.length - 1].e1rm - s[0].e1rm) / s[0].e1rm) * 100) };
    })
    .filter((x): x is { name: string; pct: number } => !!x);
  if (lifts.length === 0) {
    signals.push({ key: "strength", label: "Strength", state: "unknown", detail: "Log the same lift on two days a week or more apart to track it." });
  } else {
    // One lift sliding is worth flagging even if the others are up, so judge the worst lift as well as the typical one.
    const m = median(lifts.map(l => l.pct));
    const worst = Math.min(...lifts.map(l => l.pct));
    const list = lifts.slice(0, 3).map(l => `${l.name} ${l.pct > 0 ? "+" : ""}${l.pct}%`).join(", ");
    const state: SignalState = worst <= -5 || m < -5 ? "watch" : m < -2 ? "neutral" : worst <= -2 ? "neutral" : "good";
    const word = state === "good" ? "Holding or up" : state === "watch" ? "Down" : "Mixed";
    signals.push({ key: "strength", label: "Strength", state, detail: `${word}: ${list}.` });
  }

  // Waist
  const w = p.waists.filter(x => x.date >= from && x.date <= p.today).sort((a, b) => a.date.localeCompare(b.date));
  if (w.length < 2 || dayNum(w[w.length - 1].date) - dayNum(w[0].date) < 7) {
    signals.push({ key: "waist", label: "Waist", state: "unknown", detail: "Measure at the navel once a week to see this." });
  } else {
    const ch = round1(w[w.length - 1].inches - w[0].inches);
    const weighed = p.weighIns.filter(x => x.date >= from);
    const lbLost = weighed.length >= 2 ? weighed[0].lb - weighed[weighed.length - 1].lb : 0;
    if (ch <= -0.25) signals.push({ key: "waist", label: "Waist", state: "good", detail: `Down ${Math.abs(ch)} in.` });
    else if (losing && lbLost >= 2) signals.push({ key: "waist", label: "Waist", state: "watch", detail: `Weight is down but the waist is ${ch > 0 ? `up ${ch}` : "unchanged"} in. That can be muscle or water loss, or just measuring noise.` });
    else signals.push({ key: "waist", label: "Waist", state: "neutral", detail: ch === 0 ? "Unchanged." : `${ch > 0 ? "Up" : "Down"} ${Math.abs(ch)} in.` });
  }

  // Protein
  if (p.proteinAvgG === null || p.proteinTargetG <= 0) {
    signals.push({ key: "protein", label: "Protein", state: "unknown", detail: "Log meals or quick-add protein to see your average." });
  } else {
    const frac = p.proteinAvgG / p.proteinTargetG;
    const pct = Math.round(frac * 100);
    signals.push({
      key: "protein", label: "Protein",
      state: frac >= 0.9 ? "good" : frac >= 0.7 || !losing ? "neutral" : "watch",
      detail: `Averaging ${Math.round(p.proteinAvgG)} g a day, ${pct}% of your ${p.proteinTargetG} g target.`,
    });
  }

  const known = signals.filter(s => s.state !== "unknown");
  const watch = signals.filter(s => s.state === "watch");
  const good = signals.filter(s => s.state === "good");
  if (known.length < 2) return { signals, verdict: "unknown", headline: "Not enough data yet to say." };
  if (watch.length > 0) return { signals, verdict: "watch", headline: `Worth a look: ${watch.map(s => s.label.toLowerCase()).join(" and ")}.` };
  const strength = signals.find(s => s.key === "strength");
  if (strength?.state === "neutral" && strength.detail.startsWith("Mixed")) return { signals, verdict: "neutral", headline: "Mostly on track, but strength is mixed." };
  if (losing && good.length >= 2) return { signals, verdict: "good", headline: "Signals point to losing weight while keeping muscle." };
  return { signals, verdict: "neutral", headline: "Nothing concerning in the numbers you've logged." };
}

// ── Around protocol changes (timing, not cause) ────────────────────────────

export interface ChangeMarker { date: string; compound: string; kind: "start" | "change"; doseMcg: number }
export interface Side { rate: Rate | null; proteinAvgG: number | null; weighIns: number }
export interface ChangeWindow {
  start: string;
  end: string;
  items: Array<{ compound: string; kind: "start" | "change"; doseMcg: number; date: string }>;
  /** More than one change close together, so nothing here can be tied to a single one. */
  tangled: boolean;
  before: Side;
  after: Side;
  status: "ok" | "too_recent" | "not_enough_weights";
}

/**
 * Groups changes that happen within `gapDays` of each other into one window, then compares the weigh-in
 * pace and protein before and after it. This is descriptive: weight also moves with food, water, sleep,
 * training and illness, so it cannot show that a change caused anything.
 */
export function aroundChanges(p: {
  markers: ChangeMarker[];
  weighIns: WeighIn[];
  days: Array<{ date: string; proteinG: number }>;
  today: string;
  windowDays?: number;
  gapDays?: number;
}): ChangeWindow[] {
  const win = p.windowDays ?? 14, gap = p.gapDays ?? 7;
  const sorted = [...p.markers].sort((a, b) => a.date.localeCompare(b.date));
  const groups: ChangeMarker[][] = [];
  for (const m of sorted) {
    const g = groups[groups.length - 1];
    if (g && dayNum(m.date) - dayNum(g[g.length - 1].date) <= gap) g.push(m);
    else groups.push([m]);
  }
  const proteinAvg = (from: string, to: string) => {
    const v = p.days.filter(d => d.date >= from && d.date <= to && d.proteinG > 0).map(d => d.proteinG);
    return v.length >= 3 ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
  };
  const count = (from: string, to: string) => p.weighIns.filter(w => w.date >= from && w.date <= to).length;

  return groups.map(g => {
    const start = g[0].date, end = g[g.length - 1].date;
    const bFrom = addDays(start, -win), bTo = addDays(start, -1);
    const aFrom = addDays(end, 1), aTo = p.today < addDays(end, win) ? p.today : addDays(end, win);
    const before: Side = { rate: rateBetween(p.weighIns, bFrom, bTo, 3, 5), proteinAvgG: proteinAvg(bFrom, bTo), weighIns: count(bFrom, bTo) };
    const after: Side = { rate: rateBetween(p.weighIns, aFrom, aTo, 3, 5), proteinAvgG: proteinAvg(aFrom, aTo), weighIns: count(aFrom, aTo) };
    const tooRecent = dayNum(p.today) - dayNum(end) < 7;
    return {
      start, end,
      items: g.map(m => ({ compound: m.compound, kind: m.kind, doseMcg: m.doseMcg, date: m.date })),
      tangled: new Set(g.map(m => m.compound.toLowerCase())).size > 1 || g.length > 1,
      before, after,
      status: tooRecent ? "too_recent" : before.rate && after.rate ? "ok" : "not_enough_weights",
    } satisfies ChangeWindow;
  });
}
