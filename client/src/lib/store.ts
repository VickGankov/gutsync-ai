// GutSync AI — Data Store & Types
// Design: Organic Minimalism — warm, calming, effortless

export interface FoodItem {
  name: string;
  category: 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'dairy' | 'grain' | 'other';
  fodmap: 'low' | 'moderate' | 'high';
  hiddenIngredients: string[];
}

export interface MealEntry {
  id: string;
  timestamp: Date;
  photoUrl: string;
  foods: FoodItem[];
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  notes?: string;
  isAnalyzing?: boolean;
}

export interface SymptomEntry {
  id: string;
  timestamp: Date;
  type: 'bloating' | 'abdominal_pain' | 'gas' | 'nausea' | 'fatigue' | 'headache' | 'diarrhea' | 'constipation';
  severity: 1 | 2 | 3 | 4 | 5;
  source: 'manual' | 'wearable';
  notes?: string;
}

export interface WearableData {
  timestamp: Date;
  hrv: number;
  heartRate: number;
  sleepQuality: number; // 0-100
  stressLevel: number; // 0-100
}

export interface Correlation {
  id: string;
  trigger: string;
  symptom: string;
  confidence: number; // 0-100
  occurrences: number;
  description: string;
  recommendation: string;
  discoveredAt: Date;
}

export interface GutHealthScore {
  overall: number; // 0-100
  trend: 'improving' | 'stable' | 'declining';
  streakDays: number;
}

// Sample food photos from Unsplash
const MEAL_PHOTOS = [
  'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1484723091739-30a097e8f929?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=400&h=300&fit=crop',
];

// Mock data generators
export function generateMockMeals(): MealEntry[] {
  const now = new Date();
  return [
    {
      id: 'm1',
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      photoUrl: MEAL_PHOTOS[0],
      mealType: 'lunch',
      foods: [
        { name: 'Quinoa Bowl', category: 'grain', fodmap: 'low', hiddenIngredients: ['olive oil', 'lemon juice'] },
        { name: 'Roasted Chickpeas', category: 'protein', fodmap: 'high', hiddenIngredients: ['garlic powder', 'onion powder'] },
        { name: 'Avocado', category: 'fat', fodmap: 'low', hiddenIngredients: [] },
        { name: 'Mixed Greens', category: 'vegetable', fodmap: 'low', hiddenIngredients: [] },
      ],
    },
    {
      id: 'm2',
      timestamp: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      photoUrl: MEAL_PHOTOS[1],
      mealType: 'breakfast',
      foods: [
        { name: 'Sourdough Toast', category: 'grain', fodmap: 'low', hiddenIngredients: ['wheat flour', 'salt'] },
        { name: 'Scrambled Eggs', category: 'protein', fodmap: 'low', hiddenIngredients: ['butter', 'milk'] },
        { name: 'Sautéed Mushrooms', category: 'vegetable', fodmap: 'high', hiddenIngredients: ['garlic', 'butter'] },
      ],
    },
    {
      id: 'm3',
      timestamp: new Date(now.getTime() - 26 * 60 * 60 * 1000),
      photoUrl: MEAL_PHOTOS[2],
      mealType: 'dinner',
      foods: [
        { name: 'Grilled Salmon', category: 'protein', fodmap: 'low', hiddenIngredients: ['lemon', 'dill'] },
        { name: 'Sweet Potato', category: 'carb', fodmap: 'moderate', hiddenIngredients: [] },
        { name: 'Broccoli', category: 'vegetable', fodmap: 'high', hiddenIngredients: ['olive oil'] },
      ],
    },
    {
      id: 'm4',
      timestamp: new Date(now.getTime() - 32 * 60 * 60 * 1000),
      photoUrl: MEAL_PHOTOS[3],
      mealType: 'lunch',
      foods: [
        { name: 'Caesar Salad', category: 'vegetable', fodmap: 'moderate', hiddenIngredients: ['garlic', 'anchovies', 'parmesan'] },
        { name: 'Grilled Chicken', category: 'protein', fodmap: 'low', hiddenIngredients: ['lemon', 'herbs'] },
        { name: 'Croutons', category: 'grain', fodmap: 'high', hiddenIngredients: ['wheat flour', 'garlic butter'] },
      ],
    },
    {
      id: 'm5',
      timestamp: new Date(now.getTime() - 50 * 60 * 60 * 1000),
      photoUrl: MEAL_PHOTOS[4],
      mealType: 'dinner',
      foods: [
        { name: 'Pasta Marinara', category: 'grain', fodmap: 'moderate', hiddenIngredients: ['garlic', 'onion', 'wheat'] },
        { name: 'Meatballs', category: 'protein', fodmap: 'moderate', hiddenIngredients: ['breadcrumbs', 'onion', 'garlic'] },
      ],
    },
    {
      id: 'm6',
      timestamp: new Date(now.getTime() - 56 * 60 * 60 * 1000),
      photoUrl: MEAL_PHOTOS[5],
      mealType: 'breakfast',
      foods: [
        { name: 'Greek Yogurt', category: 'dairy', fodmap: 'moderate', hiddenIngredients: ['milk cultures'] },
        { name: 'Honey', category: 'other', fodmap: 'high', hiddenIngredients: [] },
        { name: 'Granola', category: 'grain', fodmap: 'moderate', hiddenIngredients: ['oats', 'honey', 'dried fruit'] },
      ],
    },
    {
      id: 'm7',
      timestamp: new Date(now.getTime() - 74 * 60 * 60 * 1000),
      photoUrl: MEAL_PHOTOS[6],
      mealType: 'snack',
      foods: [
        { name: 'Hummus', category: 'protein', fodmap: 'high', hiddenIngredients: ['chickpeas', 'tahini', 'garlic', 'lemon'] },
        { name: 'Pita Bread', category: 'grain', fodmap: 'high', hiddenIngredients: ['wheat flour', 'yeast'] },
      ],
    },
  ];
}

