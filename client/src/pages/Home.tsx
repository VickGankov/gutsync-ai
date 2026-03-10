// GutSync — Home Dashboard
// Minimalistic design: tap meal tile to expand, clean edit/delete

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
import { getLoginUrl } from "@/const";
import { formatTimeAgo, getSymptomEmoji, getSymptomLabel } from "@/lib/store";
import type { FoodItem } from "@/lib/store";
import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { getFODMAPExplanation } from "@/lib/fodmapExplanations";
import { isInAppBrowser } from "@/lib/browser";
import InAppBrowserWarning from "@/components/InAppBrowserWarning";

const HERO_IMG =
  "https://d2xsxph8kpxj0f.cloudfront.net/310419663031724495/Aye9Tq4ostcsrtEqbKqav7/gutsync-hero-Pvw9osKZy8TFVwjYfuzJB7.webp";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

// ─── Minimalistic Meal Tile ─────────────────────────────────────────────────
function MealTile({ meal, onSaved, onDeleted }: {
  meal: {
    id: number;
    mealType: "breakfast" | "lunch" | "dinner" | "snack";
    photoUrl?: string | null;
    loggedAt: number;
    foods: FoodItem[];
    notes?: string | null;
  };
  onSaved: () => void;
  onDeleted: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [mealType, setMealType] = useState(meal.mealType);
  const [foods, setFoods] = useState<FoodItem[]>(meal.foods);
  const [newFood, setNewFood] = useState("");
  const [showExplanation, setShowExplanation] = useState<string | null>(null);
  const [notes, setNotes] = useState(meal.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const updateMealMut = trpc.meals.update.useMutation({
    onSuccess: () => {
      utils.insights.dashboard.invalidate();
      utils.meals.list.invalidate();
      setEditing(false);
      setExpanded(false);
      toast.success("Meal updated");
      onSaved();
    },
    onError: () => toast.error("Failed to save changes"),
  });

  const deleteMealMut = trpc.meals.delete.useMutation({
    onSuccess: () => {
      utils.insights.dashboard.invalidate();
      utils.meals.list.invalidate();
      onDeleted(meal.id);
    },
    onError: () => toast.error("Failed to delete meal"),
  });

  const handleSave = useCallback(() => {
    const sanitizedFoods = foods.map((f) => ({
      name: f.name,
      category: (f.category ?? "other") as FoodItem["category"],
      fodmap: f.fodmap as FoodItem["fodmap"],
      hiddenIngredients: f.hiddenIngredients ?? [],
    }));
    updateMealMut.mutate({ id: meal.id, mealType, foods: sanitizedFoods, notes });
  }, [foods, meal.id, mealType, notes, updateMealMut]);

  const handleCancel = useCallback(() => {
    setMealType(meal.mealType);
    setFoods(meal.foods);
    setNotes(meal.notes ?? "");
    setNewFood("");
    setEditing(false);
  }, [meal]);

  const handleDelete = useCallback(() => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDeleted(meal.id);
    deleteMealMut.mutate({ id: meal.id });
    toast.success("Meal deleted");
  }, [confirmDelete, deleteMealMut, meal.id, onDeleted]);

  const addFood = useCallback(() => {
    const name = newFood.trim();
    if (!name) return;
    setFoods((prev) => [
      ...prev,
      { name, category: "other" as const, fodmap: "moderate" as const, hiddenIngredients: [] },
    ]);
    setNewFood("");
    inputRef.current?.focus();
  }, [newFood]);

  const removeFood = useCallback((idx: number) => {
    setFoods((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const cycleFodmap = useCallback((idx: number) => {
    const cycle: FoodItem["fodmap"][] = ["low", "moderate", "high"];
    setFoods((prev) =>
      prev.map((f, i) =>
        i === idx
          ? { ...f, fodmap: cycle[(cycle.indexOf(f.fodmap) + 1) % cycle.length] }
          : f
      )
    );
  }, []);

  const fodmapColor = (level: string) => {
    if (level === "high") return "bg-coral-light/60 text-coral";
    if (level === "moderate") return "bg-amber-100 text-amber-700";
    return "bg-sage-light/60 text-sage-dark";
  };

  const highFodmap = foods.some((f) => f.fodmap === "high");
  const allLow = foods.length > 0 && foods.every((f) => f.fodmap === "low");

  // Reset confirm delete when tile collapses
  useEffect(() => {
    if (!expanded) setConfirmDelete(false);
  }, [expanded]);

  return (
    <motion.div
      layout
      variants={item}
      className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden"
    >
      {/* Collapsed view — tap to expand */}
      <button
        type="button"
        onClick={() => {
          if (!editing) setExpanded((prev) => !prev);
        }}
        className="w-full text-left p-3 flex items-center gap-3"
      >
        {meal.photoUrl ? (
          <img
            src={meal.photoUrl}
            alt={mealType}
            className="w-12 h-12 rounded-xl object-cover shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-sage-light/40 flex items-center justify-center shrink-0">
            <Leaf className="w-5 h-5 text-sage-dark" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium capitalize">{mealType}</span>
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimeAgo(meal.loggedAt)}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {foods.map((f) => f.name).join(", ")}
          </p>
          {(highFodmap || allLow) && (
            <div className="flex gap-1 mt-1">
              {highFodmap && (
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-coral-light/50 text-coral">
                  High sensitivity
                </span>
              )}
              {allLow && (
                <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-sage-light/50 text-sage-dark">
                  Low sensitivity
                </span>
              )}
            </div>
          )}
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && !editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0">
              {/* Food details with sensitivity info */}
              <div className="space-y-2 mb-3">
                {foods.map((f, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{f.name}</span>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${fodmapColor(f.fodmap)}`}>
                          {f.fodmap}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setShowExplanation(showExplanation === f.name ? null : f.name); }}
                          className="w-4 h-4 flex items-center justify-center rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                          title="Why this classification?"
                        >
                          <Info className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {showExplanation === f.name && (
                      <p className="text-[11px] text-muted-foreground mt-1 ml-0.5 leading-relaxed bg-muted/50 rounded-lg px-2.5 py-1.5">
                        {getFODMAPExplanation(f.name, f.fodmap as "low" | "moderate" | "high")}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Hidden ingredients */}
              {foods.some((f) => f.hiddenIngredients?.length > 0) && (
                <div className="mb-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Hidden ingredients</p>
                  <p className="text-xs text-muted-foreground">
                    {foods.flatMap((f) => f.hiddenIngredients || []).join(", ")}
                  </p>
                </div>
              )}

              {meal.notes && (
                <p className="text-xs text-muted-foreground italic mb-3">{meal.notes}</p>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded-xl border border-border hover:bg-muted transition-colors"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                  className={`flex items-center justify-center gap-1.5 text-xs font-medium py-2 px-4 rounded-xl transition-colors ${
                    confirmDelete
                      ? "bg-red-500 text-white"
                      : "border border-red-200 text-red-400 hover:bg-red-50"
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {confirmDelete ? "Confirm" : "Delete"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit mode */}
      <AnimatePresence>
        {editing && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pt-0 space-y-3">
              {/* Meal type selector */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Meal type</p>
                <div className="flex gap-1.5 flex-wrap">
                  {(["breakfast", "lunch", "dinner", "snack"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setMealType(type)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize transition-colors ${
                        mealType === type
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Food items */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Foods</p>
                <div className="space-y-1.5">
                  {foods.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="flex-1 text-sm truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => cycleFodmap(idx)}
                        className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${fodmapColor(f.fodmap)}`}
                        title="Tap to cycle FODMAP level"
                      >
                        {f.fodmap}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFood(idx)}
                        className="p-1 rounded hover:bg-coral-light/40 transition-colors"
                        aria-label="Remove food"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-coral" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    ref={inputRef}
                    value={newFood}
                    onChange={(e) => setNewFood(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addFood()}
                    placeholder="Add food…"
                    className="flex-1 text-sm bg-muted rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60"
                  />
                  <button
                    type="button"
                    onClick={addFood}
                    disabled={!newFood.trim()}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium mb-1.5">Notes</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes…"
                  rows={2}
                  className="w-full text-sm bg-muted rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-primary/50 placeholder:text-muted-foreground/60 resize-none"
                />
              </div>

              {/* Save / Cancel */}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-xl border border-border hover:bg-muted transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={updateMealMut.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-60 transition-opacity"
                >
                  <Check className="w-4 h-4" />
                  {updateMealMut.isPending ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

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
      utils.insights.dashboard.invalidate();
      utils.symptoms.list.invalidate();
      toast.success(`${getSymptomLabel(vars.type)} logged`);
      setTimeout(() => setTapped(null), 600);
      onLogged();
    },
    onError: () => {
      setTapped(null);
      toast.error("Failed to log symptom");
    },
  });

  const handleTap = (type: typeof QUICK_SYMPTOMS[0]["type"]) => {
    if (logSymptom.isPending) return;
    setTapped(type);
    logSymptom.mutate({ type, severity: 3, source: "manual" });
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
            {tapped === type && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="w-1.5 h-1.5 rounded-full bg-primary"
              />
            )}
          </motion.button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
        Tap to log at severity 3 · Adjust in Symptoms tab
      </p>
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
                <div className="w-14 h-14 rounded-full bg-sage-light/60 flex items-center justify-center">
                  <User className="w-7 h-7 text-sage-dark" />
                </div>
                <div>
                  <p className="font-display text-lg">{user?.name ?? "Guest"}</p>
                  <p className="text-sm text-muted-foreground">{user?.email ?? ""}</p>
                </div>
              </div>
              <div className={`flex items-center gap-3 rounded-2xl p-4 mb-5 ${
                subStatus.data?.isPremium
                  ? "bg-amber-50 border border-amber-200"
                  : "bg-muted border border-border/50"
              }`}>
                <Crown className={`w-5 h-5 ${subStatus.data?.isPremium ? "text-amber-500" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-sm font-semibold">
                    {subStatus.data?.isPremium ? "GutSync Premium" : "Free Plan"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {subStatus.data?.isPremium
                      ? "Unlimited meal tracking · Advanced insights"
                      : `${subStatus.data?.scansRemaining ?? 3} scans remaining today`}
                  </p>
                </div>
                {!subStatus.data?.isPremium && (
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
                    <span className="text-sm font-medium">Settings & Wearables</span>
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
            <img src={HERO_IMG} alt="GutSync" className="w-full h-48 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h1 className="text-white text-xl font-display">GutSync</h1>
              <p className="text-white/80 text-sm">Discover your personal food triggers</p>
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
            className="w-10 h-10 rounded-full bg-sage-light/60 flex items-center justify-center hover:bg-sage-light transition-colors active:scale-95"
            aria-label="Open profile"
          >
            <Leaf className="w-5 h-5 text-sage-dark" />
          </button>
        </motion.div>

        {/* Hero */}
        <motion.div variants={item} className="rounded-2xl overflow-hidden mb-6 relative">
          <img src={HERO_IMG} alt="GutSync" className="w-full h-40 object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <p className="text-white/90 text-xs font-medium">Discover your personal food triggers</p>
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
              Tap the camera button below to log your first meal. GutSync will help identify food triggers and hidden ingredients.
            </p>
          </motion.div>
        )}

        {/* Recent Meals — tap to expand */}
        {recentMeals.length > 0 && (
          <motion.div variants={item} className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg">Recent Meals</h2>
              <Link href="/food">
                <span className="text-xs text-primary font-medium">View all</span>
              </Link>
            </div>
            <div className="space-y-2.5">
              <AnimatePresence>
                {recentMeals.map((meal) => (
                  <MealTile
                    key={meal.id}
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
