import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, bigint, uniqueIndex, boolean, double, index } from "drizzle-orm/mysql-core";
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
  /** Profile photo (a small square JPEG we store ourselves), or null for the initials fallback. */
  avatarUrl: varchar("avatarUrl", { length: 500 }),
  /** Foods the user says they suspect (keys from shared/sensitivities.ts). Only used to flag and count. */
  sensitivities: json("sensitivities").$type<string[]>(),
  /** When the user redeemed the founder invite code (ms since epoch). Null = not a founder. */
  founderAt: bigint("founderAt", { mode: "number" }),
  /** Version of the Terms the user last agreed to, and when. Null until they confirm 18+ and agree. */
  termsVersion: varchar("termsVersion", { length: 16 }),
  termsAcceptedAt: bigint("termsAcceptedAt", { mode: "number" }),
  /** Date of birth as YYYY-MM-DD. Required at sign-up (18+); used for age-aware messaging. */
  birthDate: varchar("birthDate", { length: 10 }),
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
  /** Estimated grams of protein in this item (AI estimate, user-editable). */
  proteinGrams?: number;
  /** Estimated grams of fiber in this item (AI estimate; not shown for packaged items). */
  fiberGrams?: number;
  /** Packaged/branded product (identified by its printed name). */
  packaged?: boolean;
  /** Where the FODMAP/ingredient data came from: the product label, or an AI estimate. */
  basis?: 'label' | 'database' | 'estimate';
  /** Full ingredient list when read from a label (display only). */
  ingredients?: string[];
  /** Non-alcoholic drink volume in mL; counts toward daily water. */
  volumeMl?: number;
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
    "acid_reflux", "vomiting", "low_appetite",
    // Positive outcomes
    "energy_boost", "better_digestion", "improved_mood", "better_sleep", "clearer_skin", "reduced_brain_fog",
    // Medication side effects (appended last: TiDB only allows adding enum values at the end)
    "injection_site_reaction", "dizziness", "racing_heart"
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

/**
 * Per-user fitness targets (protein / water).
 */
