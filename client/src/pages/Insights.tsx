// Triggerplate — Insights Page
// Triggers are found by counting (shared/triggers.ts). The AI only explains a pattern, on demand.

import { motion } from "framer-motion";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, ArrowRight, BarChart3, Loader2, Leaf, Eye, Stethoscope, FlaskConical, ShieldQuestion } from "lucide-react";
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSymptomLabel, getSymptomEmoji } from "@/lib/store";
import type { FoodItem } from "@/lib/store";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import { Link } from "wouter";
import { ofMeals, pct, MIN_EXPOSURES } from "@shared/triggers";
import { declaredStats } from "@shared/sensitivities";

const barColors = ['oklch(0.7 0.12 25)', 'oklch(0.55 0.1 155)', 'oklch(0.75 0.04 80)', 'oklch(0.65 0.08 80)'];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

interface TriggerData {
  key: string;
  names: string[];
  symptom: string;
  exposures: number;
  hits: number;
  otherMeals: number;
  otherHits: number;
  rate: number;
  otherRate: number;
  avgSeverity: number;
  hitsNearDose: number;
  status: "trigger" | "watching";
}

type Explanation = { shows: string; why: string; confidence: string; nextStep: string; seeProfessional: string };

/** A pattern we are only watching: too few meals to call it a trigger. Smaller and quieter on purpose. */
function WatchingRow({ t }: { t: TriggerData }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2">
      <Eye className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <p className="text-xs text-foreground min-w-0 flex-1">
        <span className="font-medium">{t.names.join(" + ")}</span>
        <span className="text-muted-foreground"> → {getSymptomLabel(t.symptom).toLowerCase()}</span>
      </p>
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">{t.exposures}/{MIN_EXPOSURES} meals</span>
    </div>
  );
}

