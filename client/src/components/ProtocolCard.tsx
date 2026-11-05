// Dose log card (Progress page): log a dose, see what's next, and see side effects by day since a dose.
// Records what the user took and felt. It gives no dosing advice.

import { TONE } from "@/lib/tones";
import { useMemo, useState } from "react";
import { Syringe, Trash2, Plus, Loader2, Settings2 } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { getSymptomLabel } from "@/lib/store";
import {
  COMPOUND_PRESETS, SITES, SITE_LABEL, compoundKey, fmtMg, intervalsByCompound, isSpaced, mgToMcg,
  sideEffectsByDay, siteReuseNote, siteUsage, statusByCompound, suggestSite, type Site,
} from "@shared/dose";
import { describeSchedule, scheduleStatus } from "@shared/doseSchedule";
import ScheduleEditor from "@/components/protocol/ScheduleEditor";
import ReconCalculator from "@/components/protocol/ReconCalculator";
import ProtocolPrivacy from "@/components/protocol/ProtocolPrivacy";

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

/** yyyy-MM-ddTHH:mm in local time, for <input type="datetime-local"> */
const toLocalInput = (ms: number) => {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
};

const chip = (on: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
    on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/60 text-muted-foreground border-transparent"
  }`;

export default function ProtocolCard() {
  const utils = trpc.useUtils();
  const doseQuery = trpc.dose.list.useQuery();
  const symptomsQuery = trpc.symptoms.list.useQuery({ limit: 50 });
  const doses = doseQuery.data?.doses ?? [];
  const schedules = doseQuery.data?.schedules ?? [];
  const symptoms = symptomsQuery.data ?? [];

  const latest = doses[0];
  const [open, setOpen] = useState(false);
  const [compound, setCompound] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [mg, setMg] = useState<string | null>(null);
  const [unit, setUnit] = useState<"mg" | "mcg">("mg");
  const [site, setSite] = useState<Site | "none" | null>(null);
  const [notes, setNotes] = useState("");
  const [when, setWhen] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null);

  // Defaults come from the last dose: same compound and amount, next site in the rotation.
  const compoundValue = compound ?? latest?.compound ?? "Retatrutide";
  const isPreset = (COMPOUND_PRESETS as readonly string[]).includes(compoundValue);
  const mgValue = mg ?? (latest ? String(unit === "mg" ? latest.doseMcg / 1000 : latest.doseMcg) : "");
  const usage = useMemo(() => siteUsage(doses, symptoms), [doses, symptoms]);
  const suggested = suggestSite(usage);
  // `site` is a chosen site, "none" when the person skips it, or null to follow the suggestion.
  const siteValue: Site | null = site === null ? suggested : site === "none" ? null : site;
  const reuseNote = siteValue ? siteReuseNote(usage, siteValue) : null;

  const refresh = () => { utils.dose.list.invalidate(); };
  const logDose = trpc.dose.log.useMutation({
    onSuccess: () => {
      refresh();
      setOpen(false); setMg(null); setSite(null); setNotes(""); setWhen("");
      toast.success("Dose logged");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteDose = trpc.dose.delete.useMutation({ onSuccess: refresh, onError: (e) => toast.error(e.message) });

  const saveSchedule = trpc.dose.setSchedule.useMutation({
    onSuccess: () => { refresh(); setEditKey(null); toast.success("Schedule saved"); },
    onError: (e) => toast.error(e.message),
  });
  const tz = new Date().getTimezoneOffset();
  const intervals = useMemo(() => intervalsByCompound(doses, schedules), [doses, schedules]);
  const statuses = useMemo(() => statusByCompound(doses, intervals), [doses, intervals]);

  // The chart follows one compound at a time. Daily compounds have no meaningful "day after dose".
  const spaced = statuses.filter(x => isSpaced(x.interval));
  const focus = statuses.find(x => x.key === focusKey) ?? spaced[0] ?? statuses[0];
  const focusDoses = useMemo(() => (focus ? doses.filter(d => compoundKey(d.compound) === focus.key) : []), [doses, focus]);
  const effects = useMemo(() => sideEffectsByDay(focusDoses, symptoms, 7), [focusDoses, symptoms]);

  const submit = () => {
    const name = (isPreset ? compoundValue : other || compoundValue).trim();
    const amount = Number(mgValue);
    if (!name) return toast.error("Enter the compound name");
    if (!Number.isFinite(amount) || amount <= 0) return toast.error(`Enter the dose in ${unit}`);
    const at = when ? new Date(when).getTime() : undefined;
    logDose.mutate({ compound: name, doseMcg: unit === "mg" ? mgToMcg(amount) : Math.round(amount), ...(siteValue ? { site: siteValue } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}), ...(at ? { loggedAt: at } : {}) });
  };

  const fmtDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: "long" });
  const planText = (ss: ReturnType<typeof scheduleStatus>) => {
    const next = ss.nextKey ? fmtDay(ss.nextKey) : "";
    if (ss.state === "due") return "Dose due today";
    if (ss.state === "done") return `Today's dose is logged. Next: ${next}`;
    if (ss.state === "overdue") return `Missed ${fmtDay(ss.missedKey!)}'s dose. Next: ${next}`;
    return `Rest day. Next dose ${next}`;
  };
  const dueText = (st: (typeof statuses)[number]) =>
    st.state === "due" ? "Next dose due today"
    : st.state === "overdue" ? `Next dose was due ${Math.abs(st.daysUntil)} day${Math.abs(st.daysUntil) === 1 ? "" : "s"} ago`
    : `Next dose in ${st.daysUntil} day${st.daysUntil === 1 ? "" : "s"}`;

  const chartData = [...focusDoses].reverse().slice(-12).map(d => ({
    label: new Date(d.loggedAt).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
    mg: d.doseMcg / 1000,
  }));

  return (
    <section className="bg-card border border-border/60 rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Syringe className="w-4 h-4" style={{ color: TONE.protocol.ink }} />
          <h2 className="text-sm font-semibold">Dose log</h2>
        </div>
        <Button size="sm" variant={open ? "outline" : "default"} className="h-8 rounded-xl gap-1" onClick={() => setOpen(v => !v)}>
          <Plus className="w-3.5 h-3.5" /> {open ? "Close" : "Log dose"}
        </Button>
      </div>

      {/* Status, one row per compound */}
      {statuses.length > 0 ? (
        <div className="space-y-2 mb-3">
          {statuses.map(st => {
            const sched = st.interval.schedule;
            const plan = sched.kind !== "interval";
            const ss = plan ? scheduleStatus(sched, doses.filter(d => compoundKey(d.compound) === st.key).map(d => d.loggedAt), Date.now(), tz) : null;
            const overdue = ss ? ss.state === "overdue" : st.state === "overdue";
            return (
            <div key={st.key} className="rounded-xl bg-muted px-3.5 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-display text-lg leading-tight">{st.name} · {fmtMg(st.latest!.doseMcg)}</p>
                <span className="text-xs text-muted-foreground whitespace-nowrap">Day {ss ? ss.dayNumber : st.dayNumber}</span>
              </div>
              <p className="text-xs mt-1 text-muted-foreground">
                Last dose {new Date(st.latest!.loggedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                {st.latest!.site && ` · ${SITE_LABEL[st.latest!.site as Site] ?? st.latest!.site}`}
              </p>
              <p className={`text-xs mt-0.5 ${overdue ? "text-coral font-medium" : "text-foreground"}`}>
                {ss ? planText(ss) : dueText(st)}
              </p>
              {ss && (
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-background px-2 py-0.5">{ss.streak} scheduled dose{ss.streak === 1 ? "" : "s"} in a row</span>
                  {ss.expected28 > 0 && <span className="rounded-full bg-background px-2 py-0.5">{ss.taken28} of {ss.expected28} taken (28 days)</span>}
                </div>
              )}
              <div className="mt-1.5 text-[11px] text-muted-foreground">
                {editKey === st.key ? (
                  <ScheduleEditor current={sched} saving={saveSchedule.isPending} onCancel={() => setEditKey(null)}
                    onSave={s2 => saveSchedule.mutate({ compound: st.name, schedule: s2 })} />
                ) : (
                  <button onClick={() => setEditKey(st.key)} className="inline-flex items-center gap-1">
                    <Settings2 className="w-3 h-3" /> {describeSchedule(sched)}{st.interval.explicit ? "" : " (from your doses)"} · change
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        !open && <p className="text-sm text-muted-foreground mb-3">No doses logged yet. Log your first dose to start tracking day count, injection sites and side effects.</p>
      )}

      {/* Log form */}
      {open && (
        <div className="rounded-xl border border-border/60 p-3 mb-3 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Compound</p>
            <div className="flex flex-wrap gap-1.5">
              {COMPOUND_PRESETS.map(c => (
                <button key={c} type="button" className={chip(compoundValue === c)} onClick={() => setCompound(c)}>{c}</button>
              ))}
              <button type="button" className={chip(!isPreset)} onClick={() => setCompound(other || "Other")}>Other</button>
            </div>
            {!isPreset && (
              <input className={`${inputCls} mt-2`} placeholder="Name" value={other || (compoundValue === "Other" ? "" : compoundValue)}
                onChange={e => { setOther(e.target.value); setCompound(e.target.value || "Other"); }} />
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">
              <span className="flex items-center justify-between">
                Dose
                <span className="flex gap-1">
                  {(["mg", "mcg"] as const).map(u => (
                    <button key={u} type="button" onClick={() => { setUnit(u); setMg(null); }}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${unit === u ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{u}</button>
                  ))}
                </span>
              </span>
              <input className={`${inputCls} mt-1`} type="number" inputMode="decimal" step={unit === "mg" ? "0.05" : "1"} min="0" value={mgValue} onChange={e => setMg(e.target.value)} placeholder={unit === "mg" ? "e.g. 1" : "e.g. 250"} />
            </label>
            <label className="text-xs text-muted-foreground">
              Time (blank = now)
              <input className={`${inputCls} mt-1`} type="datetime-local" max={toLocalInput(Date.now())} value={when} onChange={e => setWhen(e.target.value)} />
            </label>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Injection site {doses.some(d => d.site) && <span className="normal-case tracking-normal">(rested longest is selected)</span>}</p>
            <div className="grid grid-cols-2 gap-1.5">
              {usage.map(u => {
                const on = siteValue === u.site;
                return (
                  <button key={u.site} type="button" onClick={() => setSite(u.site)}
                    className={`rounded-xl border px-3 py-2 text-left transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/60 border-transparent"}`}>
                    <span className="flex items-center justify-between text-xs font-medium">
                      {SITE_LABEL[u.site]}
                      {u.reactions > 0 && <span title="A reaction was logged after a dose here" className="h-2 w-2 rounded-full" style={{ background: "oklch(0.7 0.15 25)" }} />}
                    </span>
                    <span className={`block text-[10px] ${on ? "opacity-80" : "text-muted-foreground"}`}>
                      {u.daysAgo === null ? "Not used yet" : u.daysAgo === 0 ? "Used today" : `${u.daysAgo} day${u.daysAgo === 1 ? "" : "s"} ago`}{u.count28 > 0 ? ` · ${u.count28}× in 28 d` : ""}
                    </span>
                  </button>
                );
              })}
            </div>
            <button type="button" className={`${chip(site === "none")} mt-1.5`} onClick={() => setSite(site === "none" ? null : "none")}>No site / not an injection</button>
            {reuseNote && <p className="text-[11px] text-muted-foreground mt-1.5">{reuseNote}</p>}
            {usage.some(u => u.reactions > 0) && <p className="text-[11px] text-muted-foreground mt-1">Red dot: you logged an injection-site reaction within 3 days of a dose there. If it persists or worsens, tell your doctor.</p>}
          </div>
          <input className={inputCls} placeholder="Note (optional): vial, batch, how it went" maxLength={500} value={notes} onChange={e => setNotes(e.target.value)} />
          <Button className="w-full" onClick={submit} disabled={logDose.isPending}>
            {logDose.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save dose
          </Button>
        </div>
      )}

      <ReconCalculator />

      {/* Side effects */}
      {latest && focus && (
        <div className="mb-3">
          {statuses.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {statuses.map(st => (
                <button key={st.key} type="button" className={chip(focus.key === st.key)} onClick={() => setFocusKey(st.key)}>{st.name}</button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold">Side effects by day after a dose</p>
            <Link href="/log?tab=symptoms" className="text-xs text-primary font-medium">Log how you feel →</Link>
          </div>
          {!isSpaced(focus.interval) ? (
            <p className="text-xs text-muted-foreground">{focus.name} is taken daily, so a day-after-dose pattern wouldn't tell you anything. Spaced doses (every 2+ days) get this chart.</p>
          ) : effects.total >= 3 ? (
            <>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={effects.chart} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
                    <XAxis dataKey="day" tickFormatter={(d: number) => `D${d + 1}`} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: number, _n: string, p: { payload?: { avgSeverity: number } }) => [`${v} logged${v ? ` · avg ${p.payload?.avgSeverity}/5` : ""}`, "Symptoms"]} labelFormatter={(d: number) => `Day ${d + 1} after dose`} />
                    <Bar dataKey="count" fill="oklch(0.7 0.12 25)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {effects.peaks.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {effects.peaks.slice(0, 4).map(p => (
                    <span key={p.type} className="text-[11px] px-2 py-1 rounded-full bg-muted text-foreground">
                      {getSymptomLabel(p.type)} peaks day {p.peakDay + 1} · {p.n}×
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Log a few symptoms after your doses and the day-by-day pattern shows up here.</p>
          )}
        </div>
      )}

      {/* Dose history */}
      {chartData.length >= 2 && (
        <div className="h-24 mb-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [`${v} mg`, "Dose"]} />
              <Bar dataKey="mg" fill="oklch(0.3 0.02 265)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {doses.length > 0 && (
        <button className="text-xs text-primary font-medium" onClick={() => setShowHistory(v => !v)}>
          {showHistory ? "Hide history" : `History (${doses.length})`}
        </button>
      )}
      {showHistory && (
        <div className="mt-2 space-y-1.5 border-t border-border/60 pt-2">
          {doses.slice(0, 20).map(d => (
            <div key={d.id} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                <span className="text-foreground font-medium">{fmtMg(d.doseMcg)}</span> {d.compound}
                {d.site && ` · ${SITE_LABEL[d.site as Site] ?? d.site}`} · {new Date(d.loggedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                {d.notes && <span className="block text-[11px] italic">{d.notes}</span>}
              </span>
              <button onClick={() => deleteDose.mutate({ id: d.id })} title="Delete"><Trash2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
            </div>
          ))}
        </div>
      )}

      <ProtocolPrivacy hasData={doses.length > 0} expanded={doses.length === 0} />
      <p className="text-[10px] text-muted-foreground mt-3 leading-snug">A personal log, not medical advice. Tell your doctor what you take; seek care for severe or persistent vomiting or abdominal pain.</p>
    </section>
  );
}
