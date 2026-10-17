// When a reminder is due. Pure functions so the rules are easy to test.
// Everything is evaluated in the user's own time zone.

export const DEFAULT_MEAL_TIMES = ["08:00", "12:30", "18:30"];
export const MAX_MEAL_TIMES = 5;

/** A meal reminder is sent in the 10 minutes after its time; later than that it is skipped, never sent stale. */
export const MEAL_WINDOW_MIN = 10;
/** No meal reminder if a meal was logged in the hour and a half before it. */
export const MEAL_RECENT_MIN = 90;
/** Symptom check-ins go out 2 to 4 hours after a moderate or high meal. */
export const CHECKIN_AFTER_MIN = 120;
export const CHECKIN_UNTIL_MIN = 240;
/** At most one check-in every 2 hours, whatever the number of meals. */
export const CHECKIN_GAP_MIN = 120;
/** Check-ins are held back overnight, 10pm to 7am local time. */
export const QUIET_START_MIN = 22 * 60;
export const QUIET_END_MIN = 7 * 60;

const MIN = 60_000;

export function isValidTime(s: unknown): s is string {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Keep valid HH:MM values, drop duplicates, sort, and cap the count. */
export function normalizeTimes(times: unknown[]): string[] {
  return Array.from(new Set(times.filter(isValidTime))).sort().slice(0, MAX_MEAL_TIMES);
}

export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}

/** The local calendar date (YYYY-MM-DD) and minutes since local midnight for a moment in a time zone. */
export function localParts(ms: number, tz: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

export function inQuietHours(minutes: number): boolean {
  return minutes >= QUIET_START_MIN || minutes < QUIET_END_MIN;
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Meal reminders due right now. `key` is unique per day and time so the same one is never sent twice. */
export function dueMealReminders(nowMs: number, tz: string, times: string[], lastMealAtMs: number | null): { key: string; time: string }[] {
  const { date, minutes } = localParts(nowMs, tz);
  if (lastMealAtMs !== null && lastMealAtMs <= nowMs && nowMs - lastMealAtMs < MEAL_RECENT_MIN * MIN) return [];
  return normalizeTimes(times)
    .filter(t => { const at = toMinutes(t); return minutes >= at && minutes < at + MEAL_WINDOW_MIN; })
    .map(time => ({ key: `meal:${date}:${time}`, time }));
}

export interface CheckinMeal { id: number; loggedAt: number; foods: { fodmap: string }[] }

/** The meal (if any) to ask about right now: moderate or high, 2 to 4 hours ago, with nothing logged since. */
export function dueCheckin(
  nowMs: number, tz: string, recentMeals: CheckinMeal[], lastSymptomAtMs: number | null, lastCheckinSentAtMs: number | null,
): { key: string; mealId: number } | null {
  if (inQuietHours(localParts(nowMs, tz).minutes)) return null;
  if (lastCheckinSentAtMs !== null && nowMs - lastCheckinSentAtMs < CHECKIN_GAP_MIN * MIN) return null;
  const eligible = recentMeals
    .filter(m => {
      const age = nowMs - m.loggedAt;
      if (age < CHECKIN_AFTER_MIN * MIN || age >= CHECKIN_UNTIL_MIN * MIN) return false;
      if (!m.foods.some(f => f.fodmap === "moderate" || f.fodmap === "high")) return false;
      return lastSymptomAtMs === null || lastSymptomAtMs < m.loggedAt; // anything logged since the meal counts as checked in
    })
    .sort((a, b) => b.loggedAt - a.loggedAt);
  return eligible.length ? { key: `check:${eligible[0].id}`, mealId: eligible[0].id } : null;
}