export function generateMockSymptoms(): SymptomEntry[] {
  const now = new Date();
  return [
    { id: 's1', timestamp: new Date(now.getTime() - 1 * 60 * 60 * 1000), type: 'bloating', severity: 3, source: 'manual', notes: 'After lunch, moderate discomfort' },
    { id: 's2', timestamp: new Date(now.getTime() - 5 * 60 * 60 * 1000), type: 'gas', severity: 2, source: 'manual' },
    { id: 's3', timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000), type: 'abdominal_pain', severity: 4, source: 'manual', notes: 'Sharp pain after dinner' },
    { id: 's4', timestamp: new Date(now.getTime() - 28 * 60 * 60 * 1000), type: 'fatigue', severity: 3, source: 'wearable' },
    { id: 's5', timestamp: new Date(now.getTime() - 48 * 60 * 60 * 1000), type: 'bloating', severity: 4, source: 'manual', notes: 'Severe bloating after pasta' },
    { id: 's6', timestamp: new Date(now.getTime() - 52 * 60 * 60 * 1000), type: 'nausea', severity: 2, source: 'manual' },
    { id: 's7', timestamp: new Date(now.getTime() - 72 * 60 * 60 * 1000), type: 'bloating', severity: 3, source: 'manual', notes: 'After hummus and pita' },
  ];
}

export function generateMockWearableData(): WearableData[] {
  const now = new Date();
  const data: WearableData[] = [];
  for (let i = 0; i < 7; i++) {
    data.push({
      timestamp: new Date(now.getTime() - i * 24 * 60 * 60 * 1000),
      hrv: 35 + Math.floor(Math.random() * 30),
      heartRate: 62 + Math.floor(Math.random() * 15),
      sleepQuality: 55 + Math.floor(Math.random() * 35),
      stressLevel: 20 + Math.floor(Math.random() * 40),
    });
  }
  return data;
}

export function generateMockCorrelations(): Correlation[] {
  return [
    {
      id: 'c1',
      trigger: 'Chickpeas & Garlic',
      symptom: 'Bloating',
      confidence: 87,
      occurrences: 5,
      description: "You've experienced bloating 5 out of 6 times after eating chickpeas combined with garlic. Both are high-FODMAP foods that can ferment in the gut.",
      recommendation: "Try a 5-day elimination of chickpeas. Replace hummus with a low-FODMAP dip like baba ganoush (limit to 2 tbsp).",
      discoveredAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'c2',
      trigger: 'Dairy + Wheat',
      symptom: 'Abdominal Pain',
      confidence: 72,
      occurrences: 3,
      description: 'Combining dairy (yogurt, milk, butter) with wheat products correlates with abdominal pain. This pattern appeared 3 times in the past week.',
      recommendation: 'Separate dairy and wheat-based meals by at least 4 hours. Try lactose-free alternatives when eating bread or pasta.',
      discoveredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
    {
      id: 'c3',
      trigger: 'Honey',
      symptom: 'Gas & Bloating',
      confidence: 65,
      occurrences: 2,
      description: 'Honey is high in fructose, a common FODMAP trigger. Gas symptoms appeared within 3 hours of honey consumption both times this week.',
      recommendation: 'Replace honey with maple syrup (low-FODMAP) in your morning yogurt. Monitor for 3 days.',
      discoveredAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
    },
    {
      id: 'c4',
      trigger: 'Late Eating (after 8pm)',
      symptom: 'Poor Sleep + Fatigue',
      confidence: 58,
      occurrences: 4,
      description: 'Your wearable data shows HRV drops and poor sleep quality on nights when you eat after 8pm. This correlates with next-day fatigue.',
      recommendation: 'Try finishing your last meal by 7:30pm for the next 5 days. Your wearable will track the sleep quality difference.',
      discoveredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  ];
}

export function generateGutHealthScore(): GutHealthScore {
  return {
    overall: 68,
    trend: 'improving',
    streakDays: 5,
  };
}

// Utility functions
export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  return `${days}d ago`;
}

export function formatMealTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function getSymptomEmoji(type: SymptomEntry['type']): string {
  const map: Record<SymptomEntry['type'], string> = {
    bloating: '🫧',
    abdominal_pain: '⚡',
    gas: '💨',
    nausea: '🌊',
    fatigue: '😴',
    headache: '🤕',
    diarrhea: '💧',
    constipation: '🧱',
  };
  return map[type];
}

export function getSymptomLabel(type: SymptomEntry['type']): string {
  const map: Record<SymptomEntry['type'], string> = {
    bloating: 'Bloating',
    abdominal_pain: 'Abdominal Pain',
    gas: 'Gas',
    nausea: 'Nausea',
    fatigue: 'Fatigue',
    headache: 'Headache',
    diarrhea: 'Diarrhea',
    constipation: 'Constipation',
  };
  return map[type];
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
