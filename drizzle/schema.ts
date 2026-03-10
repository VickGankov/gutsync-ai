import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Meals logged by users via photo upload.
 * Each meal contains a photo URL and AI-analyzed food items stored as JSON.
 */
export const meals = mysqlTable("meals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  photoUrl: text("photoUrl"),
  mealType: mysqlEnum("mealType", ["breakfast", "lunch", "dinner", "snack"]).notNull(),
  /** JSON array of analyzed food items: { name, category, fodmap, hiddenIngredients[] } */
  foods: json("foods").$type<MealFood[]>().notNull(),
  notes: text("notes"),
  loggedAt: bigint("loggedAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export interface MealFood {
  name: string;
  category: 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'dairy' | 'grain' | 'other';
  fodmap: 'low' | 'moderate' | 'high';
  hiddenIngredients: string[];
}

export type Meal = typeof meals.$inferSelect;
export type InsertMeal = typeof meals.$inferInsert;

/**
 * Symptoms tracked by users (manual) or detected by wearables (auto).
 */
export const symptoms = mysqlTable("symptoms", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    "bloating", "abdominal_pain", "gas", "nausea",
    "fatigue", "headache", "diarrhea", "constipation"
  ]).notNull(),
  severity: int("severity").notNull(), // 1-5
  source: mysqlEnum("source", ["manual", "wearable"]).default("manual").notNull(),
  notes: text("notes"),
  loggedAt: bigint("loggedAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Symptom = typeof symptoms.$inferSelect;
export type InsertSymptom = typeof symptoms.$inferInsert;

/**
 * AI-discovered correlations between food triggers and symptoms.
 */
export const correlations = mysqlTable("correlations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  trigger: varchar("triggerName", { length: 255 }).notNull(),
  symptom: varchar("symptomName", { length: 255 }).notNull(),
  confidence: int("confidence").notNull(), // 0-100
  occurrences: int("occurrences").notNull(),
  description: text("description").notNull(),
  recommendation: text("recommendation").notNull(),
  discoveredAt: bigint("discoveredAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Correlation = typeof correlations.$inferSelect;
export type InsertCorrelation = typeof correlations.$inferInsert;

/**
 * Wearable health data snapshots (HRV, heart rate, sleep, stress).
 */
export const wearableData = mysqlTable("wearable_data", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  hrv: int("hrv").notNull(),
  heartRate: int("heartRate").notNull(),
  sleepQuality: int("sleepQuality").notNull(), // 0-100
  stressLevel: int("stressLevel").notNull(), // 0-100
  recordedAt: bigint("recordedAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WearableData = typeof wearableData.$inferSelect;
export type InsertWearableData = typeof wearableData.$inferInsert;
