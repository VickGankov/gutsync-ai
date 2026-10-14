// Log: meals and symptoms together in one day-by-day timeline.
// Wired to real tRPC backend

import { invalidateToday } from "@/lib/invalidateToday";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Watch, Plus, Heart, Moon, Brain, Activity, Loader2, Leaf, Smile, Zap } from "lucide-react";
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

export default function Log() {
  const { isAuthenticated } = useAuth();
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
  const days = groupTimeline(
    [
      ...meals.map(meal => ({ kind: "meal" as const, at: meal.loggedAt, meal })),
      ...symptoms.map(symptom => ({ kind: "symptom" as const, at: symptom.loggedAt, symptom })),
    ],
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
    <motion.div variants={container} initial="hidden" animate="show" className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl tracking-tight">Log</h1>
          <p className="text-sm text-muted-foreground mt-1">Meals and how you felt, day by day</p>
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
          <h3 className="font-display text-lg mb-1">Nothing logged yet</h3>
          <p className="text-sm text-muted-foreground">
            Tap the camera to log a meal, or "Symptom" above to track how you feel. GutSync will connect the two.
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
                return (
                  <MealTile
                    key={`meal-${entry.meal.id}`}
                    meal={entry.meal}
                    onSaved={() => invalidateToday(utils)}
                    onDeleted={() => invalidateToday(utils)}
                  />
                );
              }
              const sym = entry.symptom;
              const isPositive = POSITIVE_OUTCOMES.some(o => o.type === sym.type);
              return (
                <motion.div
                  key={`sym-${sym.id}`}
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
