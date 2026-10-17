import { describe, it, expect } from "vitest";
import { dueMealReminders, dueCheckin, localParts, normalizeTimes, isValidTimeZone, inQuietHours } from "../shared/reminders";

const LA = "America/Los_Angeles";
// 2026-10-17 is during daylight time in LA (UTC-7).
const la = (hhmm: string, date = "2026-10-17") => Date.parse(`${date}T${hhmm}:00-07:00`);
const H = 3600_000;

describe("time helpers", () => {
  it("reads local time in the user's zone", () => {
    expect(localParts(la("12:34"), LA)).toEqual({ date: "2026-10-17", minutes: 12 * 60 + 34 });
    expect(localParts(Date.parse("2026-10-18T03:00:00Z"), LA)).toEqual({ date: "2026-10-17", minutes: 20 * 60 });
  });
  it("normalizes time lists and checks zones", () => {
    expect(normalizeTimes(["12:30", "8:00", "08:00", "25:00", "08:00", "18:30", "bad", 5])).toEqual(["08:00", "12:30", "18:30"]);
    expect(normalizeTimes(["01:00", "02:00", "03:00", "04:00", "05:00", "06:00"])).toHaveLength(5);
    expect(isValidTimeZone("America/Los_Angeles")).toBe(true);
    expect(isValidTimeZone("Mars/Base")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
  it("quiet hours are 10pm to 7am", () => {
    expect(inQuietHours(22 * 60)).toBe(true);
    expect(inQuietHours(6 * 60 + 59)).toBe(true);
    expect(inQuietHours(7 * 60)).toBe(false);
    expect(inQuietHours(21 * 60 + 59)).toBe(false);
  });
});

describe("meal reminders", () => {
  const times = ["08:00", "12:30", "18:30"];
  it("fires in the 10 minutes after a chosen time, with a key unique to that day and time", () => {
    expect(dueMealReminders(la("12:30"), LA, times, null)).toEqual([{ key: "meal:2026-10-17:12:30", time: "12:30" }]);
    expect(dueMealReminders(la("12:39"), LA, times, null)).toHaveLength(1);
    expect(dueMealReminders(la("12:40"), LA, times, null)).toHaveLength(0); // too late: skipped, never sent stale
    expect(dueMealReminders(la("12:29"), LA, times, null)).toHaveLength(0);
    expect(dueMealReminders(la("12:30", "2026-10-18"), LA, times, null)[0].key).toBe("meal:2026-10-18:12:30");
  });
  it("skips when a meal was logged in the last 90 minutes", () => {
    expect(dueMealReminders(la("12:30"), LA, times, la("11:30"))).toHaveLength(0);
    expect(dueMealReminders(la("12:30"), LA, times, la("10:59"))).toHaveLength(1);
    expect(dueMealReminders(la("12:30"), LA, times, la("12:30") + H)).toHaveLength(1); // a future-dated meal doesn't block
  });
  it("follows the user's time zone, not the server's", () => {
    // 12:30 in New York is 09:30 in LA.
    expect(dueMealReminders(Date.parse("2026-10-17T12:30:00-04:00"), "America/New_York", times, null)).toHaveLength(1);
    expect(dueMealReminders(Date.parse("2026-10-17T12:30:00-04:00"), LA, times, null)).toHaveLength(0);
  });
});

describe("symptom check-ins", () => {
  const meal = (id: number, at: number, level: string) => ({ id, loggedAt: at, foods: [{ fodmap: "low" }, { fodmap: level }] });
  it("asks 2 to 4 hours after a moderate or high meal", () => {
    const now = la("15:00");
    expect(dueCheckin(now, LA, [meal(1, now - 3 * H, "high")], null, null)).toEqual({ key: "check:1", mealId: 1 });
    expect(dueCheckin(now, LA, [meal(1, now - 2 * H, "moderate")], null, null)?.mealId).toBe(1);
    expect(dueCheckin(now, LA, [meal(1, now - 119 * 60_000, "high")], null, null)).toBeNull(); // too soon
    expect(dueCheckin(now, LA, [meal(1, now - 4 * H, "high")], null, null)).toBeNull(); // window over
  });
  it("never asks about low meals, and not when something was logged since", () => {
    const now = la("15:00");
    expect(dueCheckin(now, LA, [{ id: 1, loggedAt: now - 3 * H, foods: [{ fodmap: "low" }] }], null, null)).toBeNull();
    expect(dueCheckin(now, LA, [meal(1, now - 3 * H, "high")], now - 1 * H, null)).toBeNull();
    expect(dueCheckin(now, LA, [meal(1, now - 3 * H, "high")], now - 5 * H, null)?.mealId).toBe(1); // symptom was before the meal
  });
  it("sends at most one every 2 hours and picks the newest meal", () => {
    const now = la("15:00");
    const meals = [meal(1, now - 3.5 * H, "high"), meal(2, now - 2.5 * H, "moderate")];
    expect(dueCheckin(now, LA, meals, null, null)?.mealId).toBe(2);
    expect(dueCheckin(now, LA, meals, null, now - 1 * H)).toBeNull();
    expect(dueCheckin(now, LA, meals, null, now - 2 * H)?.mealId).toBe(2);
  });
  it("stays quiet overnight", () => {
    const now = la("23:30");
    expect(dueCheckin(now, LA, [meal(1, now - 3 * H, "high")], null, null)).toBeNull();
    const early = la("06:30", "2026-10-18");
    expect(dueCheckin(early, LA, [meal(1, early - 3 * H, "high")], null, null)).toBeNull();
  });
});
