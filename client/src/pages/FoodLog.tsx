// GutSync AI — Food Log Page
// Design: Organic Minimalism — journal-like meal entries with FODMAP badges

import { motion } from "framer-motion";
import { Calendar, Clock, AlertTriangle, ChevronDown, Eye } from "lucide-react";
import { useState } from "react";
import {
  generateMockMeals,
  formatTimeAgo,
  formatMealTime,
  type MealEntry,
  type FoodItem,
} from "@/lib/store";

const FOOD_SCAN_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310419663031724495/Aye9Tq4ostcsrtEqbKqav7/gutsync-food-scan-Q6qZWp7uKQBXi3HwwykjjB.webp";

const meals = generateMockMeals();

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

function FodmapBadge({ level }: { level: FoodItem['fodmap'] }) {
  const styles = {
    low: 'bg-sage-light/60 text-sage-dark',
    moderate: 'bg-sand text-sand-dark',
    high: 'bg-coral-light/60 text-coral',
  };
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${styles[level]}`}>
      {level}
    </span>
  );
}

function MealCard({ meal }: { meal: MealEntry }) {
  const [expanded, setExpanded] = useState(false);
  const highFodmapCount = meal.foods.filter(f => f.fodmap === 'high').length;
  const allHidden = meal.foods.flatMap(f => f.hiddenIngredients);

  return (
    <motion.div variants={item} className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
      {/* Meal photo + header */}
      <div className="relative">
        <img src={meal.photoUrl} alt={meal.mealType} className="w-full h-36 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div>
            <span className="text-white text-xs font-medium capitalize bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
              {meal.mealType}
            </span>
          </div>
          <div className="flex items-center gap-1 text-white/80">
            <Clock className="w-3 h-3" />
            <span className="text-xs">{formatMealTime(meal.timestamp)}</span>
          </div>
        </div>
      </div>

      {/* Food items summary */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-foreground">
            {meal.foods.length} items detected
          </p>
          <span className="text-[11px] text-muted-foreground">{formatTimeAgo(meal.timestamp)}</span>
        </div>

        {/* Quick food list */}
        <div className="space-y-2">
          {meal.foods.map((food, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {food.fodmap === 'high' && <AlertTriangle className="w-3 h-3 text-coral" />}
                <span className="text-sm text-foreground">{food.name}</span>
              </div>
              <FodmapBadge level={food.fodmap} />
            </div>
          ))}
        </div>

        {/* High FODMAP warning */}
        {highFodmapCount > 0 && (
          <div className="mt-3 bg-coral-light/20 border border-coral/15 rounded-xl px-3 py-2 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-coral shrink-0" />
            <span className="text-xs text-foreground">
              {highFodmapCount} high-FODMAP {highFodmapCount === 1 ? 'item' : 'items'} detected
            </span>
          </div>
        )}

        {/* Expandable hidden ingredients */}
        {allHidden.length > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{allHidden.length} hidden ingredients found</span>
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}

        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="mt-2 flex flex-wrap gap-1.5"
          >
            {allHidden.map((h, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-muted border border-border text-muted-foreground">
                {h}
              </span>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export default function FoodLog() {
  // Group meals by day
  const today = new Date();
  const todayStr = today.toDateString();
  const yesterdayStr = new Date(today.getTime() - 86400000).toDateString();

  const grouped: Record<string, MealEntry[]> = {};
  meals.forEach(meal => {
    const dayStr = meal.timestamp.toDateString();
    let label = dayStr;
    if (dayStr === todayStr) label = 'Today';
    else if (dayStr === yesterdayStr) label = 'Yesterday';
    else label = meal.timestamp.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(meal);
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <motion.div variants={item} className="mb-6">
        <h1 className="text-2xl tracking-tight">Food Log</h1>
        <p className="text-sm text-muted-foreground mt-1">AI-analyzed meals with FODMAP breakdown</p>
      </motion.div>

      {/* How it works banner */}
      <motion.div variants={item} className="rounded-2xl overflow-hidden mb-6 relative">
        <img src={FOOD_SCAN_IMG} alt="How food scanning works" className="w-full h-32 object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 to-transparent flex items-center">
          <div className="px-5">
            <p className="text-white text-sm font-medium">Snap. Detect. Track.</p>
            <p className="text-white/70 text-xs mt-1">AI finds hidden ingredients automatically</p>
          </div>
        </div>
      </motion.div>

      {/* Meal groups */}
      {Object.entries(grouped).map(([day, dayMeals]) => (
        <motion.div key={day} variants={item} className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{day}</h3>
          </div>
          <div className="space-y-3">
            {dayMeals.map(meal => (
              <MealCard key={meal.id} meal={meal} />
            ))}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
