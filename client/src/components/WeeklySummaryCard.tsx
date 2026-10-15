// "This week" card on Progress: the few numbers worth checking at a glance.
// Weight (7-day average vs the week before), protein vs target, doses taken vs scheduled, side effects.

import { useMemo } from "react";
import { motion } from "framer-motion";
import { CalendarDays, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { intervalsByCompound } from "@shared/dose";
import { weeklySummary } from "@shared/weekly";
import { getSymptomLabel } from "@/lib/store";

export default function WeeklySummaryCard() {
  const tzOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);
  const summaryQuery = trpc.fitness.summary.useQuery({ days: 28, tzOffsetMinutes });
  const doseQuery = trpc.dose.list.useQuery();
  const symptomsQuery = trpc.symptoms.list.useQuery({ limit: 50 });

  const s = useMemo(() => {
    const data = summaryQuery.data;
    if (!data) return null;
    const doses = doseQuery.data?.doses ?? [];
    return weeklySummary({
      days: data.days,
      doses,
      intervals: intervalsByCompound(doses, doseQuery.data?.schedules ?? []),
      symptoms: symptomsQuery.data ?? [],
      proteinTarget: data.targets.proteinTargetG,
      tzOffsetMinutes,
      now: Date.now(),
    });
  }, [summaryQuery.data, doseQuery.data, symptomsQuery.data, tzOffsetMinutes]);

  if (!s) return null;
  const hasDoses = s.doses.byCompound.length > 0;
  const delta = s.weight.delta;
  const DeltaIcon = delta === null || delta === 0 ? Minus : delta < 0 ? TrendingDown : TrendingUp;

  return (
    <section className="bg-card border border-border/60 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">This week</h2>
        <span className="text-[11px] text-muted-foreground">last 7 days</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat
          label="Weight (avg)"
          value={s.weight.thisAvg !== null ? `${s.weight.thisAvg} lb` : "–"}
          sub={delta !== null ? (
            <span className="inline-flex items-center gap-1"><DeltaIcon className="w-3 h-3" />{delta > 0 ? "+" : ""}{delta} lb vs last week</span>
          ) : s.weight.weighIns === 0 ? "No weigh-ins this week" : "Need last week's weigh-ins to compare"}
        />
        <Stat
          label="Protein (avg)"
          value={s.protein.avg !== null ? `${s.protein.avg} g` : "–"}
          sub={s.protein.avg !== null ? `${s.protein.daysOnTarget} of 7 days on ${s.protein.target} g` : "Nothing logged"}
        />
        <Stat
          label="Doses"
          value={hasDoses ? `${s.doses.taken} / ${s.doses.expected}` : "–"}
          sub={hasDoses ? s.doses.byCompound.map(c => `${c.name} ${c.taken}/${c.expected}`).join(" · ") : "No doses logged"}
        />
        <Stat
          label="Side effects"
          value={String(s.sideEffects.count)}
          sub={s.sideEffects.worst ? `Worst: ${getSymptomLabel(s.sideEffects.worst.type)} ${s.sideEffects.worst.severity}/5` : "None logged"}
        />
      </div>
      <p className="text-[11px] text-muted-foreground mt-2.5">Taken vs scheduled uses your set or inferred days between doses. It's a log, not a plan.</p>
    </section>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: React.ReactNode }) {
  return (
    <motion.div className="rounded-xl bg-muted/50 px-3 py-2.5 min-w-0">
      <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground">{label}</p>
      <p className="text-lg font-display text-foreground mt-0.5 whitespace-nowrap">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{sub}</p>
    </motion.div>
  );
}
