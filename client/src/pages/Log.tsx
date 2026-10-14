// Log: Food and Symptoms tabs, day by day. Each meal shows the symptoms that followed it,
// and each symptom shows the meal it followed (see shared/timeline.ts).

import { invalidateToday } from "@/lib/invalidateToday";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { attributeSymptoms, formatGap } from "@shared/timeline";
import { Plus, Loader2, Leaf, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import SeverityBubble from "@/components/SeverityBubble";
import MealTile from "@/components/MealTile";
import type { FoodItem } from "@/lib/store";
import { getSymptomEmoji, getSymptomLabel, formatTimeAgo } from "@/lib/store";

type SymptomType = "bloating" | "abdominal_pain" | "gas" | "nausea" | "fatigue" | "headache" | "diarrhea" | "constipation" | "acid_reflux" | "vomiting" | "low_appetite" | "energy_boost" | "better_digestion" | "improved_mood" | "better_sleep" | "clearer_skin" | "reduced_brain_fog";

const NEGATIVE_SYMPTOMS: { type: SymptomType; emoji: string; label: string }[] = [
  { type: 'bloating', emoji: '🫧', label: 'Bloating' },
  { type: 'abdominal_pain', emoji: '⚡', label: 'Pain' },
  { type: 'gas', emoji: '💨', label: 'Gas' },
  { type: 'nausea', emoji: '🌊', label: 'Nausea' },
  { type: 'fatigue', emoji: '😴', label: 'Fatigue' },
  { type: 'headache', emoji: '🤕', label: 'Headache' },
  { type: 'diarrhea', emoji: '💧', label: 'Diarrhea' },
  { type: 'constipation', emoji: '🧱', label: 'Constipation' },
  { type: 'acid_reflux', emoji: '🔥', label: 'Reflux' },
  { type: 'vomiting', emoji: '🤮', label: 'Vomiting' },
  { type: 'low_appetite', emoji: '🍽️', label: 'Low Appetite' },
];

const POSITIVE_OUTCOMES: { type: SymptomType; emoji: string; label: string }[] = [
  { type: 'energy_boost', emoji: '⚡', label: 'Energy Boost' },
  { type: 'better_digestion', emoji: '✨', label: 'Better Digestion' },
  { type: 'improved_mood', emoji: '😊', label: 'Improved Mood' },
  { type: 'better_sleep', emoji: '😴', label: 'Better Sleep' },
  { type: 'clearer_skin', emoji: '🌟', label: 'Clearer Skin' },
  { type: 'reduced_brain_fog', emoji: '🧠', label: 'Reduced Brain Fog' },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

type Entry =
  | { kind: "meal"; at: number; meal: { id: number; photoUrl: string | null; mealType: "breakfast" | "lunch" | "dinner" | "snack"; foods: FoodItem[]; loggedAt: number; notes: string | null } }
  | { kind: "symptom"; at: number; symptom: { id: number; type: string; severity: number; loggedAt: number } };

/** Newest first, grouped under Today / Yesterday / weekday headings. */
function groupTimeline(entries: Entry[]): Array<[string, Entry[]]> {
  const now = new Date();
  const todayStr = now.toDateString();
  const yesterdayStr = new Date(now.getTime() - 86400000).toDateString();
  const groups = new Map<string, Entry[]>();
  [...entries].sort((a, b) => b.at - a.at).forEach(e => {
    const d = new Date(e.at);
    const key = d.toDateString();
    const label = key === todayStr ? "Today" : key === yesterdayStr ? "Yesterday"
      : d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    groups.set(label, [...(groups.get(label) ?? []), e]);
  });
  return Array.from(groups.entries());
}

type Tab = "food" | "symptoms";
const TAB_KEY = "gutsync_log_tab";

function readTab(search: string): Tab {
  const fromUrl = new URLSearchParams(search).get("tab");
  if (fromUrl === "food" || fromUrl === "symptoms") return fromUrl;
  try {
    const saved = localStorage.getItem(TAB_KEY);
    if (saved === "food" || saved === "symptoms") return saved;
  } catch { /* storage unavailable */ }
  return "food";
}

/** Symptom chip under a meal. Bigger and warmer the more severe it was, so the strip isn't uniform. */
function FollowUpChip({ type, severity, afterMs, positive }: { type: string; severity: number; afterMs: number; positive: boolean }) {
  const size = positive || severity <= 2 ? "text-[10px] px-2 py-0.5" : severity === 3 ? "text-[11px] px-2.5 py-1" : "text-xs px-3 py-1.5 font-medium";
  const tone = positive ? "bg-sage-light/50 text-sage-dark"
    : severity <= 2 ? "bg-muted text-muted-foreground"
    : severity === 3 ? "bg-sand/60 text-foreground"
    : "bg-coral-light/50 text-coral";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full ${size} ${tone}`}>
      <span>{getSymptomEmoji(type)}</span>
      <span>{getSymptomLabel(type)}{!positive && ` ${severity}/5`}</span>
      <span className="opacity-60">· {formatGap(afterMs, "later")}</span>
    </span>
  );
}

export default function Log() {
  const { isAuthenticated } = useAuth();
  const search = useSearch();
  const [tab, setTab] = useState<Tab>(() => readTab(search));
  useEffect(() => { setTab(readTab(search)); }, [search]);
  const switchTab = (t: Tab) => {
    setTab(t);
    try { localStorage.setItem(TAB_KEY, t); } catch { /* ignore */ }
  };
  const [showLogger, setShowLogger] = useState(false);
  const [logMode, setLogMode] = useState<'negative' | 'positive'>('negative');
  const [selectedType, setSelectedType] = useState<SymptomType | null>(null);
  const [severity, setSeverity] = useState(3);

  const symptomsQuery = trpc.symptoms.list.useQuery({ limit: 50 }, { enabled: isAuthenticated });
  const mealsQuery = trpc.meals.list.useQuery({ limit: 30 }, { enabled: isAuthenticated });

  const logSymptom = trpc.symptoms.log.useMutation({
    onSuccess: () => {
      symptomsQuery.refetch();
    },
  });

  const symptoms = symptomsQuery.data ?? [];
  const [editingId, setEditingId] = useState<number | null>(null);
  const editing = symptoms.find(s => s.id === editingId) ?? null;
  const utils = trpc.useUtils();

  const refreshAll = () => {
    symptomsQuery.refetch();
    invalidateToday(utils);
  };
  const updateSymptom = trpc.symptoms.update.useMutation({
    onSuccess: () => { refreshAll(); setEditingId(null); toast.success("Updated"); },
    onError: () => toast.error("Failed to update"),
  });
  const deleteSymptom = trpc.symptoms.delete.useMutation({
    onSuccess: () => { refreshAll(); setEditingId(null); toast.success("Deleted"); },
    onError: () => toast.error("Failed to delete"),
  });


  const meals = (mealsQuery.data ?? []) as Array<{
    id: number; photoUrl: string | null; mealType: "breakfast" | "lunch" | "dinner" | "snack";
    foods: FoodItem[]; loggedAt: number; notes: string | null;
  }>;
  const { byMeal, bySymptom } = attributeSymptoms(meals, symptoms);
  const days = groupTimeline(
    tab === "food"
      ? meals.map(meal => ({ kind: "meal" as const, at: meal.loggedAt, meal }))
      : symptoms.map(symptom => ({ kind: "symptom" as const, at: symptom.loggedAt, symptom })),
  );

  const handleLogSymptom = () => {
    if (!selectedType) return;
    logSymptom.mutate(
      { type: selectedType, severity, source: "manual" },
      {
        onSuccess: () => {
          const label = getSymptomLabel(selectedType);
          const isPositive = POSITIVE_OUTCOMES.some((o) => o.type === selectedType);
          toast.success(`${label} logged`, {
            description: isPositive 
              ? `Great! We'll track which foods contribute to this.`
              : `Severity ${severity}/5 — GutSync will check meals from the last 48 hours`,
          });
          setShowLogger(false);
          setSelectedType(null);
          setSeverity(3);
        },
        onError: () => {
          toast.error("Failed to log symptom");
        },
      }
    );
  };

  const isPositiveOutcome = selectedType && (selectedType.includes('energy') || selectedType.includes('better') || selectedType.includes('improved') || selectedType.includes('clearer') || selectedType.includes('reduced'));

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl tracking-tight">Log</h1>
          <p className="text-sm text-muted-foreground mt-1">{tab === "food" ? "What you ate, and how you felt after" : "How you felt, and what came before"}</p>
        </div>
        <Button
          onClick={() => setShowLogger(!showLogger)}
          className="rounded-xl h-10 gap-2 bg-primary hover:bg-primary/90"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          Symptom
        </Button>
      </motion.div>

      {/* Food / Symptoms switch */}
      <motion.div variants={item} className="flex p-1 mb-5 rounded-2xl bg-muted/70">
        {([["food", "Food"], ["symptoms", "Symptoms"]] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => switchTab(key)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
              tab === key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </motion.div>

      {/* Quick Log Panel */}
      <AnimatePresence>
        {showLogger && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden mb-5"
          >
            <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5">
              {/* Mode Selector */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => { setLogMode('negative'); setSelectedType(null); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    logMode === 'negative'
                      ? 'bg-coral/10 border border-coral text-coral'
                      : 'bg-muted border border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  😟 Symptoms
                </button>
                <button
                  onClick={() => { setLogMode('positive'); setSelectedType(null); }}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                    logMode === 'positive'
                      ? 'bg-sage-light/50 border border-sage text-sage-dark'
                      : 'bg-muted border border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  😊 Positive
                </button>
              </div>

              <p className="text-sm font-medium mb-3">
                {logMode === 'negative' ? 'What symptoms are you experiencing?' : 'What positive changes did you notice?'}
              </p>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {(logMode === 'negative' ? NEGATIVE_SYMPTOMS : POSITIVE_OUTCOMES).map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => setSelectedType(opt.type)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                      selectedType === opt.type
                        ? logMode === 'negative'
                          ? 'border-coral bg-coral/5 shadow-sm'
                          : 'border-sage bg-sage-light/30 shadow-sm'
                        : 'border-border/50 hover:border-primary/30'
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <span className="text-[10px] font-medium text-foreground text-center leading-tight">{opt.label}</span>
                  </button>
                ))}
              </div>

              {selectedType && logMode === 'negative' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <p className="text-sm font-medium mb-2">How severe?</p>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-xs text-muted-foreground">Mild</span>
                    <div className="flex gap-2 flex-1 justify-center">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <button
                          key={level}
                          onClick={() => setSeverity(level)}
                          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-semibold transition-all ${
                            severity === level
                              ? level <= 2
                                ? 'border-sage bg-sage text-white'
                                : level <= 3
                                ? 'border-sand-dark bg-sand-dark text-white'
                                : 'border-coral bg-coral text-white'
                              : 'border-border text-muted-foreground hover:border-primary/30'
                          }`}
                        >
                          {level}
                        </button>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">Severe</span>
                  </div>
                </motion.div>
              )}

              {selectedType && (
                <Button
                  className={`w-full rounded-xl h-11 ${
                    logMode === 'positive'
                      ? 'bg-sage hover:bg-sage/90'
                      : 'bg-primary hover:bg-primary/90'
                  }`}
                  onClick={handleLogSymptom}
                  disabled={logSymptom.isPending}
                >
                  {logSymptom.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : null}
                  Log {getSymptomLabel(selectedType)}
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Loading */}
      {(symptomsQuery.isLoading || mealsQuery.isLoading) && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Empty state */}
      {!symptomsQuery.isLoading && !mealsQuery.isLoading && days.length === 0 && (
        <motion.div variants={item} className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm text-center">
          <Leaf className="w-8 h-8 text-primary mx-auto mb-3" />
          <h3 className="font-display text-lg mb-1">{tab === "food" ? "No meals logged yet" : "No symptoms logged yet"}</h3>
          <p className="text-sm text-muted-foreground">
            {tab === "food"
              ? "Tap the camera to log a meal. Symptoms you log afterwards will show up under it."
              : 'Tap "Symptom" above to track how you feel. Each one will show the meal that came before it.'}
          </p>
        </motion.div>
      )}

      {/* Timeline */}
      {days.map(([day, entries]) => (
        <motion.div key={day} variants={item} className="mb-5">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">{day}</h2>
          <div className="space-y-2.5">
            {entries.map((entry) => {
              if (entry.kind === "meal") {
                const followUps = byMeal.get(entry.meal.id) ?? [];
                return (
                  <div key={`meal-${entry.meal.id}`}>
                    <MealTile
                      meal={entry.meal}
                      onSaved={() => invalidateToday(utils)}
                      onDeleted={() => invalidateToday(utils)}
                    />
                    {followUps.length > 0 && (
                      <div className="ml-6 mt-1.5 pl-3 border-l-2 border-coral/25 flex flex-wrap items-center gap-1.5">
                        {followUps.map(({ symptom, afterMs }) => (
                          <FollowUpChip
                            key={symptom.id}
                            type={symptom.type}
                            severity={symptom.severity}
                            afterMs={afterMs}
                            positive={POSITIVE_OUTCOMES.some(o => o.type === symptom.type)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              const sym = entry.symptom;
              const isPositive = POSITIVE_OUTCOMES.some(o => o.type === sym.type);
              const before = bySymptom.get(sym.id);
              return (
                <div key={`sym-${sym.id}`}>
                <motion.div
                  onClick={() => setEditingId(sym.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setEditingId(sym.id)}
                  className={`rounded-xl p-4 border shadow-sm cursor-pointer active:scale-[0.99] transition-transform ${
                    isPositive ? 'bg-sage-light/20 border-sage/30' : 'bg-card border-border/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{getSymptomEmoji(sym.type)}</span>
                      <div>
                        <p className="font-medium text-foreground">{getSymptomLabel(sym.type)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(sym.loggedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{" · tap to edit"}
                        </p>
                      </div>
                    </div>
                    {!isPositive && (
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((level) => (
                          <div key={level} className={`w-2 h-2 rounded-full ${level <= sym.severity ? 'bg-coral' : 'bg-muted'}`} />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
                {before && (
                  <div className="ml-6 mt-1.5 pl-3 border-l-2 border-sage/30">
                    <span className="inline-flex items-center gap-1 rounded-full bg-sage-light/40 text-sage-dark text-[10px] px-2 py-0.5">
                      <UtensilsCrossed className="w-2.5 h-2.5" />
                      <span className="capitalize">{before.meal.mealType}</span>
                      <span className="opacity-70 truncate max-w-[11rem]">· {before.meal.foods.map(f => f.name).join(", ")}</span>
                      <span className="opacity-60">· {formatGap(before.afterMs, "earlier")}</span>
                    </span>
                  </div>
                )}
                </div>
              );
            })}
          </div>
        </motion.div>
      ))}

      <SeverityBubble
        open={!!editing}
        emoji={editing ? getSymptomEmoji(editing.type) : ""}
        label={editing ? getSymptomLabel(editing.type) : ""}
        current={editing?.severity}
        hideScale={!!editing && POSITIVE_OUTCOMES.some(o => o.type === editing.type)}
        busy={updateSymptom.isPending || deleteSymptom.isPending}
        onSelect={(level) => editing && updateSymptom.mutate({ id: editing.id, severity: level })}
        onDelete={() => editing && deleteSymptom.mutate({ id: editing.id })}
        onClose={() => setEditingId(null)}
      />
    </motion.div>
  );
}
