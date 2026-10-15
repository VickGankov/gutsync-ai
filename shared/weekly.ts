// Weekly progress summary and weight-trend helpers. Pure: the page feeds in what it already loaded.

import { compoundKey, DAY_MS, NEGATIVE_SYMPTOMS, type DoseRow, type Interval, type SymptomRow } from "./dose";

export interface DayPoint { date: string; weightLb: number | null; proteinG: number }

/** Local calendar date (YYYY-MM-DD) for a timestamp, given the client's getTimezoneOffset(). */
export const dateKeyOf = (ts: number, tzOffsetMinutes: number) =>
  new Date(ts - tzOffsetMinutes * 60_000).toISOString().slice(0, 10);

/** Timestamp of local midnight at the start of a local date key. */
export const startOfLocalDay = (dateKey: string, tzOffsetMinutes: number) =>
  Date.parse(`${dateKey}T00:00:00Z`) + tzOffsetMinutes * 60_000;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Daily weight is noisy. For each day with a weigh-in, `avg` is the mean of the weigh-ins in the
 * 7 days ending that day.
 */
export function weightTrend(days: Array<{ date: string; weightLb: number | null }>, window = 7) {
  return days.map((d, i) => {
    const slice = days.slice(Math.max(0, i - window + 1), i + 1).map(x => x.weightLb).filter((w): w is number => w !== null);
    return {
      date: d.date,
      weightLb: d.weightLb,
      avg: d.weightLb !== null && slice.length ? round1(slice.reduce((a, b) => a + b, 0) / slice.length) : null,
    };
  });
}

export interface DoseMarker { date: string; compound: string; kind: "start" | "change"; doseMcg: number }

/** First dose of each compound, and any later dose whose amount differs from the one before it. */
export function doseMarkers(doses: DoseRow[], tzOffsetMinutes: number): DoseMarker[] {
  const byKey = new Map<string, DoseRow[]>();
  for (const d of doses) {
    const k = compoundKey(d.compound);
    byKey.set(k, [...(byKey.get(k) ?? []), d]);
  }
  const out: DoseMarker[] = [];
  byKey.forEach(list => {
    const sorted = [...list].sort((a, b) => a.loggedAt - b.loggedAt);
    sorted.forEach((d, i) => {
      const kind = i === 0 ? "start" : d.doseMcg !== sorted[i - 1].doseMcg ? "change" : null;
      if (kind) out.push({ date: dateKeyOf(d.loggedAt, tzOffsetMinutes), compound: d.compound, kind, doseMcg: d.doseMcg });
    });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export interface WeeklySummary {
  weight: { thisAvg: number | null; prevAvg: number | null; delta: number | null; weighIns: number };
  protein: { avg: number | null; daysLogged: number; daysOnTarget: number; target: number };
  doses: { taken: number; expected: number; byCompound: Array<{ name: string; taken: number; expected: number }> };
  sideEffects: { count: number; worst: { type: string; severity: number } | null };
}

const avgOf = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** `days` are consecutive local days, oldest first, ending today. The week is the last 7 of them. */
export function weeklySummary(params: {
  days: DayPoint[];
  doses: DoseRow[];
  intervals: Map<string, Interval>;
  symptoms: SymptomRow[];
  proteinTarget: number;
  tzOffsetMinutes: number;
  now: number;
}): WeeklySummary {
  const { days, doses, intervals, symptoms, proteinTarget, tzOffsetMinutes, now } = params;
  const week = days.slice(-7);
  const prev = days.slice(-14, -7);

  const wThis = week.map(d => d.weightLb).filter((w): w is number => w !== null);
  const wPrev = prev.map(d => d.weightLb).filter((w): w is number => w !== null);
  const thisAvg = avgOf(wThis), prevAvg = avgOf(wPrev);

  const logged = week.filter(d => d.proteinG > 0);

  const weekStartKey = week[0]?.date ?? dateKeyOf(now, tzOffsetMinutes);
  const weekStart = startOfLocalDay(weekStartKey, tzOffsetMinutes);

  const byCompound: WeeklySummary["doses"]["byCompound"] = [];
  intervals.forEach((iv, key) => {
    const list = doses.filter(d => compoundKey(d.compound) === key);
    if (list.length === 0) return;
    const first = Math.min(...list.map(d => d.loggedAt));
    const taken = list.filter(d => d.loggedAt >= weekStart).length;
    // Started inside this week: count the doses that have come due since the first one.
    const expected = first >= weekStart
      ? Math.floor((now - first) / (iv.days * DAY_MS)) + 1
      : Math.max(1, Math.round(7 / iv.days));
    byCompound.push({ name: iv.name, taken, expected });
  });

  const recent = symptoms.filter(s => s.loggedAt >= weekStart && NEGATIVE_SYMPTOMS.has(s.type));
  const worst = recent.reduce<{ type: string; severity: number } | null>(
    (a, s) => (!a || s.severity > a.severity ? { type: s.type, severity: s.severity } : a), null);

  return {
    weight: {
      thisAvg: thisAvg === null ? null : round1(thisAvg),
      prevAvg: prevAvg === null ? null : round1(prevAvg),
      delta: thisAvg !== null && prevAvg !== null ? round1(thisAvg - prevAvg) : null,
      weighIns: wThis.length,
    },
    protein: {
      avg: logged.length ? Math.round(avgOf(logged.map(d => d.proteinG))!) : null,
      daysLogged: logged.length,
      daysOnTarget: week.filter(d => d.proteinG >= proteinTarget).length,
      target: proteinTarget,
    },
    doses: {
      taken: byCompound.reduce((a, c) => a + c.taken, 0),
      expected: byCompound.reduce((a, c) => a + c.expected, 0),
      byCompound,
    },
    sideEffects: { count: recent.length, worst },
  };
}
