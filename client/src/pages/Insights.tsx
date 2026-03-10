// GutSync AI — Insights Page
// Wired to real tRPC backend

import { motion } from "framer-motion";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, ArrowRight, BarChart3, Loader2, Leaf, RefreshCw } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getSymptomLabel } from "@/lib/store";
import type { FoodItem } from "@/lib/store";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import { toast } from "sonner";

const INSIGHTS_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310419663031724495/Aye9Tq4ostcsrtEqbKqav7/gutsync-insights-am9czTKGxiACTgufFfNQec.webp";

const barColors = ['oklch(0.7 0.12 25)', 'oklch(0.55 0.1 155)', 'oklch(0.75 0.04 80)', 'oklch(0.65 0.08 80)'];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

interface CorrelationData {
  id: number;
  trigger: string;
  symptom: string;
  confidence: number;
  occurrences: number;
  description: string;
  recommendation: string;
  discoveredAt: number;
}

function CorrelationCard({ correlation }: { correlation: CorrelationData }) {
  const [expanded, setExpanded] = useState(false);

  const confidenceColor =
    correlation.confidence >= 80 ? 'text-coral' :
    correlation.confidence >= 60 ? 'text-sand-dark' : 'text-sage-dark';

  const confidenceBg =
    correlation.confidence >= 80 ? 'bg-coral-light/40' :
    correlation.confidence >= 60 ? 'bg-sand/60' : 'bg-sage-light/40';

  return (
    <motion.div
      variants={item}
      className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${confidenceBg} flex items-center justify-center shrink-0`}>
            <span className={`text-sm font-bold font-mono ${confidenceColor}`}>{correlation.confidence}%</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{correlation.trigger}</span>
              <ArrowRight className="w-3 h-3 text-muted-foreground" />
              <span className="text-sm font-medium text-coral">{correlation.symptom}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {correlation.occurrences} occurrences detected
            </p>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-xs text-primary font-medium hover:underline"
        >
          {expanded ? 'Show less' : 'See details & recommendation'}
        </button>

        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-3 space-y-3"
          >
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-xs text-foreground leading-relaxed">{correlation.description}</p>
            </div>
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-3 flex gap-2">
              <Lightbulb className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-primary mb-1">Recommendation</p>
                <p className="text-xs text-foreground leading-relaxed">{correlation.recommendation}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default function Insights() {
  const { isAuthenticated } = useAuth();
  const correlationsQuery = trpc.insights.correlations.useQuery(undefined, { enabled: isAuthenticated });
  const mealsQuery = trpc.meals.list.useQuery({ limit: 50 }, { enabled: isAuthenticated });
  const symptomsQuery = trpc.symptoms.list.useQuery({ limit: 50 }, { enabled: isAuthenticated });
  const runAnalysis = trpc.insights.runAnalysis.useMutation({
    onSuccess: (result) => {
      correlationsQuery.refetch();
      toast.success(`Analysis complete`, {
        description: `Found ${result.correlationsFound} correlation${result.correlationsFound === 1 ? '' : 's'}`,
      });
    },
    onError: () => {
      toast.error("Analysis failed. Try again after logging more meals and symptoms.");
    },
  });

  const correlations = (correlationsQuery.data ?? []) as CorrelationData[];
  const meals = mealsQuery.data ?? [];
  const symptoms = symptomsQuery.data ?? [];

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

  const isLoading = correlationsQuery.isLoading || mealsQuery.isLoading || symptomsQuery.isLoading;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl tracking-tight">Insights</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-powered correlations from your data</p>
        </div>
        <Button
          onClick={(e) => { e.stopPropagation(); runAnalysis.mutate(); }}
          disabled={runAnalysis.isPending || !isAuthenticated}
          className="rounded-xl h-10 gap-2 bg-primary hover:bg-primary/90 relative z-10"
          size="sm"
        >
          {runAnalysis.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {runAnalysis.isPending ? "Analyzing…" : "Analyze"}
        </Button>
      </motion.div>

      {/* Insights Hero */}
      <motion.div variants={item} className="rounded-2xl overflow-hidden mb-6 relative">
        <img src={INSIGHTS_IMG} alt="Insights visualization" className="w-full h-32 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent flex items-center">
          <div className="px-5">
            <p className="text-white text-sm font-medium">Pattern Recognition</p>
            <p className="text-white/70 text-xs mt-1">
              Analyzing {meals.length} meals and {symptoms.length} symptoms
            </p>
          </div>
        </div>
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
              <h2 className="text-lg">Discovered Triggers</h2>
            </div>
            {correlations.length > 0 ? (
              <div className="space-y-3">
                {correlations.map((c: CorrelationData) => (
                  <CorrelationCard key={c.id} correlation={c} />
                ))}
              </div>
            ) : (
              <div className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm text-center">
                <Leaf className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-display text-lg mb-1">No patterns yet</h3>
                <p className="text-sm text-muted-foreground">
                  Log at least 3 meals and 2 symptoms, then tap "Analyze" to discover food-symptom correlations.
                </p>
              </div>
            )}
          </motion.div>

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

          {/* FODMAP Distribution */}
          {meals.length > 0 && (
            <motion.div variants={item} className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-4 h-4 text-coral" />
                <h3 className="text-sm font-semibold">FODMAP Distribution</h3>
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
                  ? "You're consuming more high-FODMAP foods than low. Consider swapping some triggers."
                  : "Good balance! Most of your foods are low-FODMAP."}
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
                {correlations.length > 0
                  ? ` The AI has discovered ${correlations.length} trigger pattern${correlations.length === 1 ? '' : 's'}. Review the recommendations above to improve your gut health.`
                  : ' Keep logging to help the AI discover food-symptom patterns.'}
              </p>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
}
