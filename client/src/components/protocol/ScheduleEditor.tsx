// Pick how often a compound is taken: every N days, certain weekdays, or N days on / M days off.
// The 14-day preview shows exactly which days the app will expect a dose, so there are no surprises.

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { WEEKDAY_SHORT, describeSchedule, isDoseDay, keyFromIndex, dayIndex, localKey, type Schedule } from "@shared/doseSchedule";

const chip = (on: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/60 text-muted-foreground border-transparent"}`;
const num = "w-14 rounded-lg border border-border bg-background px-2 py-1 text-foreground";
// Monday first reads more naturally for a work-week schedule.
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function ScheduleEditor({ current, saving, onSave, onCancel }: {
  current: Schedule;
  saving: boolean;
  onSave: (s: Schedule) => void;
  onCancel: () => void;
}) {
  const todayKey = localKey(Date.now(), new Date().getTimezoneOffset());
  const [kind, setKind] = useState<Schedule["kind"]>(current.kind);
  const [days, setDays] = useState(current.kind === "interval" ? current.days : 7);
  const [weekdays, setWeekdays] = useState<number[]>(current.kind === "weekdays" ? current.days : [1, 2, 3, 4, 5]);
  const [on, setOn] = useState(current.kind === "cycle" ? current.on : 5);
  const [off, setOff] = useState(current.kind === "cycle" ? current.off : 2);
  const [start, setStart] = useState(current.kind === "cycle" ? current.start : todayKey);

  const draft: Schedule | null = useMemo(() => {
    if (kind === "interval") return days >= 1 && days <= 60 ? { kind, days: Math.round(days) } : null;
    if (kind === "weekdays") return weekdays.length ? { kind, days: [...weekdays].sort((a, b) => a - b) } : null;
    return on >= 1 && on <= 60 && off >= 0 && off <= 60 && /^\d{4}-\d{2}-\d{2}$/.test(start) ? { kind, on: Math.round(on), off: Math.round(off), start } : null;
  }, [kind, days, weekdays, on, off, start]);

  const preview = useMemo(() => {
    if (!draft || draft.kind === "interval") return null;
    return Array.from({ length: 14 }, (_, i) => {
      const key = keyFromIndex(dayIndex(todayKey) + i);
      return { key, on: isDoseDay(draft, key), dow: new Date(`${key}T00:00:00Z`).getUTCDay() };
    });
  }, [draft, todayKey]);

  return (
    <div className="mt-2 rounded-xl border border-border/60 bg-background p-3 space-y-3 text-foreground">
      <div className="flex gap-1.5 flex-wrap">
        <button type="button" className={chip(kind === "interval")} onClick={() => setKind("interval")}>Every N days</button>
        <button type="button" className={chip(kind === "weekdays")} onClick={() => setKind("weekdays")}>Days of the week</button>
        <button type="button" className={chip(kind === "cycle")} onClick={() => setKind("cycle")}>On / off cycle</button>
      </div>

      {kind === "interval" && (
        <label className="flex items-center gap-2 text-xs">Every
          <input type="number" min={1} max={60} value={days} onChange={e => setDays(Number(e.target.value))} className={num} /> days
        </label>
      )}

      {kind === "weekdays" && (
        <div className="flex gap-1.5 flex-wrap">
          {ORDER.map(d => (
            <button key={d} type="button" className={chip(weekdays.includes(d))}
              onClick={() => setWeekdays(w => (w.includes(d) ? w.filter(x => x !== d) : [...w, d]))}>{WEEKDAY_SHORT[d]}</button>
          ))}
        </div>
      )}

      {kind === "cycle" && (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <input type="number" min={1} max={60} value={on} onChange={e => setOn(Number(e.target.value))} className={num} /> days on,
            <input type="number" min={0} max={60} value={off} onChange={e => setOff(Number(e.target.value))} className={num} /> days off
          </div>
          <label className="flex items-center gap-2">First "on" day
            <input type="date" value={start} max={todayKey} onChange={e => setStart(e.target.value)} className="rounded-lg border border-border bg-background px-2 py-1" />
          </label>
        </div>
      )}

      {preview && (
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Next 14 days</p>
          <div className="grid grid-cols-7 gap-1">
            {preview.map(p => (
              <div key={p.key} className={`rounded-md text-center py-1 text-[10px] ${p.on ? "bg-primary text-primary-foreground font-semibold" : "bg-muted text-muted-foreground"}`}>
                {WEEKDAY_SHORT[p.dow].slice(0, 2)}<br />{Number(p.key.slice(8))}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        {draft ? describeSchedule(draft) + ". " : ""}Rest days never break your streak; only days you planned to dose can be missed.
      </p>
      <div className="flex gap-2">
        <Button size="sm" className="h-8" disabled={!draft || saving} onClick={() => draft && onSave(draft)}>Save</Button>
        <Button size="sm" variant="ghost" className="h-8" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
