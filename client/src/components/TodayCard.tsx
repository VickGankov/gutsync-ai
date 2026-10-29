// Home "Today" card: a live summary of the day plus the single most useful next action.

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Activity, ArrowRight, Check, Droplets, Dumbbell, UtensilsCrossed } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatTimeAgo, getSymptomLabel } from "@/lib/store";
import { summarizeToday } from "@shared/today";
import { formatGal, formatGalTarget } from "@/lib/units";
import { useSupplements } from "@/components/SupplementChecklist";

/** Reference used only for the optional Today fiber bar; not advice. */
const FIBER_REFERENCE_G = 25;
const FIBER_PREF_KEY = "gutsync_today_fiber";
export function readFiberPref() {
  try { return localStorage.getItem(FIBER_PREF_KEY) === "1"; } catch { return false; }
}
export function writeFiberPref(on: boolean) {
  try { localStorage.setItem(FIBER_PREF_KEY, on ? "1" : "0"); } catch { /* storage unavailable: preference just won't persist */ }
}

interface Props {
  meals: Array<{ loggedAt: number }>;
  symptoms: Array<{ type: string; severity: number; loggedAt: number }>;
  reintroCheckInPending: boolean;
}

// One color per kind of data, so the same thing looks the same everywhere. Bright on the dark card.
const TONE = {
  meals: "oklch(0.91 0.2 120)",
  symptoms: "oklch(0.76 0.15 25)",
  protein: "oklch(0.77 0.14 295)",
  water: "oklch(0.81 0.1 225)",
  fiber: "oklch(0.83 0.14 80)",
} as const;

function Tile({ href, icon, value, unit, label, progress, tone }: { href: string; icon: React.ReactNode; value: string; unit?: string; label: string; progress?: number; tone: string }) {
  return (
    <Link href={href} className="min-w-0 block">
      <div className="rounded-2xl px-3 py-2.5 active:scale-95 transition-transform cursor-pointer" style={{ background: `color-mix(in oklch, ${tone} 16%, transparent)` }}>
        <div className="flex items-center gap-1.5 [&_svg]:hidden">
          {icon}<span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: tone }} />
          <span className="text-[10px] uppercase tracking-wide font-medium truncate text-white/70">{label}</span>
        </div>
        <p className="text-lg font-display text-white mt-0.5 whitespace-nowrap">{value}{unit && <span className="text-xs font-sans text-white/60 ml-1">{unit}</span>}</p>
        {progress !== undefined && (
          <div className="mt-1.5 h-1.5 rounded-full bg-white/15 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, progress * 100))}%`, background: tone }} />
          </div>
        )}
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

  const supps = useSupplements();
  const showFiber = useMemo(() => readFiberPref(), []);
  const fiberG = fitness.data?.fiber.todayG ?? null;

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
      className="relative overflow-hidden rounded-3xl p-5 mb-4 bg-primary text-white shadow-lg shadow-black/10"
    >
      <Activity aria-hidden className="absolute -right-4 -top-4 w-28 h-28 text-white/5 rotate-12" />
      <p className="text-[11px] uppercase tracking-wider font-medium text-white/60">
        Today · {d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
      </p>
      <p className="font-display text-lg leading-snug text-white mt-1.5 relative">
        {headline} {lastMealText && <span className="text-white/60 text-sm font-sans">{lastMealText}</span>}
      </p>

      <div className="grid grid-cols-2 gap-2 mt-4 relative">
        <Tile href="/log?tab=food" icon={<UtensilsCrossed className="w-3 h-3" />} tone={TONE.meals} label="Meals" value={String(s.mealsToday)} />
        <Tile href="/log?tab=symptoms" icon={<Activity className="w-3 h-3" />} tone={TONE.symptoms} label="Symptoms" value={String(s.symptomsToday)} />
        <Tile
          href="/progress?tab=nutrition"
          icon={<Dumbbell className="w-3 h-3" />}
          tone={TONE.protein}
          label="Protein"
          unit="g"
          value={proteinG === null ? "–" : proteinTarget ? `${proteinG} / ${proteinTarget}` : `${proteinG}`}
          progress={proteinG !== null && proteinTarget ? proteinG / proteinTarget : undefined}
        />
        <Tile
          href="/progress?tab=nutrition"
          icon={<Droplets className="w-3 h-3" />}
          tone={TONE.water}
          label="Water"
          unit="gal"
          value={waterMl === null ? "–" : waterTargetMl ? `${formatGal(waterMl)} / ${formatGalTarget(waterTargetMl)}` : formatGal(waterMl)}
          progress={waterMl !== null && waterTargetMl ? waterMl / waterTargetMl : undefined}
        />
        {showFiber && (
          <Tile
            href="/progress?tab=nutrition"
            icon={<Activity className="w-3 h-3" />}
            tone={TONE.fiber}
            label="Fiber (est.)"
            unit="g"
            value={fiberG === null ? "–" : `~${fiberG}`}
            progress={fiberG !== null ? fiberG / FIBER_REFERENCE_G : undefined}
          />
        )}
      </div>

      {supps.items.length > 0 && (
        <div className="mt-2.5 relative">
          <p className="text-[10px] uppercase tracking-wide font-medium text-white/60 mb-1.5">Supplements · {supps.takenIds.size}/{supps.items.length}</p>
          <div className="flex flex-wrap gap-1.5">
            {supps.items.map(i => {
              const on = supps.takenIds.has(i.id);
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => supps.toggle(i.id)}
                  aria-pressed={on}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium border active:scale-95 transition-all ${on ? "bg-volt text-volt-foreground border-volt" : "bg-white/10 border-white/15 text-white"}`}
                >
                  {on ? "✓ " : ""}{i.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {s.nudge.href && nudgeText ? (
        <Link href={s.nudge.href}>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-volt text-volt-foreground px-4 py-3 active:scale-[0.98] transition-transform cursor-pointer relative">
            <span className="text-sm font-medium">{nudgeText}</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      ) : (
        <div className="mt-3 flex items-center gap-2 text-sm text-white/70 relative">
          <Check className="w-4 h-4" /> You're all caught up for now.
        </div>
      )}
    </motion.div>
  );
}
