// Triggerplate — Home Dashboard
// Minimalistic design: tap meal tile to expand, clean edit/delete

import { invalidateToday } from "@/lib/invalidateToday";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Sparkles, ChevronRight, Leaf, Clock, LogIn,
  X, Check, Trash2, User, LogOut, Crown, Settings, Zap,
  MoreHorizontal, ChevronDown, Info,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import Avatar from "@/components/Avatar";
import { getLoginUrl } from "@/const";
import { formatTimeAgo, getSymptomEmoji, getSymptomLabel } from "@/lib/store";
import type { FoodItem } from "@/lib/store";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { getFODMAPExplanation } from "@/lib/fodmapExplanations";
import { isInAppBrowser } from "@/lib/browser";
import InAppBrowserWarning from "@/components/InAppBrowserWarning";
import SeverityBubble from "@/components/SeverityBubble";
import TodayCard from "@/components/TodayCard";
import InstallBanner from "@/components/InstallPrompt";
import MealTile from "@/components/MealTile";
import { REINTRO_GROUP_INFO, currentChallengeDay, type ReintroGroup } from "@shared/reintro";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

// ─── Quick Symptom Log Row ────────────────────────────────────────────────────
const QUICK_SYMPTOMS = [
  { type: "bloating" as const, emoji: "🫧", label: "Bloated" },
  { type: "abdominal_pain" as const, emoji: "😣", label: "Pain" },
  { type: "gas" as const, emoji: "💨", label: "Gas" },
  { type: "nausea" as const, emoji: "🤢", label: "Nausea" },
  { type: "fatigue" as const, emoji: "😴", label: "Tired" },
];

