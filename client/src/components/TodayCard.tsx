// Home "Today" card: a live summary of the day plus the single most useful next action.

import { motion } from "framer-motion";
import { Link } from "wouter";
import { Activity, ArrowRight, Check, Droplets, Dumbbell, UtensilsCrossed } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatTimeAgo, getSymptomLabel } from "@/lib/store";
import { summarizeToday } from "@shared/today";

interface Props {
  meals: Array<{ loggedAt: number }>;
  symptoms: Array<{ type: string; severity: number; loggedAt: number }>;
  reintroCheckInPending: boolean;
}

function Tile({ href, icon, value, unit, label }: { href: string; icon: React.ReactNode; value: string; unit?: string; label: string }) {
  return (
    <Link href={href} className="flex-1 min-w-0 block">
      <div className="rounded-2xl bg-white/60 dark:bg-white/10 border border-white/70 dark:border-white/10 px-2 py-2.5 active:scale-95 transition-transform cursor-pointer">
        <div className="flex items-center gap-1 text-sage-dark [&_svg]:hidden">{icon}<span className="text-[9px] uppercase tracking-wide font-medium truncate">{label}</span></div>
        <p className="text-base font-display text-foreground mt-0.5 truncate">{value}{unit && <span className="text-[10px] font-sans text-muted-foreground ml-0.5">{unit}</span>}</p>
      </div>
    </Link>
  );
}

export default function TodayCard({ meals, symptoms, reintroCheckInPending }: Props) {
  const now = Date.now();
  const d = new Date(now);
  const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

  const fitness = trpc.fitness.summary.useQuery({ days: 1, tzOffsetMinutes: d.getTimezoneOffset() });
  const proteinG = fitness.data ? fitness.data.today?.proteinG ?? 0 : null;
  const proteinTarget = fitness.data?.targets.proteinTargetG ?? null;
  const waterMl = fitness.data ? fitness.data.today?.waterMl ?? 0 : null;
  const waterTargetMl = fitness.data?.targets.waterTargetMl ?? null;

  const s = summarizeToday({
    now, startOfDay, hour: d.getHours(), meals, symptoms,
    proteinG, proteinTargetG: proteinTarget, reintroCheckInPending,
  });

  const lastMealText = s.lastMealAt && now - s.lastMealAt < 48 * 3_600_000 ? `Last meal ${formatTimeAgo(s.lastMealAt).toLowerCase()}.` : "";
  let headline: string;
  if (s.symptomsToday > 0 && s.worst) {
    headline = `${s.symptomsToday} symptom${s.symptomsToday > 1 ? "s" : ""} today, worst: ${getSymptomLabel(s.worst.type)} ${s.worst.severity}/5.`;
  } else if (s.mealsToday > 0) {
    headline = "No symptoms so far today.";
  } else if (s.lastSymptom) {
    headline = `Nothing logged yet today. Last symptom: ${getSymptomLabel(s.lastSymptom.type)}, ${formatTimeAgo(s.lastSymptom.loggedAt).toLowerCase()}.`;
  } else {
    headline = "Nothing logged yet today.";
  }

  const nudgeText =
    s.nudge.kind === "reintro" ? "Check in on your reintroduction test"
    : s.nudge.kind === "meal" ? "Log what you've eaten"
    : s.nudge.kind === "feeling" ? "How are you feeling since your last meal?"
    : s.nudge.kind === "protein" ? `${s.nudge.remainingG} g of protein to go`
    : null;

  return (
    <motion.div
      className="relative overflow-hidden rounded-3xl p-5 mb-4 border border-sage/20 bg-gradient-to-br from-sage-light/70 via-sage-light/30 to-sand/40"
    >
      <Activity aria-hidden className="absolute -right-4 -top-4 w-28 h-28 text-sage/10 rotate-12" />
      <p className="text-[11px] uppercase tracking-wider font-medium text-sage-dark">
        Today · {d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
      </p>
      <p className="font-display text-lg leading-snug text-foreground mt-1.5 relative">
        {headline} {lastMealText && <span className="text-muted-foreground text-sm font-sans">{lastMealText}</span>}
      </p>

      <div className="flex gap-1.5 mt-4 relative">
        <Tile href="/food" icon={<UtensilsCrossed className="w-3 h-3" />} label="Meals" value={String(s.mealsToday)} />
        <Tile href="/symptoms" icon={<Activity className="w-3 h-3" />} label="Symptoms" value={String(s.symptomsToday)} />
        <Tile
          href="/progress"
          icon={<Dumbbell className="w-3 h-3" />}
          label="Protein"
          unit="g"
          value={proteinG === null ? "–" : proteinTarget ? `${proteinG}/${proteinTarget}` : `${proteinG}`}
        />
        <Tile
          href="/progress"
          icon={<Droplets className="w-3 h-3" />}
          label="Water"
          unit="L"
          value={waterMl === null ? "–" : waterTargetMl ? `${(waterMl / 1000).toFixed(1)}/${(waterTargetMl / 1000).toFixed(1)}` : (waterMl / 1000).toFixed(1)}
        />
      </div>

      {s.nudge.href && nudgeText ? (
        <Link href={s.nudge.href}>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-primary text-primary-foreground px-4 py-3 active:scale-[0.98] transition-transform cursor-pointer relative">
            <span className="text-sm font-medium">{nudgeText}</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-sm text-sage-dark relative">
          <Check className="w-4 h-4" /> You're all caught up for now.
        </div>
      )}
    </motion.div>
  );
}
