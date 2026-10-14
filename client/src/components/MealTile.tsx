// Meal card: tap to expand, edit foods / meal type, collapsible ingredients. Shared by Home and Log.

import { motion, AnimatePresence } from "framer-motion";
import { Leaf, Clock, X, Check, Trash2, MoreHorizontal, ChevronDown, Info } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { formatTimeAgo } from "@/lib/store";
import type { FoodItem } from "@/lib/store";
import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { getFODMAPExplanation } from "@/lib/fodmapExplanations";
import { invalidateToday } from "@/lib/invalidateToday";

// ─── Minimalistic Meal Tile ─────────────────────────────────────────────────
const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

/** Collapsible ingredient list for one food (shows flagged triggers even when no full list is on file). */
function IngredientsDisclosure({ food }: { food: FoodItem }) {
  const list = food.ingredients ?? [];
  const triggers = food.hiddenIngredients ?? [];
  return (
    <details className="group mt-1" onClick={(e) => e.stopPropagation()}>
      <summary className="cursor-pointer select-none text-[11px] font-medium text-primary list-none flex items-center gap-1">
        <span className="inline-block transition-transform group-open:rotate-90">›</span>
        Ingredients{list.length ? ` (${list.length})` : ""}
      </summary>
      <div className="mt-1 ml-3 space-y-1.5">
        {list.length > 0 ? (
          <p className="text-[11px] leading-snug text-muted-foreground">{list.join(", ")}</p>
        ) : (
          <p className="text-[11px] leading-snug text-muted-foreground">No ingredient list on file for this item.</p>
        )}
        {triggers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {triggers.map((t, i) => (
              <span key={`${t}-${i}`} className="text-[10px] px-1.5 py-0.5 rounded-full bg-coral-light/40 text-coral">{t}</span>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

export default function MealTile({ meal, onSaved, onDeleted }: {
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
      invalidateToday(utils);
      setEditing(false);
      setExpanded(false);
      toast.success("Meal updated");
      onSaved();
    },
    onError: () => toast.error("Failed to save changes"),
  });

  const deleteMealMut = trpc.meals.delete.useMutation({
    onSuccess: () => {
      invalidateToday(utils);
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
      ...(f.ingredients?.length ? { ingredients: f.ingredients } : {}),
      ...(f.volumeMl ? { volumeMl: f.volumeMl } : {}),
    }));
    updateMealMut.mutate({ id: meal.id, mealType, foods: sanitizedFoods });
  }, [foods, meal.id, mealType, updateMealMut]);

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
                  <div key={`detail-${f.name}-${idx}`}>
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
                    <IngredientsDisclosure food={f} />
                    {showExplanation === f.name && (
                      <p className="text-[11px] text-muted-foreground mt-1 ml-0.5 leading-relaxed bg-muted/50 rounded-lg px-2.5 py-1.5">
                        {getFODMAPExplanation(f.name, f.fodmap as "low" | "moderate" | "high")}
                      </p>
                    )}
                  </div>
                ))}
              </div>

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
                <div className="space-y-2">
                  {foods.map((f, idx) => (
                    <div key={`food-${idx}`}>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 min-w-0 text-sm truncate">{f.name}</span>
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
                      <IngredientsDisclosure food={f} />
                    </div>
                  ))}
                </div>
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
