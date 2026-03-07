// GutSync AI — Home Dashboard
// Wired to real tRPC backend

import { motion } from "framer-motion";
import { TrendingUp, Sparkles, ChevronRight, Leaf, Clock, LogIn } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { formatTimeAgo, getSymptomEmoji, getSymptomLabel } from "@/lib/store";
import type { FoodItem } from "@/lib/store";

const HERO_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310419663031724495/Aye9Tq4ostcsrtEqbKqav7/gutsync-hero-Pvw9osKZy8TFVwjYfuzJB7.webp";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

export default function Home() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const dashboard = trpc.insights.dashboard.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  // Show login prompt if not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="px-4 pt-6 pb-4 max-w-lg mx-auto">
        <motion.div variants={item} className="rounded-2xl overflow-hidden mb-6 relative">
          <img src={HERO_IMG} alt="GutSync AI" className="w-full h-48 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-white text-xl font-display">GutSync AI</h1>
            <p className="text-white/80 text-sm">Your invisible gut health detective</p>
          </div>
        </motion.div>
        <motion.div variants={item} className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm text-center">
          <Leaf className="w-10 h-10 text-primary mx-auto mb-3" />
          <h2 className="text-lg font-display mb-2">Sign in to start tracking</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Take a photo of your meal and let AI detect hidden triggers, track symptoms, and discover patterns.
          </p>
          <a href={getLoginUrl()}>
            <Button className="rounded-xl h-12 px-8 bg-primary hover:bg-primary/90 gap-2">
              <LogIn className="w-4 h-4" />
              Sign In
            </Button>
          </a>
        </motion.div>
      </motion.div>
    );
  }

  const data = dashboard.data;
  const score = data?.gutHealthScore ?? 0;
  const streakDays = data?.streakDays ?? 0;
  const recentMeals = data?.recentMeals ?? [];
  const recentSymptoms = data?.recentSymptoms ?? [];
  const topCorrelation = data?.topCorrelation;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <motion.div variants={item} className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-muted-foreground">{greeting}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}</p>
          <h1 className="text-2xl tracking-tight mt-0.5">Your Gut Today</h1>
        </div>
        <div className="w-10 h-10 rounded-full bg-sage-light/60 flex items-center justify-center">
          <Leaf className="w-5 h-5 text-sage-dark" />
        </div>
      </motion.div>

      {/* Hero Illustration */}
      <motion.div variants={item} className="rounded-2xl overflow-hidden mb-6 relative">
        <img src={HERO_IMG} alt="GutSync AI" className="w-full h-40 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4">
          <p className="text-white/90 text-xs font-medium">Your invisible gut health detective</p>
        </div>
      </motion.div>

      {/* Gut Health Score */}
      <motion.div variants={item} className="bg-card rounded-2xl p-5 border border-border/50 shadow-sm mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Gut Health Score</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-4xl font-display text-foreground">{score}</span>
              <span className="text-sm text-muted-foreground">/100</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-sage-light/50 text-sage-dark px-3 py-1.5 rounded-full">
            <TrendingUp className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold">{score >= 70 ? 'Good' : score >= 50 ? 'Improving' : 'Needs attention'}</span>
          </div>
        </div>
        <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, oklch(0.7 0.12 25), oklch(0.65 0.08 80), oklch(0.55 0.1 155))' }}
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-muted-foreground">{streakDays > 0 ? `${streakDays}-day tracking streak` : 'Start tracking to build a streak'}</span>
          <span className="text-[11px] text-sage-dark font-medium">{data?.totalMeals ?? 0} meals logged</span>
        </div>
      </motion.div>

      {/* Latest AI Discovery */}
      {topCorrelation && (
        <motion.div variants={item}>
          <Link href="/insights">
            <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 mb-4 cursor-pointer hover:bg-primary/8 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">Discovery</p>
                    <span className="text-[10px] text-muted-foreground">{formatTimeAgo(topCorrelation.discoveredAt)}</span>
                  </div>
                  <p className="text-sm font-medium text-foreground mt-1 leading-snug">
                    {topCorrelation.trigger} → {topCorrelation.symptom}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {topCorrelation.recommendation}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {/* Empty state */}
      {recentMeals.length === 0 && recentSymptoms.length === 0 && (
        <motion.div variants={item} className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm text-center mb-4">
          <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
          <h3 className="font-display text-lg mb-1">Start tracking</h3>
          <p className="text-sm text-muted-foreground">
            Tap the camera button below to log your first meal. The AI will analyze it for FODMAP triggers and hidden ingredients.
          </p>
        </motion.div>
      )}

      {/* Recent Meals */}
      {recentMeals.length > 0 && (
        <motion.div variants={item} className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg">Recent Meals</h2>
            <Link href="/food">
              <span className="text-xs text-primary font-medium">View all</span>
            </Link>
          </div>
          <div className="space-y-2.5">
            {recentMeals.map((meal) => {
              const foods = (meal.foods ?? []) as FoodItem[];
              return (
                <motion.div
                  key={meal.id}
                  variants={item}
                  className="bg-card rounded-xl p-3 border border-border/50 shadow-sm flex items-center gap-3"
                >
                  {meal.photoUrl ? (
                    <img src={meal.photoUrl} alt={meal.mealType} className="w-14 h-14 rounded-lg object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-sage-light/40 flex items-center justify-center">
                      <Leaf className="w-6 h-6 text-sage-dark" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium capitalize">{meal.mealType}</span>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTimeAgo(meal.loggedAt)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {foods.map((f: FoodItem) => f.name).join(', ')}
                    </p>
                    <div className="flex gap-1 mt-1">
                      {foods.some((f: FoodItem) => f.fodmap === 'high') && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-coral-light/50 text-coral">
                          High FODMAP
                        </span>
                      )}
                      {foods.every((f: FoodItem) => f.fodmap === 'low') && (
                        <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sage-light/50 text-sage-dark">
                          Low FODMAP
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Recent Symptoms */}
      {recentSymptoms.length > 0 && (
        <motion.div variants={item} className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg">Recent Symptoms</h2>
            <Link href="/symptoms">
              <span className="text-xs text-primary font-medium">View all</span>
            </Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1">
            {recentSymptoms.map((sym) => (
              <div
                key={sym.id}
                className="bg-card rounded-xl p-3 border border-border/50 shadow-sm min-w-[130px] shrink-0"
              >
                <div className="text-2xl mb-1">{getSymptomEmoji(sym.type)}</div>
                <p className="text-sm font-medium">{getSymptomLabel(sym.type)}</p>
                <div className="flex items-center gap-1 mt-1">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map((level) => (
                      <div
                        key={level}
                        className={`w-2 h-2 rounded-full ${level <= sym.severity ? 'bg-coral' : 'bg-muted'}`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">{formatTimeAgo(sym.loggedAt)}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
