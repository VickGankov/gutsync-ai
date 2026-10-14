import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, bigint, uniqueIndex } from "drizzle-orm/mysql-core";
import type { ReintroCheckIn } from "../shared/reintro";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  email: varchar("email", { length: 320 }).unique(),
  password: varchar("password", { length: 255 }),
  name: text("name"),
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
 * Symptoms tracked manually by users.
 */
export const symptoms = mysqlTable("symptoms", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", [
    // Negative symptoms
    "bloating", "abdominal_pain", "gas", "nausea",
    "fatigue", "headache", "diarrhea", "constipation",
    // Positive outcomes
    "energy_boost", "better_digestion", "improved_mood", "better_sleep", "clearer_skin", "reduced_brain_fog"
  ]).notNull(),
  severity: int("severity").notNull(), // 1-5
  source: mysqlEnum("source", ["manual"]).default("manual").notNull(),
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
 * User subscription status, synced from RevenueCat webhooks.
 * Tracks whether a user has an active premium entitlement.
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  /** RevenueCat customer ID (app_user_id) */
  rcCustomerId: varchar("rcCustomerId", { length: 128 }),
  /** Current subscription tier */
  tier: mysqlEnum("tier", ["free", "premium"]).default("free").notNull(),
  /** Product ID purchased (e.g. gutsync_premium_monthly) */
  productId: varchar("productId", { length: 128 }),
  /** Platform of purchase */
  platform: mysqlEnum("platform", ["ios", "android", "web"]),
  /** When the current period expires (null = free tier) */
  expiresAt: bigint("expiresAt", { mode: "number" }),
  /** When the subscription was first activated */
  activatedAt: bigint("activatedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Daily AI scan usage tracking for free-tier enforcement.
 * Resets automatically each calendar day.
 */
export const scanUsage = mysqlTable(
  "scan_usage",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull(),
    /** YYYY-MM-DD date string for the usage day */
    usageDate: varchar("usageDate", { length: 10 }).notNull(),
    /** Number of AI scans performed on this date */
    scanCount: int("scanCount").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => ({
    userDateUnique: uniqueIndex("scan_usage_user_date_unique").on(table.userId, table.usageDate),
  })
);

export type ScanUsage = typeof scanUsage.$inferSelect;
export type InsertScanUsage = typeof scanUsage.$inferInsert;

/**
 * One-time password reset tokens for email-auth users.
 */
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: bigint("expiresAt", { mode: "number" }).notNull(),
  usedAt: bigint("usedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/**
 * FODMAP reintroduction challenges: one FODMAP group tested over 3 days
 * with increasing amounts. Check-ins are stored as JSON on the row.
 */
export const reintroChallenges = mysqlTable("reintro_challenges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  foodGroup: varchar("foodGroup", { length: 32 }).notNull(),
  testFood: varchar("testFood", { length: 100 }).notNull(),
  /** Amounts for day 1–3 as entered/confirmed by the user. */
  doses: json("doses").$type<[string, string, string]>().notNull(),
  checkIns: json("checkIns").$type<ReintroCheckIn[]>().notNull(),
  status: mysqlEnum("status", ["active", "completed", "abandoned"]).default("active").notNull(),
  outcome: mysqlEnum("outcome", ["tolerated", "limit", "avoid"]),
  /** Tolerated day (0–3) at completion; 0 = none. */
  toleratedDay: int("toleratedDay"),
  lowConfidence: int("lowConfidence").default(0).notNull(),
  startedAt: bigint("startedAt", { mode: "number" }).notNull(),
  finishedAt: bigint("finishedAt", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReintroChallenge = typeof reintroChallenges.$inferSelect;
