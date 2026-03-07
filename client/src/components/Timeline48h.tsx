// GutSync AI — 48-Hour Timeline
// Design: Organic Minimalism — visual food-symptom connection timeline

import { motion } from "framer-motion";
import { UtensilsCrossed, AlertCircle, Clock } from "lucide-react";
import {
  generateMockMeals,
  generateMockSymptoms,
  formatTimeAgo,
  getSymptomEmoji,
  getSymptomLabel,
} from "@/lib/store";

const meals = generateMockMeals();
const symptoms = generateMockSymptoms();

type TimelineEvent = {
  id: string;
  type: 'meal' | 'symptom';
  timestamp: Date;
  label: string;
  detail: string;
  severity?: number;
  emoji?: string;
  hasHighFodmap?: boolean;
};

// Merge meals and symptoms into a single timeline, last 48h
const now = new Date();
const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);

const events: TimelineEvent[] = [
  ...meals
    .filter(m => m.timestamp >= cutoff)
    .map(m => ({
      id: m.id,
      type: 'meal' as const,
      timestamp: m.timestamp,
      label: m.mealType.charAt(0).toUpperCase() + m.mealType.slice(1),
      detail: m.foods.map(f => f.name).join(', '),
      hasHighFodmap: m.foods.some(f => f.fodmap === 'high'),
    })),
  ...symptoms
    .filter(s => s.timestamp >= cutoff)
    .map(s => ({
      id: s.id,
      type: 'symptom' as const,
      timestamp: s.timestamp,
      label: getSymptomLabel(s.type),
      detail: s.notes || `Severity ${s.severity}/5`,
      severity: s.severity,
      emoji: getSymptomEmoji(s.type),
    })),
].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

export default function Timeline48h() {
  if (events.length === 0) return null;

  return (
    <div className="relative">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Last 48 Hours</h3>
      </div>

      {/* Timeline line */}
      <div className="relative pl-6">
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

        <div className="space-y-3">
          {events.slice(0, 8).map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="relative flex items-start gap-3"
            >
              {/* Dot */}
              <div className={`absolute left-[-16px] top-1.5 w-3 h-3 rounded-full border-2 ${
                event.type === 'meal'
                  ? event.hasHighFodmap
                    ? 'bg-coral-light border-coral'
                    : 'bg-sage-light border-sage'
                  : event.severity && event.severity >= 4
                    ? 'bg-coral border-coral'
                    : 'bg-sand border-sand-dark'
              }`} />

              {/* Content */}
              <div className="flex-1 bg-card rounded-lg px-3 py-2 border border-border/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    {event.type === 'meal' ? (
                      <UtensilsCrossed className="w-3 h-3 text-sage-dark" />
                    ) : (
                      <span className="text-sm">{event.emoji}</span>
                    )}
                    <span className="text-xs font-semibold text-foreground">{event.label}</span>
                    {event.hasHighFodmap && (
                      <AlertCircle className="w-3 h-3 text-coral" />
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{formatTimeAgo(event.timestamp)}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{event.detail}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
