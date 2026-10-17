import { describe, it, expect, vi, beforeEach } from "vitest";

const H = 3600_000;
const state = {
  users: [] as any[], lastMeal: null as number | null, lastSymptom: null as number | null, lastCheckin: null as number | null,
  meals: [] as any[], subs: [{ endpoint: "https://push.example/1", p256dh: "k", auth: "a" }] as any[], claimed: new Set<string>(), deleted: [] as string[],
};
vi.mock("./db", () => ({
  listUsersWithReminders: async () => state.users,
  getLastMealAt: async () => state.lastMeal,
  getLastSymptomAt: async () => state.lastSymptom,
  lastNotificationAt: async () => state.lastCheckin,
  getMealsInRange: async () => state.meals,
  getSubscriptions: async () => state.subs,
  deleteSubscription: async (e: string) => { state.deleted.push(e); },
  claimNotification: async (u: number, k: string) => { const id = `${u}:${k}`; if (state.claimed.has(id)) return false; state.claimed.add(id); return true; },
}));

import { runReminderTick } from "./reminders";

const LA = "America/Los_Angeles";
const at = (hhmm: string) => Date.parse(`2026-10-17T${hhmm}:00-07:00`);
const user = (over: any = {}) => ({ userId: 1, mealReminders: true, mealTimes: ["12:30"], symptomCheckins: true, timeZone: LA, ...over });

describe("runReminderTick", () => {
  beforeEach(() => { Object.assign(state, { users: [user()], lastMeal: null, lastSymptom: null, lastCheckin: null, meals: [], claimed: new Set(), deleted: [], subs: [{ endpoint: "https://push.example/1", p256dh: "k", auth: "a" }] }); });

  it("sends a meal reminder once, even if the tick runs twice in the window", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    expect(await runReminderTick(at("12:30"), send)).toBe(1);
    expect(await runReminderTick(at("12:31"), send)).toBe(0);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][1]).toMatchObject({ url: "/log?tab=food", tag: "meal-reminder" });
  });

  it("sends nothing outside the window or when a meal was just logged", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    expect(await runReminderTick(at("12:45"), send)).toBe(0);
    state.lastMeal = at("12:00");
    expect(await runReminderTick(at("12:30"), send)).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("sends a check-in 2-4 hours after a moderate or high meal, without naming the food", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const now = at("15:00");
    state.meals = [{ id: 7, loggedAt: now - 3 * H, foods: [{ name: "Garlic bread", fodmap: "high" }] }];
    expect(await runReminderTick(now, send)).toBe(1);
    const payload = send.mock.calls[0][1];
    expect(payload).toMatchObject({ url: "/log?tab=symptoms", tag: "symptom-checkin" });
    expect(JSON.stringify(payload).toLowerCase()).not.toContain("garlic");
    expect(await runReminderTick(now + 60_000, send)).toBe(0); // same meal never asked twice
  });

  it("respects each switch", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    state.users = [user({ mealReminders: false, symptomCheckins: false })];
    expect(await runReminderTick(at("12:30"), send)).toBe(0);
    state.users = [user({ symptomCheckins: false })];
    state.meals = [{ id: 1, loggedAt: at("12:30") - 3 * H, foods: [{ fodmap: "high" }] }];
    expect(await runReminderTick(at("12:30"), send)).toBe(1); // only the meal reminder
  });

  it("removes a device the push service says is gone, and keeps going after other failures", async () => {
    state.subs = [{ endpoint: "https://push.example/gone", p256dh: "k", auth: "a" }, { endpoint: "https://push.example/flaky", p256dh: "k", auth: "a" }, { endpoint: "https://push.example/ok", p256dh: "k", auth: "a" }];
    const send = vi.fn(async (s: any) => {
      if (s.endpoint.endsWith("gone")) throw Object.assign(new Error("gone"), { statusCode: 410 });
      if (s.endpoint.endsWith("flaky")) throw Object.assign(new Error("boom"), { statusCode: 500 });
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await runReminderTick(at("12:30"), send as any)).toBe(1);
    expect(state.deleted).toEqual(["https://push.example/gone"]);
  });

  it("uses each user's own time zone", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    state.users = [user({ timeZone: "America/New_York", symptomCheckins: false })];
    expect(await runReminderTick(at("12:30"), send)).toBe(0); // 12:30 in LA is 15:30 in New York
    expect(await runReminderTick(Date.parse("2026-10-17T12:30:00-04:00"), send)).toBe(1);
  });
});