export const fitnessProfile = mysqlTable("fitness_profile", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  proteinTargetG: int("proteinTargetG").default(150).notNull(),
  waterTargetMl: int("waterTargetMl").default(3785).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FitnessProfile = typeof fitnessProfile.$inferSelect;

/**
 * Body-weight entries. One row per weigh-in.
 */
export const weightLogs = mysqlTable("weight_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  /** Tenths of a pound (e.g. 1854 = 185.4 lb) to avoid float columns. */
  weightLb10: int("weightLb10").notNull(),
  loggedAt: bigint("loggedAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WeightLog = typeof weightLogs.$inferSelect;

/** Waist measurements (optional). Tenths of an inch, like weight. */
export const waistLogs = mysqlTable("waist_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  waistIn10: int("waistIn10").notNull(),
  loggedAt: bigint("loggedAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** The user's own supplement list (a checklist, no advice). Removed items are archived so history stays. */
export const supplements = mysqlTable("supplements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 60 }).notNull(),
  /** Optional free-text current dose, e.g. "2000 IU". */
  dose: varchar("dose", { length: 40 }),
  archived: boolean("archived").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** One row per supplement per local calendar day it was taken. */
export const supplementLogs = mysqlTable("supplement_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  supplementId: int("supplementId").notNull(),
  /** Local calendar date, YYYY-MM-DD, as seen by the user. */
  dateKey: varchar("dateKey", { length: 10 }).notNull(),
  /** The supplement's dose when it was ticked, so dose changes show up in history. */
  dose: varchar("dose", { length: 40 }),
  loggedAt: bigint("loggedAt", { mode: "number" }).notNull(),
}, (t) => ({ once: uniqueIndex("supplement_logs_once").on(t.supplementId, t.dateKey) }));

/**
 * Quick-add intake entries that aren't photo meals (protein shakes, water).
 */
export const intakeLogs = mysqlTable("intake_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  kind: mysqlEnum("kind", ["protein", "water"]).notNull(),
  amount: int("amount").notNull(), // grams for protein, ml for water
  loggedAt: bigint("loggedAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type IntakeLog = typeof intakeLogs.$inferSelect;

/**
 * Strength training sets. One row per exercise entry (top set).
 */
export const liftLogs = mysqlTable("lift_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  exercise: varchar("exercise", { length: 100 }).notNull(),
  weightLb: int("weightLb").notNull(),
  reps: int("reps").notNull(),
  sets: int("sets").default(1).notNull(),
  notes: text("notes"),
  loggedAt: bigint("loggedAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LiftLog = typeof liftLogs.$inferSelect;

/**
 * Shared cache of per-food facts so the AI only has to identify foods in a photo.
 * Keyed by a normalized food name (see shared/foodCache.ts).
 */
export const foodCache = mysqlTable("food_cache", {
  id: int("id").autoincrement().primaryKey(),
  foodKey: varchar("foodKey", { length: 120 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  category: mysqlEnum("category", ["protein", "carb", "fat", "vegetable", "fruit", "dairy", "grain", "other"]).notNull(),
  fodmap: mysqlEnum("fodmap", ["low", "moderate", "high"]).notNull(),
  hiddenIngredients: json("hiddenIngredients").$type<string[]>().notNull(),
  /** Protein grams per 100 g of food, in tenths (e.g. 310 = 31.0 g). */
  proteinPer100gTenths: int("proteinPer100gTenths").default(0).notNull(),
  /** Fiber grams per 100 g, in tenths. NULL until looked up (rows from before fiber tracking). */
  fiberPer100gTenths: int("fiberPer100gTenths"),
  source: mysqlEnum("source", ["seed", "ai"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FoodFactRow = typeof foodCache.$inferSelect;
export type InsertFoodFact = typeof foodCache.$inferInsert;

/** Packaged-product ingredient lists from Open Food Facts, cached by normalized product key. */
export const productCache = mysqlTable("product_cache", {
  id: int("id").autoincrement().primaryKey(),
  productKey: varchar("productKey", { length: 160 }).notNull().unique(),
  name: varchar("name", { length: 200 }).notNull(),
  ingredients: json("ingredients").$type<string[]>().notNull(),
  found: boolean("found").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Cached AI write-up for a detected trigger; regenerated when the underlying counts change. */
export const triggerExplanations = mysqlTable("trigger_explanations", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  triggerKey: varchar("triggerKey", { length: 255 }).notNull(),
  statsHash: varchar("statsHash", { length: 40 }).notNull(),
  explanation: json("explanation").$type<TriggerExplanation>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ userKey: uniqueIndex("trigger_explanations_user_key").on(t.userId, t.triggerKey) }));

export interface TriggerExplanation {
  shows: string;
  why: string;
  confidence: string;
  nextStep: string;
  seeProfessional: string;
}

/** Medication / peptide doses the user logged. Amounts are stored in micrograms (1 mg = 1000). */
export const doseLogs = mysqlTable("dose_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  compound: varchar("compound", { length: 80 }).notNull(),
  doseMcg: int("doseMcg").notNull(),
  site: varchar("site", { length: 32 }),
  notes: text("notes"),
  loggedAt: bigint("loggedAt", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** User-set days between doses, per compound (key = lower-cased name). Otherwise inferred from their own history. */
export const doseSchedules = mysqlTable("dose_schedules", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  compoundKey: varchar("compoundKey", { length: 80 }).notNull(),
  intervalDays: int("intervalDays").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({ userCompound: uniqueIndex("dose_schedules_user_compound").on(t.userId, t.compoundKey) }));

/** Blood work values the user entered or confirmed from an imported report. Units are kept as printed. */
export const labResults = mysqlTable("lab_results", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  marker: varchar("marker", { length: 60 }).notNull(),
  value: double("value").notNull(),
  unit: varchar("unit", { length: 24 }).notNull(),
  /** The lab's own reference range as printed on the report (never a generic "normal"). */
  refLow: double("refLow"),
  refHigh: double("refHigh"),
  /** Local date the blood was drawn, YYYY-MM-DD. */
  drawnOn: varchar("drawnOn", { length: 10 }).notNull(),
  notes: varchar("notes", { length: 200 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ byUserMarker: index("lab_results_user_marker").on(t.userId, t.marker) }));

/** One row per browser/phone that allowed push notifications. */
export const pushSubscriptions = mysqlTable("push_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  endpoint: varchar("endpoint", { length: 600 }).notNull().unique(),
  p256dh: varchar("p256dh", { length: 200 }).notNull(),
  auth: varchar("auth", { length: 100 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({ byUser: index("push_subscriptions_user").on(t.userId) }));

/** Reminder settings, one row per user. Times are local "HH:MM" in `timeZone`. */
export const notificationPrefs = mysqlTable("notification_prefs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  mealReminders: boolean("mealReminders").notNull().default(false),
  mealTimes: json("mealTimes").$type<string[]>().notNull(),
  symptomCheckins: boolean("symptomCheckins").notNull().default(false),
  timeZone: varchar("timeZone", { length: 64 }).notNull().default("UTC"),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

/** What has been sent, so a reminder is never sent twice (unique per user and key). */
export const notificationLog = mysqlTable("notification_log", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  key: varchar("key", { length: 80 }).notNull(),
  kind: varchar("kind", { length: 16 }).notNull(),
  sentAt: timestamp("sentAt").defaultNow().notNull(),
}, (t) => ({ uniq: uniqueIndex("notification_log_user_key").on(t.userId, t.key) }));
