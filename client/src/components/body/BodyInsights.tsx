// Body tab: "Fat or muscle?" signals, and weight pace before/after protocol changes.
// Both say what the numbers show and what they cannot show. Nothing here claims a cause.

import { useMemo } from "react";
import { Dumbbell, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { TONE, tint } from "@/lib/tones";
import { fmtMg } from "@shared/dose";
import { doseMarkers } from "@shared/weekly";
import { addDays, aroundChanges, retentionCheck, type ChangeWindow, type Signal, type SignalState } from "@shared/bodyTrend";

const md = (date: string) => { const [, m, d] = date.split("-"); return `${Number(m)}/${Number(d)}`; };

const DOT: Record<SignalState, string> = {
  good: "oklch(0.62 0.12 155)",
  neutral: "oklch(0.7 0.02 80)",
  watch: TONE.symptoms.ink,
  unknown: "transparent",
};

function SignalRow({ s }: { s: Signal }) {
  return (
    <li className="flex gap-2.5 py-1.5">
      <span className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 border" style={{ background: DOT[s.state], borderColor: s.state === "unknown" ? "oklch(0.7 0.02 80)" : DOT[s.state] }} />
      <div className="min-w-0">
        <p className="text-xs font-semibold">{s.label}</p>
        <p className="text-xs text-muted-foreground">{s.detail}</p>
      </div>
    </li>
  );
}

export interface BodyInsightsProps {
  days: Array<{ date: string; weightLb: number | null; proteinG: number }>;
  lifts: Array<{ exercise: string; series: Array<{ date: string; e1rm: number }> }>;
  proteinTargetG: number;
  tzOffsetMinutes: number;
}

export default function BodyInsights({ days, lifts, proteinTargetG, tzOffsetMinutes }: BodyInsightsProps) {
  const waistsQuery = trpc.fitness.waists.useQuery();
  const doseQuery = trpc.dose.list.useQuery(undefined, { retry: false });
  const today = days[days.length - 1]?.date;
  const weighIns = useMemo(() => days.filter(d => d.weightLb !== null).map(d => ({ date: d.date, lb: d.weightLb as number })), [days]);

  const waists = useMemo(
    () => (waistsQuery.data ?? []).map(w => ({ date: new Date(w.loggedAt - tzOffsetMinutes * 60_000).toISOString().slice(0, 10), inches: w.waistIn })),
    [waistsQuery.data, tzOffsetMinutes],
  );

  const check = useMemo(() => {
    if (!today) return null;
    const recent = days.filter(d => d.date >= addDays(today, -13) && d.proteinG > 0).map(d => d.proteinG);
    return retentionCheck({
      weighIns, waists, lifts, today, proteinTargetG,
      proteinAvgG: recent.length >= 4 ? recent.reduce((a, b) => a + b, 0) / recent.length : null,
    });
  }, [days, weighIns, waists, lifts, today, proteinTargetG]);

  const windows = useMemo(() => {
    if (!today) return [];
    const markers = doseMarkers(doseQuery.data?.doses ?? [], tzOffsetMinutes);
    return aroundChanges({ markers, weighIns, days, today }).slice(-3).reverse();
  }, [doseQuery.data, tzOffsetMinutes, weighIns, days, today]);

  if (weighIns.length === 0 || !check) return null;
  const tone = check.verdict === "watch" ? TONE.symptoms.ink : check.verdict === "good" ? "oklch(0.62 0.12 155)" : "oklch(0.7 0.02 80)";

  return (
    <>
      <section className="bg-card border border-border/60 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <Dumbbell className="w-4 h-4" style={{ color: TONE.strength.ink }} />
          <h2 className="text-sm font-semibold">Fat or muscle?</h2>
        </div>
        <p className="text-sm font-medium rounded-lg px-3 py-2 mt-2" style={{ background: tint(tone, 14) }}>{check.headline}</p>
        <ul className="mt-2 divide-y divide-border/50">{check.signals.map(s => <SignalRow key={s.key} s={s} />)}</ul>
        <p className="text-[11px] text-muted-foreground mt-2 flex gap-1.5">
          <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
          Signals from your own logs, not a body-composition scan. Strength, waist and protein together say more than the scale alone.
        </p>
      </section>

      {windows.length > 0 && (
        <section className="bg-card border border-border/60 rounded-2xl p-4 mb-4">
          <h2 className="text-sm font-semibold">Around protocol changes</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Weight pace in the 2 weeks before and after each change.</p>
          <div className="mt-3 space-y-3">
            {windows.map(w => <WindowRow key={w.start} w={w} />)}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 flex gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
            This shows timing only. Weight also moves with food, water, sleep, training and illness, so it can't show that a dose changed anything.
          </p>
        </section>
      )}
    </>
  );
}

function Side({ title, rate, protein, n }: { title: string; rate: ChangeWindow["before"]["rate"]; protein: number | null; n: number }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">{title}</p>
      <p className="text-sm font-semibold mt-0.5">{rate ? `${rate.lbPerWeek > 0 ? "+" : ""}${rate.lbPerWeek} lb/wk` : "–"}</p>
      <p className="text-[11px] text-muted-foreground">{protein !== null ? `${protein} g protein avg` : "protein not logged"} · {n} weigh-ins</p>
    </div>
  );
}

function WindowRow({ w }: { w: ChangeWindow }) {
  return (
    <div>
      <p className="text-xs font-semibold">
        {md(w.start)}{w.end !== w.start ? `–${md(w.end)}` : ""}
        <span className="font-normal text-muted-foreground"> · {w.items.map(i => `${i.compound} ${fmtMg(i.doseMcg)}`).join(", ")}</span>
      </p>
      {w.tangled && w.items.length > 1 && (
        <p className="text-[11px] mt-1 rounded-md px-2 py-1" style={{ background: tint(TONE.fiber.ink, 14) }}>
          {w.items.length} changes within a week of each other. Even with enough data, nothing here could be tied to just one.
        </p>
      )}
      {w.status === "ok" ? (
        <div className="grid grid-cols-2 gap-2 mt-2">
          <Side title="Before" rate={w.before.rate} protein={w.before.proteinAvgG} n={w.before.weighIns} />
          <Side title="After" rate={w.after.rate} protein={w.after.proteinAvgG} n={w.after.weighIns} />
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground mt-1">
          {w.status === "too_recent" ? `Too recent to compare. Check back after ${md(addDays(w.end, 7))}.` : "Not enough weigh-ins on both sides to compare (3 or more in each period)."}
        </p>
      )}
    </div>
  );
}