function QuickSymptomLog({ onLogged }: { onLogged: () => void }) {
  const [tapped, setTapped] = useState<string | null>(null);
  const utils = trpc.useUtils();

  const logSymptom = trpc.symptoms.log.useMutation({
    onSuccess: (_, vars) => {
      invalidateToday(utils);
      toast.success(`${getSymptomLabel(vars.type)} logged · severity ${vars.severity}/5`);
      setTapped(null);
      onLogged();
    },
    onError: () => {
      setTapped(null);
      toast.error("Failed to log symptom");
    },
  });

  const picking = QUICK_SYMPTOMS.find(s => s.type === tapped) ?? null;

  const handleTap = (type: typeof QUICK_SYMPTOMS[0]["type"]) => {
    if (logSymptom.isPending) return;
    setTapped(type);
  };

  const handleSelect = (severity: number) => {
    if (!tapped || logSymptom.isPending) return;
    logSymptom.mutate({ type: tapped as typeof QUICK_SYMPTOMS[0]["type"], severity, source: "manual" });
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2.5">
        <Zap className="w-4 h-4 text-primary" />
        <p className="text-sm font-medium text-foreground">How are you feeling?</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {QUICK_SYMPTOMS.map(({ type, emoji, label }) => (
          <motion.button
            key={type}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleTap(type)}
            disabled={logSymptom.isPending}
            className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl border transition-all shrink-0 min-w-[64px] ${
              tapped === type
                ? "bg-primary/10 border-primary/30 scale-95"
                : "bg-card border-border/50 hover:bg-muted active:scale-95"
            }`}
          >
            <span className="text-xl leading-none">{emoji}</span>
            <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
          </motion.button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
        Tap a symptom, then pick how severe · Edit entries in the Log tab
      </p>
      <SeverityBubble
        open={!!picking}
        emoji={picking?.emoji ?? ""}
        label={picking?.label ?? ""}
        busy={logSymptom.isPending}
        onSelect={handleSelect}
        onClose={() => setTapped(null)}
      />
    </div>
  );
}

// ─── Profile Sheet ────────────────────────────────────────────────────────────
function ProfileSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const subStatus = trpc.subscription.status.useQuery(undefined, { enabled: !!user });

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl max-w-lg mx-auto"
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="px-5 pb-8 pt-3">
              <div className="flex items-center gap-4 mb-6">
                <Avatar user={user} size={56} />
                <div>
                  <p className="font-display text-lg">{user?.name ?? "Guest"}</p>
                  <p className="text-sm text-muted-foreground">{user?.email ?? ""}</p>
                </div>
              </div>
              <div className={`flex items-center gap-3 rounded-2xl p-4 mb-5 ${
                (subStatus.data?.isPremium || subStatus.data?.isFounder || subStatus.data?.isTester)
                  ? "bg-amber-50 border border-amber-200"
                  : "bg-muted border border-border/50"
              }`}>
                <Crown className={`w-5 h-5 ${(subStatus.data?.isPremium || subStatus.data?.isFounder || subStatus.data?.isTester) ? "text-amber-500" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-semibold">
                    {subStatus.data?.isPremium ? "Triggerplate Premium" : subStatus.data?.isFounder ? "Founding member" : subStatus.data?.isTester ? "Beta tester" : "Free Plan"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {subStatus.data?.isPremium
                      ? "Labs, protocol and extra scans"
                      : (subStatus.data?.isFounder || subStatus.data?.isTester)
                        ? `All features · ${subStatus.data?.scansRemaining ?? 10} scans left today`
                        : `${subStatus.data?.scansRemaining ?? 10} scans remaining today`}
                  </p>
                </div>
                {!subStatus.data?.isPremium && !subStatus.data?.isFounder && !subStatus.data?.isTester && (
                  <Link href="/profile">
                    <button type="button" onClick={onClose} className="ml-auto text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
                      Upgrade
                    </button>
                  </Link>
                )}
              </div>
              <div className="space-y-1 mb-6">
                <Link href="/profile">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-muted transition-colors text-left"
                  >
                    <Settings className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Settings</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                  </button>
                </Link>
              </div>
              <button
                type="button"
                onClick={() => { logout(); onClose(); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Main Home Page ───────────────────────────────────────────────────────────
export default function Home() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [showInAppWarning, setShowInAppWarning] = useState(false);
  const [deletedIds, setDeletedIds] = useState<Set<number>>(new Set());

  const reintroQuery = trpc.reintro.list.useQuery(undefined, { enabled: isAuthenticated });
  const dashboard = trpc.insights.dashboard.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const handleSignIn = () => {
    if (isInAppBrowser()) {
      setShowInAppWarning(true);
    } else {
      window.location.href = getLoginUrl();
    }
  };

  const handleMealDeleted = useCallback((id: number) => {
    setDeletedIds((prev) => new Set(Array.from(prev).concat(id)));
  }, []);

  // Show login prompt if not authenticated
  if (!authLoading && !isAuthenticated) {
    return (
      <>
        <motion.div variants={container} initial="hidden" animate="show" className="px-4 pt-6 pb-4 max-w-lg mx-auto">
          <motion.div variants={item} className="rounded-2xl overflow-hidden mb-6 relative">
            <div className="h-48 bg-gradient-to-br from-sage-light via-sage-light/60 to-sand/50 flex flex-col items-center justify-center text-center px-6">
              <Leaf className="w-10 h-10 text-sage-dark mb-3" />
              <h1 className="text-foreground text-2xl font-display">Triggerplate</h1>
              <p className="text-muted-foreground text-sm mt-1">Discover your personal food triggers</p>
            </div>
          </motion.div>
          <motion.div variants={item} className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm text-center">
            <Leaf className="w-10 h-10 text-primary mx-auto mb-3" />
            <h2 className="text-lg font-display mb-2">Sign in to start tracking</h2>
            <p className="text-sm text-muted-foreground mb-5">
              Log your meals, track your symptoms, and discover which foods trigger your discomfort.
            </p>
            <Button
              onClick={handleSignIn}
              className="rounded-xl h-12 px-8 bg-primary hover:bg-primary/90 gap-2"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Button>
          </motion.div>
        </motion.div>

        {showInAppWarning && (
          <InAppBrowserWarning
            loginUrl={getLoginUrl()}
            onDismiss={() => setShowInAppWarning(false)}
          />
        )}
      </>
    );
  }

  if (dashboard.isLoading) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="px-4 pt-6 pb-4 max-w-lg mx-auto">
        <motion.div variants={item} className="mb-6">
          <p className="text-sm text-muted-foreground">{greeting}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}</p>
          <h1 className="text-2xl tracking-tight mt-0.5">Your Gut Today</h1>
        </motion.div>
        <motion.div variants={item} className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
          <p className="text-sm text-muted-foreground">Loading your latest meals, symptoms, and insights...</p>
        </motion.div>
      </motion.div>
    );
  }

  if (dashboard.error) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="px-4 pt-6 pb-4 max-w-lg mx-auto">
        <motion.div variants={item} className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm">
          <h2 className="text-lg font-display mb-2">We couldn't load your dashboard</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Please check your connection and try again.
          </p>
          <Button onClick={() => dashboard.refetch()} className="rounded-xl">
            Retry
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  const data = dashboard.data;
  const score = data?.gutHealthScore ?? 0;
  const streakDays = data?.streakDays ?? 0;
  const allRecentMeals = (data?.recentMeals ?? []) as Array<{
    id: number;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
    photoUrl?: string | null;
    loggedAt: number;
    foods: FoodItem[];
    notes?: string | null;
  }>;
  const recentMeals = allRecentMeals.filter((m) => !deletedIds.has(m.id));
  const recentSymptoms = data?.recentSymptoms ?? [];
  const topCorrelation = data?.topCorrelation;

  return (
    <>
      <motion.div variants={container} initial="hidden" animate="show" className="px-4 pt-6 pb-4 max-w-lg mx-auto">
        {/* Header */}
        <motion.div variants={item} className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-muted-foreground">
              {greeting}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
            </p>
            <h1 className="text-2xl tracking-tight mt-0.5">Your Gut Today</h1>
          </div>
          <button
            type="button"
            onClick={() => setProfileOpen(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-90 active:scale-95"
            aria-label="Open profile"
          >
            <Avatar user={user} size={40} />
          </button>
        </motion.div>

        <motion.div variants={item}><InstallBanner /></motion.div>

        {(() => {
          const active = reintroQuery.data?.find(c => c.status === "active");
          if (!active) return null;
          const info = REINTRO_GROUP_INFO[active.foodGroup as ReintroGroup];
          const day = Math.min(3, currentChallengeDay(active.startedAt, Date.now(), new Date().getTimezoneOffset()));
          const doses = active.doses as string[];
          const pending = (active.checkIns ?? []).length < day;
          return (
            <motion.div variants={item} className="mb-4">
              <Link href="/reintro">
                <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Reintroduction · Day {day} of 3</p>
                    <p className="text-sm font-medium">{info?.emoji} {doses[day - 1]} {active.testFood}</p>
                  </div>
                  <span className="text-xs font-semibold text-primary">{pending ? "Check in →" : "View →"}</span>
                </div>
              </Link>
            </motion.div>
          );
        })()}

        <motion.div variants={item}>
          <TodayCard
            meals={allRecentMeals.filter((m) => !deletedIds.has(m.id))}
            symptoms={recentSymptoms}
            reintroCheckInPending={(() => {
              const active = reintroQuery.data?.find(c => c.status === "active");
              if (!active) return false;
              const day = Math.min(3, currentChallengeDay(active.startedAt, Date.now(), new Date().getTimezoneOffset()));
              return (active.checkIns ?? []).length < day;
            })()}
          />
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
              <span className="text-xs font-semibold">
                {score >= 70 ? "Good" : score >= 50 ? "Improving" : "Needs attention"}
              </span>
            </div>
          </div>
          <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${score}%` }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
              className="h-full rounded-full"
              style={{
                background: "linear-gradient(90deg, oklch(0.7 0.12 25), oklch(0.65 0.08 80), oklch(0.55 0.1 155))",
              }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-muted-foreground">
              {streakDays > 0 ? `${streakDays}-day tracking streak` : "Start tracking to build a streak"}
            </span>
            <span className="text-[11px] text-sage-dark font-medium">
              {data?.totalMeals ?? 0} meals logged
            </span>
          </div>
        </motion.div>

        {/* Quick Symptom Log */}
        <motion.div variants={item}>
          <QuickSymptomLog onLogged={() => dashboard.refetch()} />
        </motion.div>

        {/* Latest Discovery */}
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
                      <span className="text-[10px] text-muted-foreground">
                        {formatTimeAgo(topCorrelation.discoveredAt)}
                      </span>
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
          <motion.div
            variants={item}
            className="bg-card rounded-2xl p-6 border border-border/50 shadow-sm text-center mb-4"
          >
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-3" />
            <h3 className="font-display text-lg mb-1">Start tracking</h3>
            <p className="text-sm text-muted-foreground">
              Tap the camera button below to log your first meal. Triggerplate will help identify food triggers and hidden ingredients.
            </p>
          </motion.div>
        )}

        {/* Recent Meals — tap to expand */}
        {recentMeals.length > 0 && (
          <motion.div variants={item} className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg">Recent Meals</h2>
              <Link href="/log">
                <span className="text-xs text-primary font-medium">View all</span>
              </Link>
            </div>
            <div className="space-y-2.5">
              <AnimatePresence>
                {recentMeals.map((meal, idx) => (
                  <MealTile
                    key={`${meal.id}-${idx}`}
                    meal={meal}
                    onSaved={() => dashboard.refetch()}
                    onDeleted={handleMealDeleted}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {/* Recent Symptoms */}
        {recentSymptoms.length > 0 && (
          <motion.div variants={item} className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg">Recent Symptoms</h2>
              <Link href="/log">
                <span className="text-xs text-primary font-medium">View all</span>
              </Link>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1">
              {recentSymptoms.map((sym, idx) => (
                <div
                  key={`${sym.id}-${idx}`}
                  className="bg-card rounded-xl p-3 border border-border/50 shadow-sm min-w-[130px] shrink-0"
                >
                  <div className="text-2xl mb-1">{getSymptomEmoji(sym.type)}</div>
                  <p className="text-sm font-medium">{getSymptomLabel(sym.type)}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((level) => (
                        <div
                          key={level}
                          className={`w-2 h-2 rounded-full ${level <= sym.severity ? "bg-coral" : "bg-muted"}`}
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

      {/* Profile Sheet */}
      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}
