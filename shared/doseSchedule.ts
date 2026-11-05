// Dose schedules that aren't "every N days": chosen weekdays (Mon-Fri) and on/off cycles (5 on, 2 off).
// Rest days never break a streak: only days the schedule says to dose can be missed.
// Pure and client/server safe. It tracks what the user planned and logged; it gives no dosing advice.

const DAY = 86_400_000;

export type Schedule =
  | { kind: "interval"; days: number }
  | { kind: "weekdays"; days: number[] } // 0 = Sunday ... 6 = Saturday
  | { kind: "cycle"; on: number; off: number; start: string }; // start = first "on" day, local YYYY-MM-DD

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

const keyRe = /^\d{4}-\d{2}-\d{2}$/;
export const dayIndex = (key: string) => Math.floor(Date.parse(`${key}T00:00:00Z`) / DAY);
export const keyFromIndex = (i: number) => new Date(i * DAY).toISOString().slice(0, 10);
export const localKey = (ms: number, tzOffsetMinutes: number) => new Date(ms - tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
const weekdayOf = (key: string) => new Date(`${key}T00:00:00Z`).getUTCDay();

/** Null when the pieces don't make a usable schedule. */
export function parseSchedule(row: { kind?: string | null; intervalDays: number; weekdays?: string | null; cycleOn?: number | null; cycleOff?: number | null; cycleStart?: string | null }): Schedule {
  if (row.kind === "weekdays" && row.weekdays) {
    const days = Array.from(new Set(row.weekdays.split(",").map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6))).sort((a, b) => a - b);
    if (days.length > 0) return { kind: "weekdays", days };
  }
  if (row.kind === "cycle" && row.cycleOn && row.cycleOn >= 1 && row.cycleOff != null && row.cycleOff >= 0 && row.cycleStart && keyRe.test(row.cycleStart)) {
    return { kind: "cycle", on: row.cycleOn, off: row.cycleOff, start: row.cycleStart };
  }
  return { kind: "interval", days: Math.max(1, row.intervalDays) };
}

/** Is this local date a scheduled dose day? (Interval schedules are anchored to the last dose, so: no.) */
export function isDoseDay(s: Schedule, key: string): boolean {
  if (s.kind === "weekdays") return s.days.includes(weekdayOf(key));
  if (s.kind === "cycle") {
    const since = dayIndex(key) - dayIndex(s.start);
    if (since < 0) return false;
    return since % (s.on + s.off) < s.on;
  }
  return false;
}

/** Smallest number of days between two scheduled doses (1 = back-to-back days). */
export function minGapDays(s: Schedule): number {
  if (s.kind === "interval") return s.days;
  if (s.kind === "weekdays") {
    if (s.days.length === 1) return 7;
    let min = 7;
    s.days.forEach((d, i) => { min = Math.min(min, (s.days[(i + 1) % s.days.length] - d + 7) % 7 || 7); });
    return min;
  }
  return s.on > 1 ? 1 : s.off + 1;
}

export function describeSchedule(s: Schedule): string {
  if (s.kind === "interval") return s.days === 1 ? "Every day" : `Every ${s.days} days`;
  if (s.kind === "cycle") return s.off === 0 ? "Every day" : `${s.on} day${s.on === 1 ? "" : "s"} on, ${s.off} off`;
  const d = s.days;
  if (d.length === 7) return "Every day";
  if (d.join() === "1,2,3,4,5") return "Weekdays (Mon to Fri)";
  if (d.join() === "0,6") return "Weekends";
  return d.map(x => WEEKDAY_SHORT[x]).join(", ");
}

/** Scheduled days from `fromKey` to `toKey`, both included. */
export function scheduledDaysBetween(s: Schedule, fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  for (let i = dayIndex(fromKey); i <= dayIndex(toKey); i++) {
    const k = keyFromIndex(i);
    if (isDoseDay(s, k)) out.push(k);
  }
  return out;
}

export type ScheduleState = "none" | "due" | "done" | "rest" | "overdue";

export interface ScheduleStatus {
  state: ScheduleState;
  /** Next local date a dose is expected: today while it is still due, otherwise the next scheduled day. */
  nextKey: string | null;
  daysUntil: number;
  /** Scheduled days in a row that were taken. Rest days are skipped, not counted and not breaking. */
  streak: number;
  /** Last 28 days (from the first logged dose): scheduled days taken vs expected. */
  taken28: number;
  expected28: number;
  /** The most recent scheduled day before today, if no dose was logged on it. */
  missedKey: string | null;
  dayNumber: number;
}

/**
 * Where the user is in a weekday or cycle schedule. Today is never "missed" until it ends:
 * a dose that is due today leaves the streak intact.
 */
export function scheduleStatus(s: Schedule, doseTimes: number[], now: number, tzOffsetMinutes: number): ScheduleStatus {
  const empty: ScheduleStatus = { state: "none", nextKey: null, daysUntil: 0, streak: 0, taken28: 0, expected28: 0, missedKey: null, dayNumber: 0 };
  if (s.kind === "interval" || doseTimes.length === 0) return empty;

  const taken = new Set(doseTimes.map(t => localKey(t, tzOffsetMinutes)));
  const firstKey = localKey(Math.min(...doseTimes), tzOffsetMinutes);
  const today = localKey(now, tzOffsetMinutes);
  const t0 = dayIndex(today), f0 = dayIndex(firstKey);
  const todayScheduled = isDoseDay(s, today);
  const takenToday = taken.has(today);

  // Scheduled days that have fully passed (or today, once taken), from the first logged dose.
  const lastCounted = todayScheduled && takenToday ? t0 : t0 - 1;
  const counted: string[] = [];
  for (let i = f0; i <= lastCounted; i++) { const k = keyFromIndex(i); if (isDoseDay(s, k)) counted.push(k); }

  let streak = 0;
  for (let i = counted.length - 1; i >= 0 && taken.has(counted[i]); i--) streak++;

  const window = counted.filter(k => dayIndex(k) > t0 - 28);
  const lastPast = [...counted].reverse().find(k => dayIndex(k) < t0) ?? null;
  const missedKey = lastPast && !taken.has(lastPast) ? lastPast : null;

  let nextKey: string | null = null;
  if (todayScheduled && !takenToday) nextKey = today;
  else for (let i = t0 + 1; i <= t0 + 400 && !nextKey; i++) { const k = keyFromIndex(i); if (isDoseDay(s, k)) nextKey = k; }

  const state: ScheduleState = todayScheduled ? (takenToday ? "done" : "due") : missedKey ? "overdue" : "rest";
  return {
    state, nextKey, daysUntil: nextKey ? dayIndex(nextKey) - t0 : 0,
    streak, taken28: window.filter(k => taken.has(k)).length, expected28: window.length, missedKey,
    dayNumber: t0 - f0 + 1,
  };
}

/** Doses expected from `startKey` through `endKey` for a weekday or cycle schedule (never before the first dose). */
export function expectedInRange(s: Schedule, startKey: string, endKey: string, firstKey?: string): number {
  const from = firstKey && firstKey > startKey ? firstKey : startKey;
  if (from > endKey) return 0;
  return scheduledDaysBetween(s, from, endKey).length;
}
