// The Home "Gut Score" and tracking streak. Both are simple and explained on screen: nothing here is a medical measure.

import { NEGATIVE_SYMPTOMS } from "./triggers";

const DAY = 86_400_000;
export interface ScoreSymptom { type: string; severity: number; loggedAt: number }

/** Score for the 7 days ending at `end`, from how many symptoms and how severe. null when none were logged. */
export function weekScore(symptoms: ScoreSymptom[], end: number): { score: number | null; count: number } {
  const bad = symptoms.filter(s =>
    (NEGATIVE_SYMPTOMS as readonly string[]).includes(s.type) && s.loggedAt > end - 7 * DAY && s.loggedAt <= end);
  if (bad.length === 0) return { score: null, count: 0 };
  const avg = bad.reduce((sum, s) => sum + s.severity, 0) / bad.length;
  const raw = 100 - 12 * avg - Math.min(20, 2 * bad.length);
  return { score: Math.max(10, Math.min(100, Math.round(raw))), count: bad.length };
}

export type ScoreTrend = "better" | "worse" | "same" | null;

export function gutScore(symptoms: ScoreSymptom[], now: number) {
  const thisWeek = weekScore(symptoms, now);
  const lastWeek = weekScore(symptoms, now - 7 * DAY);
  let trend: ScoreTrend = null;
  if (thisWeek.score !== null && lastWeek.score !== null) {
    const d = thisWeek.score - lastWeek.score;
    trend = d >= 5 ? "better" : d <= -5 ? "worse" : "same";
  }
  return { score: thisWeek.score, symptomCount: thisWeek.count, trend };
}

/**
 * Days in a row (ending today, or yesterday if nothing is logged yet today) with at least one meal or symptom
 * logged. A day with nothing logged ends the streak.
 */
export function trackingStreak(times: number[], now: number, tzOffsetMinutes: number): number {
  const dayKey = (ts: number) => Math.floor((ts - tzOffsetMinutes * 60_000) / DAY);
  const days = new Set(times.map(dayKey));
  let day = dayKey(now);
  if (!days.has(day)) day -= 1;
  let streak = 0;
  while (days.has(day)) { streak++; day--; }
  return streak;
}