function TriggerCard({ t }: { t: TriggerData }) {
  const [open, setOpen] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const explain = trpc.insights.explain.useMutation({ onSuccess: setExplanation });

  const tone = t.rate >= 0.75 ? { bg: "bg-coral-light/50", text: "text-coral" }
    : t.rate >= 0.5 ? { bg: "bg-sand/60", text: "text-sand-dark" }
    : { bg: "bg-sage-light/40", text: "text-sage-dark" };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !explanation && !explain.isPending) explain.mutate({ key: t.key });
  };

  return (
    <motion.div variants={item} className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-14 h-14 rounded-2xl ${tone.bg} flex flex-col items-center justify-center shrink-0`}>
            <span className={`text-base font-bold font-mono leading-none ${tone.text}`}>{pct(t.rate)}</span>
            <span className="text-[9px] text-muted-foreground mt-1">of meals</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{t.names.join(" + ")}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <span className="text-sm font-medium text-coral">{getSymptomEmoji(t.symptom)} {getSymptomLabel(t.symptom)}</span>
            </div>
            <p className="text-xs text-foreground mt-1">
              Followed {ofMeals(t.hits, t.exposures)}, within 6 h
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t.otherMeals > 0 ? `vs ${pct(t.otherRate)} after other meals` : "no other meals to compare yet"}
              {t.hits > 0 && ` · avg severity ${t.avgSeverity}/5`}
            </p>
          </div>
        </div>

        {t.hitsNearDose > 0 && t.hitsNearDose / t.hits >= 0.5 && (
          <p className="mt-2 text-[11px] text-coral">
            💉 {t.hitsNearDose} of these {t.hits} came within 3 days of a logged dose, so the dose may be the cause rather than the food.
          </p>
        )}

        {t.names.length > 1 && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            These always show up together, so your data can't tell which one it is.
          </p>
        )}

        <button onClick={toggle} className="mt-3 text-xs text-primary font-medium hover:underline">
          {open ? "Hide" : "What this means & what to do"}
        </button>

        {open && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-3 space-y-2.5">
            {explain.isPending && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Writing this up from your numbers…
              </div>
            )}
            {explain.isError && (
              <div className="bg-muted/50 rounded-xl p-3">
                <p className="text-xs text-foreground">
                  Couldn't write the explanation right now. The counts above are still accurate.
                </p>
                <button onClick={() => explain.mutate({ key: t.key })} className="mt-1.5 text-xs text-primary font-medium hover:underline">
                  Try again
                </button>
              </div>
            )}
            {explanation && (
              <>
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">What your data shows</p>
                  <p className="text-xs text-foreground leading-relaxed">{explanation.shows}</p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Why it might happen</p>
                  <p className="text-xs text-foreground leading-relaxed">{explanation.why}</p>
                </div>
                <div className="rounded-xl p-3 flex gap-2 border border-border/60">
                  <ShieldQuestion className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">How sure we are</p>
                    <p className="text-xs text-foreground leading-relaxed">{explanation.confidence}</p>
                  </div>
                </div>
                <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 flex gap-2">
                  <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-primary mb-1">Next step</p>
                    <p className="text-xs text-foreground leading-relaxed">{explanation.nextStep}</p>
                    <Link href="/reintro" className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-primary font-medium hover:underline">
                      <FlaskConical className="w-3 h-3" /> Test it in the Reintroduction challenge
                    </Link>
                  </div>
                </div>
                {explanation.seeProfessional && (
                  <div className="bg-coral-light/30 rounded-xl p-3 flex gap-2">
                    <Stethoscope className="w-4 h-4 text-coral shrink-0 mt-0.5" />
                    <p className="text-xs text-foreground leading-relaxed">{explanation.seeProfessional}</p>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default function Insights() {
  const { isAuthenticated } = useAuth();
  const triggersQuery = trpc.insights.triggers.useQuery(undefined, { enabled: isAuthenticated });
  const mealsQuery = trpc.meals.list.useQuery({ limit: 50 }, { enabled: isAuthenticated });
  const symptomsQuery = trpc.symptoms.list.useQuery({ limit: 50 }, { enabled: isAuthenticated });

  const allPatterns = (triggersQuery.data?.triggers ?? []) as TriggerData[];
  const triggers = allPatterns.filter(t => t.status === "trigger");
  const watching = allPatterns.filter(t => t.status === "watching").slice(0, 6);
  const meals = mealsQuery.data ?? [];
  const symptoms = symptomsQuery.data ?? [];

  // Foods the user flagged on Profile: counted separately from the patterns found in their logs.
  const mySensitivities = trpc.auth.me.useQuery().data?.sensitivities ?? [];
  const flagged = useMemo(
    () => declaredStats(mySensitivities, meals as any[], symptoms as any[]),
    [mySensitivities.join(","), meals, symptoms],
  );

  // Compute symptom frequency data
  const symptomChartData = useMemo(() => {
    const freq: Record<string, number> = {};
    symptoms.forEach((s: { type: string }) => {
      const label = getSymptomLabel(s.type);
      freq[label] = (freq[label] || 0) + 1;
    });
    return Object.entries(freq)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [symptoms]);

  // FODMAP distribution
  const { fodmapData, fodmapCounts } = useMemo(() => {
    const counts = { low: 0, moderate: 0, high: 0 };
    meals.forEach((m: { foods: unknown }) => {
      const foods = (m.foods ?? []) as FoodItem[];
      foods.forEach((f: FoodItem) => {
        if (f.fodmap in counts) counts[f.fodmap as keyof typeof counts]++;
      });
    });
    const data = [
      { name: 'Low', value: counts.low, fill: 'oklch(0.55 0.1 155)' },
      { name: 'Moderate', value: counts.moderate, fill: 'oklch(0.75 0.04 80)' },
      { name: 'High', value: counts.high, fill: 'oklch(0.7 0.12 25)' },
    ];
    return { fodmapData: data, fodmapCounts: counts };
  }, [meals]);

  const isLoading = triggersQuery.isLoading || mealsQuery.isLoading || symptomsQuery.isLoading;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground mt-1">Patterns found by counting your own meals and symptoms</p>
        </div>
      </motion.div>

      {/* Reintroduction challenge entry */}
      <motion.div variants={item} className="mb-6">
        <Link href="/reintro">
          <div className="bg-card rounded-2xl p-4 border border-border/50 shadow-sm flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">Reintroduction challenge</p>
              <p className="text-xs text-muted-foreground">Test FODMAP groups one at a time and build your tolerance map</p>
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
      </motion.div>

      {/* Loading */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Correlations */}
      {!isLoading && (
        <>
          <motion.div variants={item} className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-lg">Likely Triggers</h2>
            </div>
            {triggers.length > 0 ? (
              <div className="space-y-3">
                {triggers.map(t => <TriggerCard key={t.key} t={t} />)}
              </div>
            ) : (
              <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm text-center">
                <Leaf className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-display text-lg mb-1">No clear triggers yet</h3>
                <p className="text-sm text-muted-foreground">
                  A food needs to show up in at least {MIN_EXPOSURES} meals, with a symptom after it more often than after your other meals, before it counts. Keep logging.
                </p>
              </div>
            )}
            {watching.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Still watching</h3>
                </div>
                <div className="space-y-1.5">
                  {watching.map(t => <WatchingRow key={t.key} t={t} />)}
                </div>
                <p className="text-[11px] text-muted-foreground mt-2">Too few meals to say anything yet. These are not triggers.</p>
              </div>
            )}
          </motion.div>

          {/* Foods you flagged */}
          {flagged.length > 0 && (
            <motion.div variants={item} className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Foods you flagged</h3>
              </div>
              <p className="text-[11px] text-muted-foreground mb-3">
                You chose these, so they are shown apart from the patterns found in your logs. A "symptom after" means any symptom within 6 hours of the meal.
              </p>
              <div className="space-y-3">
                {flagged.map(f => (
                  <div key={f.key}>
                    <p className="text-sm font-medium">{f.label}</p>
                    {f.exposures === 0 ? (
                      <p className="text-xs text-muted-foreground">No meals with this in your recent logs yet.</p>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {ofMeals(f.hits, f.exposures)} followed by a symptom ({pct(f.hits / f.exposures)})
                          {f.otherMeals > 0 && <> vs {pct(f.otherHits / f.otherMeals)} of your other meals ({ofMeals(f.otherHits, f.otherMeals)})</>}
                        </p>
                        {f.exposures < MIN_EXPOSURES && (
                          <p className="text-[11px] text-amber-700 mt-0.5">Only {f.exposures} meal{f.exposures === 1 ? "" : "s"} so far, too few to say anything.</p>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">Based on your last 50 meals and symptoms.</p>
            </motion.div>
          )}

          {/* Symptom Frequency Chart */}
          {symptomChartData.length > 0 && (
            <motion.div variants={item} className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold">Symptom Frequency</h3>
              </div>
              <ResponsiveContainer width="100%" height={Math.max(120, symptomChartData.length * 32)}>
                <BarChart data={symptomChartData} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 11, fill: 'oklch(0.5 0.015 60)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={16}>
                    {symptomChartData.map((_, index) => (
                      <Cell key={index} fill={barColors[index % barColors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          )}

          {/* Sensitivity Distribution */}
          {meals.length > 0 && (
            <motion.div variants={item} className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-coral" />
                <h3 className="text-sm font-semibold">Sensitivity Distribution</h3>
              </div>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={120} height={120}>
                  <PieChart>
                    <Pie
                      data={fodmapData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={55}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="oklch(0.99 0.003 80)"
                    >
                      {fodmapData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 flex-1">
                  {fodmapData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: d.fill }} />
                        <span className="text-sm text-foreground">{d.name}</span>
                      </div>
                      <span className="text-sm font-mono font-medium">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {fodmapCounts.high > fodmapCounts.low
                  ? "You're consuming more high-sensitivity foods than low. Consider swapping some triggers."
                  : "Good balance! Most of your foods are low-sensitivity."}
              </p>
            </motion.div>
          )}

          {/* Weekly Trend */}
          {(meals.length > 0 || symptoms.length > 0) && (
            <motion.div variants={item} className="bg-primary/5 border border-primary/15 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-primary">Tracking Summary</h3>
              </div>
              <p className="text-sm text-foreground leading-relaxed">
                You've logged <strong>{meals.length} meals</strong> and <strong>{symptoms.length} symptoms</strong>.
                {triggers.length > 0
                  ? ` ${triggers.length} likely trigger${triggers.length === 1 ? '' : 's'} so far. Open one to see what it means.`
                  : ' Keep logging to see which foods stand out.'}
              </p>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}
