// Meal reminders and symptom check-ins, delivered as push notifications to this device.

import { useEffect, useState } from "react";
import { Bell, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { installPlatform, isStandalone } from "@/lib/install";
import { DEFAULT_MEAL_TIMES, MAX_MEAL_TIMES, normalizeTimes } from "@shared/reminders";

const timeInput = "bg-background border border-border rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

function urlBase64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const supportsPush = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export default function RemindersCard() {
  const utils = trpc.useUtils();
  const q = trpc.reminders.get.useQuery();
  const save = trpc.reminders.save.useMutation({ onSuccess: () => utils.reminders.get.invalidate() });
  const subscribe = trpc.reminders.subscribe.useMutation();
  const unsubscribe = trpc.reminders.unsubscribe.useMutation();
  const test = trpc.reminders.test.useMutation();

  const [meal, setMeal] = useState(false);
  const [check, setCheck] = useState(false);
  const [times, setTimes] = useState<string[]>(DEFAULT_MEAL_TIMES);
  const [thisDevice, setThisDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  useEffect(() => {
    const p = q.data?.prefs;
    if (!p) return;
    setMeal(p.mealReminders); setCheck(p.symptomCheckins); setTimes(p.mealTimes);
    // Keep the time zone current if you travel.
    if ((p.mealReminders || p.symptomCheckins) && p.timeZone !== tz) {
      save.mutate({ ...p, timeZone: tz });
    }
  }, [q.data?.prefs]);

  useEffect(() => {
    if (!supportsPush()) return;
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setThisDevice(!!sub))
      .catch(() => {});
  }, []);

  const iosNeedsInstall = installPlatform() === "ios" && !isStandalone();
  const unsupported = !supportsPush();
  const blocked = typeof Notification !== "undefined" && Notification.permission === "denied";

  /** Ask permission and register this device. Returns false (with a message) if it can't be done. */
  const ensureDevice = async (): Promise<boolean> => {
    if (!q.data?.available) { toast.error("Reminders aren't set up on the server yet."); return false; }
    const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (perm !== "granted") { toast.error("Notifications are blocked. Allow them for this site in your browser settings."); return false; }
    try {
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(q.data.publicKey) });
      const j = sub.toJSON();
      if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) throw new Error("incomplete subscription");
      await subscribe.mutateAsync({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth });
      setThisDevice(true);
      utils.reminders.get.invalidate();
      return true;
    } catch {
      toast.error("Couldn't turn on notifications on this device.");
      return false;
    }
  };

  const persist = async (next: { meal: boolean; check: boolean; times: string[] }) => {
    try {
      await save.mutateAsync({ mealReminders: next.meal, symptomCheckins: next.check, mealTimes: next.times, timeZone: tz });
      return true;
    } catch (e: any) {
      toast.error(e?.message || "Couldn't save");
      return false;
    }
  };

  const toggle = async (which: "meal" | "check", on: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (on && !thisDevice && !(await ensureDevice())) return;
      const next = { meal: which === "meal" ? on : meal, check: which === "check" ? on : check, times };
      if (await persist(next)) { setMeal(next.meal); setCheck(next.check); }
    } finally { setBusy(false); }
  };

  const changeTimes = async (nextRaw: string[]) => {
    setTimes(nextRaw);
    const clean = normalizeTimes(nextRaw);
    if (clean.length === 0 || clean.length !== nextRaw.length) return; // wait until the list is valid and unique
    if (meal) await persist({ meal, check, times: clean });
  };

  const sendTest = () => test.mutate(undefined, {
    onSuccess: r => r.delivered > 0 ? toast.success("Sent. It should arrive in a few seconds.") : toast.error("No device received it. Turn a reminder on here first."),
    onError: e => toast.error(e.message || "Couldn't send"),
  });

  const note = iosNeedsInstall
    ? "On iPhone, add Triggerplate to your Home Screen first (Profile, Add to Home Screen), then open it from there to turn reminders on."
    : unsupported ? "This browser can't show notifications. Try Chrome on Android, or the installed app on iPhone."
    : blocked ? "Notifications are blocked for this site. Allow them in your browser settings, then come back."
    : q.data && !q.data.available ? "Reminders aren't switched on for this server yet."
    : null;
  const disabled = !!note || busy || q.isLoading;

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Bell className="w-4 h-4 text-sand-dark" />
        Reminders
      </h3>
      {note && <p className="text-xs text-muted-foreground mb-3 rounded-lg bg-muted/60 px-3 py-2">{note}</p>}

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <div className="pr-3">
              <p className="text-sm text-foreground">Meal reminders</p>
              <p className="text-xs text-muted-foreground">A nudge at your times, skipped if you already logged a meal</p>
            </div>
            <Switch checked={meal} disabled={disabled} onCheckedChange={v => toggle("meal", v)} aria-label="Meal reminders" />
          </div>
          {meal && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {times.map((t, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <input type="time" className={timeInput} value={t} aria-label={`Reminder time ${i + 1}`}
                    onChange={e => changeTimes(times.map((x, j) => (j === i ? e.target.value : x)))} />
                  {times.length > 1 && (
                    <button type="button" aria-label="Remove time" className="p-1 text-muted-foreground" onClick={() => changeTimes(times.filter((_, j) => j !== i))}>
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </span>
              ))}
              {times.length < MAX_MEAL_TIMES && (
                <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary px-1 py-1.5"
                  onClick={() => changeTimes([...times, times.includes("15:00") ? "20:00" : "15:00"])}>
                  <Plus className="w-3.5 h-3.5" /> Add time
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="pr-3">
            <p className="text-sm text-foreground">Symptom check-ins</p>
            <p className="text-xs text-muted-foreground">2 to 4 hours after a moderate or high meal. Quiet from 10pm to 7am</p>
          </div>
          <Switch checked={check} disabled={disabled} onCheckedChange={v => toggle("check", v)} aria-label="Symptom check-ins" />
        </div>
      </div>

      {(meal || check) && thisDevice && !note && (
        <button type="button" onClick={sendTest} disabled={test.isPending} className="mt-3 text-xs font-semibold text-primary disabled:opacity-60">
          {test.isPending ? "Sending..." : "Send a test notification"}
        </button>
      )}
      {(meal || check) && thisDevice && (
        <p className="text-[11px] text-muted-foreground mt-2">Times follow your phone's time zone ({tz}). Notifications never include what you ate.</p>
      )}
    </div>
  );
}
