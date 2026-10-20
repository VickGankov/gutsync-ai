// Sends meal reminders and symptom check-ins as push notifications.
// A timer checks once a minute; rules live in shared/reminders.ts. Messages stay generic: no food names on a lock screen.

import webpush from "web-push";
import * as db from "./db";
import { dueCheckin, dueMealReminders, isValidTimeZone } from "../shared/reminders";

export interface PushPayload { title: string; body: string; url: string; tag: string }
export type PushSender = (sub: { endpoint: string; p256dh: string; auth: string }, payload: PushPayload, ttlSeconds: number) => Promise<void>;

export function pushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
export function vapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

let vapidSet = false;
/** The real sender. Throws an error with `.statusCode` when the push service rejects the subscription. */
export const webPushSender: PushSender = async (sub, payload, ttl) => {
  if (!vapidSet) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:support@triggerplate.com", process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    vapidSet = true;
  }
  await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: ttl });
};

/** Send to every device a user has. Devices the push service says are gone (404/410) are removed. Returns how many were delivered. */
export async function sendToUser(userId: number, payload: PushPayload, ttlSeconds: number, send: PushSender = webPushSender): Promise<number> {
  const subs = await db.getSubscriptions(userId);
  let delivered = 0;
  for (const s of subs) {
    try {
      await send(s, payload, ttlSeconds);
      delivered++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.deleteSubscription(s.endpoint);
      else console.error("[reminders] push failed:", e?.statusCode ?? "", e?.message ?? e);
    }
  }
  return delivered;
}

const MEAL_COPY: PushPayload = { title: "Time to log your meal?", body: "Tap to add what you ate.", url: "/log?tab=food", tag: "meal-reminder" };
const CHECKIN_COPY: PushPayload = { title: "How are you feeling?", body: "A quick check-in helps Triggerplate spot patterns.", url: "/log?tab=symptoms", tag: "symptom-checkin" };

/** One pass over everyone who has reminders on. Safe to call repeatedly: each reminder is claimed once in the log. */
export async function runReminderTick(now = Date.now(), send: PushSender = webPushSender) {
  const users = await db.listUsersWithReminders();
  let sent = 0;
  for (const p of users) {
    try {
      const tz = isValidTimeZone(p.timeZone) ? p.timeZone : "UTC";
      if (p.mealReminders) {
        const lastMeal = await db.getLastMealAt(p.userId);
        for (const due of dueMealReminders(now, tz, p.mealTimes, lastMeal)) {
          if (!(await db.claimNotification(p.userId, due.key, "meal"))) continue;
          sent += await sendToUser(p.userId, MEAL_COPY, 30 * 60, send);
        }
      }
      if (p.symptomCheckins) {
        const meals = await db.getMealsInRange(p.userId, now - 4 * 3600_000, now);
        const [lastSymptom, lastCheckin] = await Promise.all([db.getLastSymptomAt(p.userId), db.lastNotificationAt(p.userId, "checkin")]);
        const due = dueCheckin(now, tz, meals, lastSymptom, lastCheckin);
        if (due && (await db.claimNotification(p.userId, due.key, "checkin"))) {
          sent += await sendToUser(p.userId, CHECKIN_COPY, 60 * 60, send);
        }
      }
    } catch (e) {
      console.error("[reminders] user failed:", p.userId, e);
    }
  }
  return sent;
}

let timer: ReturnType<typeof setInterval> | null = null;
let lastPrune = 0;

export function startReminderScheduler() {
  if (timer) return;
  if (!pushConfigured()) {
    console.log("[reminders] VAPID keys not set; push reminders are off.");
    return;
  }
  let running = false;
  timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runReminderTick();
      if (Date.now() - lastPrune > 6 * 3600_000) {
        lastPrune = Date.now();
        await db.pruneNotificationLog(14 * 86_400_000);
      }
    } catch (e) {
      console.error("[reminders] tick failed:", e);
    } finally {
      running = false;
    }
  }, 60_000);
  timer.unref?.();
  console.log("[reminders] scheduler started");
}
