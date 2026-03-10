// GutSync AI — Symptoms Page
// Wired to real tRPC backend

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Watch, Plus, Heart, Moon, Brain, Activity, Loader2, Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSymptomEmoji, getSymptomLabel, formatTimeAgo } from "@/lib/store";

type SymptomType = "bloating" | "abdominal_pain" | "gas" | "nausea" | "fatigue" | "headache" | "diarrhea" | "constipation";

const SYMPTOM_OPTIONS: { type: SymptomType; emoji: string; label: string }[] = [
  { type: 'bloating', emoji: '🫧', label: 'Bloating' },
  { type: 'abdominal_pain', emoji: '⚡', label: 'Pain' },
  { type: 'gas', emoji: '💨', label: 'Gas' },
  { type: 'nausea', emoji: '🌊', label: 'Nausea' },
  { type: 'fatigue', emoji: '😴', label: 'Fatigue' },
  { type: 'headache', emoji: '🤕', label: 'Headache' },
  { type: 'diarrhea', emoji: '💧', label: 'Diarrhea' },
  { type: 'constipation', emoji: '🧱', label: 'Constipation' },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function Symptoms() {
  const { isAuthenticated } = useAuth();
  const [showLogger, setShowLogger] = useState(false);
  const [selectedType, setSelectedType] = useState<SymptomType | null>(null);
  const [severity, setSeverity] = useState(3);

  const symptomsQuery = trpc.symptoms.list.useQuery({ limit: 20 }, { enabled: isAuthenticated });
  const wearableQuery = trpc.wearable.recent.useQuery(undefined, { enabled: isAuthenticated });
  const logSymptom = trpc.symptoms.log.useMutation({
    onSuccess: () => {
      symptomsQuery.refetch();
    },
  });

  const symptoms = symptomsQuery.data ?? [];
  const wearableData = wearableQuery.data ?? [];
  const latestWearable = wearableData[0];

  const handleLogSymptom = () => {
    if (!selectedType) return;
    logSymptom.mutate(
      { type: selectedType, severity, source: "manual" },
      {
        onSuccess: () => {
          toast.success(`${getSymptomLabel(selectedType)} logged`, {
            description: `Severity ${severity}/5 — GutSync will check meals from the last 48 hours`,
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

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl tracking-tight">Symptoms</h1>
          <p className="text-sm text-muted-foreground mt-1">Track how you feel, we find the why</p>
        </div>
        <Button
          onClick={() => setShowLogger(!showLogger)}
          className="rounded-xl h-10 gap-2 bg-primary hover:bg-primary/90"
          size="sm"
        >
          <Plus className="w-4 h-4" />
          Log
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
              <p className="text-sm font-medium mb-3">What are you feeling?</p>
              <div className="grid grid-cols-4 gap-2 mb-4">
                {SYMPTOM_OPTIONS.map((opt) => (
                  <button
                    key={opt.type}
                    onClick={() => setSelectedType(opt.type)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                      selectedType === opt.type
                        ? 'border-primary bg-primary/5 shadow-sm'
                        : 'border-border/50 hover:border-primary/30'
                    }`}
                  >
                    <span className="text-xl">{opt.emoji}</span>
                    <span className="text-[10px] font-medium text-foreground">{opt.label}</span>
                  </button>
                ))}
              </div>

              {selectedType && (
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
                  <Button
                    className="w-full rounded-xl h-11 bg-primary hover:bg-primary/90"
                    onClick={handleLogSymptom}
                    disabled={logSymptom.isPending}
                  >
                    {logSymptom.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : null}
                    Log {getSymptomLabel(selectedType)}
                  </Button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wearable Data */}
      <motion.div variants={item} className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <Watch className="w-4 h-4 text-primary" />
          <p className="text-sm font-semibold">Wearable Insights</p>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ml-auto ${
            latestWearable ? 'text-sage-dark bg-sage-light/50' : 'text-muted-foreground bg-muted'
          }`}>
            {latestWearable ? 'Connected' : 'No data yet'}
          </span>
        </div>
        {latestWearable ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Heart className="w-3.5 h-3.5 text-coral" />
                <span className="text-[11px] text-muted-foreground">HRV</span>
              </div>
              <p className="text-xl font-mono font-medium">{latestWearable.hrv}<span className="text-xs text-muted-foreground ml-1">ms</span></p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {latestWearable.hrv > 50 ? 'Good recovery' : latestWearable.hrv > 35 ? 'Moderate stress' : 'Elevated stress'}
              </p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="w-3.5 h-3.5 text-primary" />
                <span className="text-[11px] text-muted-foreground">Heart Rate</span>
              </div>
              <p className="text-xl font-mono font-medium">{latestWearable.heartRate}<span className="text-xs text-muted-foreground ml-1">bpm</span></p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Resting</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Moon className="w-3.5 h-3.5 text-sage" />
                <span className="text-[11px] text-muted-foreground">Sleep Quality</span>
              </div>
              <p className="text-xl font-mono font-medium">{latestWearable.sleepQuality}<span className="text-xs text-muted-foreground ml-1">%</span></p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Last night</p>
            </div>
            <div className="bg-muted/50 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Brain className="w-3.5 h-3.5 text-sand-dark" />
                <span className="text-[11px] text-muted-foreground">Stress Level</span>
              </div>
              <p className="text-xl font-mono font-medium">{latestWearable.stressLevel}<span className="text-xs text-muted-foreground ml-1">%</span></p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {latestWearable.stressLevel < 30 ? 'Low' : latestWearable.stressLevel < 50 ? 'Moderate' : 'High'}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">Connect your Apple Watch or Garmin to see real-time health data</p>
          </div>
        )}
      </motion.div>

      {/* Loading */}
      {symptomsQuery.isLoading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Empty state */}
      {!symptomsQuery.isLoading && symptoms.length === 0 && (
        <motion.div variants={item} className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm text-center">
          <Leaf className="w-8 h-8 text-primary mx-auto mb-3" />
          <h3 className="font-display text-lg mb-1">No symptoms logged</h3>
          <p className="text-sm text-muted-foreground">
            Tap "Log" above to record a symptom. GutSync will correlate it with your recent meals.
          </p>
        </motion.div>
      )}

      {/* Symptom History */}
      {symptoms.length > 0 && (
        <motion.div variants={item}>
          <h2 className="text-lg mb-3">Symptom History</h2>
          <div className="space-y-2.5">
            {symptoms.map((sym) => (
              <motion.div
                key={sym.id}
                variants={item}
                className="bg-card rounded-xl p-4 border border-border/50 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getSymptomEmoji(sym.type)}</span>
                    <div>
                      <p className="text-sm font-medium">{getSymptomLabel(sym.type)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div
                              key={level}
                              className={`w-2 h-2 rounded-full ${
                                level <= sym.severity
                                  ? sym.severity <= 2 ? 'bg-sage' : sym.severity <= 3 ? 'bg-sand-dark' : 'bg-coral'
                                  : 'bg-muted'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[11px] text-muted-foreground">{sym.severity}/5</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-muted-foreground">{formatTimeAgo(sym.loggedAt)}</span>
                    {sym.source === 'wearable' && (
                      <div className="flex items-center gap-1 mt-1 justify-end">
                        <Watch className="w-3 h-3 text-primary" />
                        <span className="text-[10px] text-primary font-medium">Auto-detected</span>
                      </div>
                    )}
                  </div>
                </div>
                {sym.notes && (
                  <p className="text-xs text-muted-foreground mt-2 pl-11">{sym.notes}</p>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
