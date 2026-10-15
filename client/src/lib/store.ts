// GutSync — Types & Utility Functions
// These types mirror the database schema for frontend use

export interface FoodItem {
  name: string;
  category: 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'dairy' | 'grain' | 'other';
  fodmap: 'low' | 'moderate' | 'high';
  hiddenIngredients: string[];
  /** Full ingredient list when known (label or product database). */
  ingredients?: string[];
  volumeMl?: number;
}

export interface MealEntry {
  id: number;
  userId: number;
  photoUrl: string | null;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foods: FoodItem[];
  notes: string | null;
  loggedAt: number;
  createdAt: Date;
}

export interface SymptomEntry {
  id: number;
  userId: number;
  type: 'bloating' | 'abdominal_pain' | 'gas' | 'nausea' | 'fatigue' | 'headache' | 'diarrhea' | 'constipation' | 'acid_reflux' | 'vomiting' | 'low_appetite';
  severity: number;
  source: 'manual';
  notes: string | null;
  loggedAt: number;
  createdAt: Date;
}


export interface CorrelationEntry {
  id: number;
  userId: number;
  trigger: string;
  symptom: string;
  confidence: number;
  occurrences: number;
  description: string;
  recommendation: string;
  discoveredAt: number;
  createdAt: Date;
}

// Utility functions
export function formatTimeAgo(ts: number | Date): string {
  const now = Date.now();
  const timestamp = typeof ts === 'number' ? ts : ts.getTime();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export function formatMealTime(ts: number | Date): string {
  const date = typeof ts === 'number' ? new Date(ts) : ts;
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function getSymptomEmoji(type: string): string {
  const map: Record<string, string> = {
    bloating: '🫧',
    abdominal_pain: '⚡',
    gas: '💨',
    nausea: '🌊',
    fatigue: '😴',
    headache: '🤕',
    diarrhea: '💧',
    constipation: '🧱',
    acid_reflux: '🔥',
    vomiting: '🤮',
    low_appetite: '🍽️',
    energy_boost: '⚡',
    better_digestion: '✨',
    improved_mood: '😊',
    better_sleep: '😴',
    clearer_skin: '🌟',
    reduced_brain_fog: '🧠',
    injection_site_reaction: '💉',
    dizziness: '💫',
    racing_heart: '💓',
  };
  return map[type] || '❓';
}

export function getSymptomLabel(type: string): string {
  const map: Record<string, string> = {
    bloating: 'Bloating',
    abdominal_pain: 'Abdominal Pain',
    gas: 'Gas',
    nausea: 'Nausea',
    fatigue: 'Fatigue',
    headache: 'Headache',
    diarrhea: 'Diarrhea',
    constipation: 'Constipation',
    acid_reflux: 'Acid Reflux',
    vomiting: 'Vomiting',
    low_appetite: 'Low Appetite',
    energy_boost: 'Energy Boost',
    better_digestion: 'Better Digestion',
    improved_mood: 'Improved Mood',
    better_sleep: 'Better Sleep',
    clearer_skin: 'Clearer Skin',
    reduced_brain_fog: 'Reduced Brain Fog',
    injection_site_reaction: 'Injection Site Reaction',
    dizziness: 'Dizziness',
    racing_heart: 'Racing Heart',
  };
  return map[type] || type;
}

export function getFodmapColor(level: 'low' | 'moderate' | 'high'): string {
  const map = {
    low: 'text-sage bg-sage-light/50',
    moderate: 'text-sand-dark bg-sand/50',
    high: 'text-coral bg-coral-light/50',
  };
  return map[level];
}

export function getSeverityColor(severity: number): string {
  if (severity <= 2) return 'bg-sage';
  if (severity <= 3) return 'bg-sand-dark';
  return 'bg-coral';
}

// Placeholder data for when user is not logged in (demo mode)
export function generateDemoScore() {
  return { overall: 68, streakDays: 5 };
}
