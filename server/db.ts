import { isEmailInList } from "./access";
import { eq, desc, and, gte, lte, sql, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { mysqlOptionsFromUrl } from "../shared/dbConnection.mjs";
import {
  InsertUser, users,
  InsertMeal, meals, type MealFood,
  InsertSymptom, symptoms,
  InsertCorrelation, correlations,
  subscriptions, type InsertSubscription,
  scanUsage,
  reintroChallenges,
  foodCache, productCache,
  triggerExplanations, type TriggerExplanation,
  doseLogs, doseSchedules,
  fitnessProfile, weightLogs, intakeLogs, liftLogs,
} from "../drizzle/schema";
import type { ReintroCheckIn, ReintroOutcome } from "@shared/reintro";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(mysql.createPool({ ...mysqlOptionsFromUrl(process.env.DATABASE_URL), connectionLimit: 10 }));
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId && !user.email) {
    throw new Error("User openId or email is required");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: any = {};
    if (user.openId) values.openId = user.openId;
    if (user.email) values.email = user.email;
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Meal Queries ───

export async function createMeal(meal: InsertMeal) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(meals).values(meal);
  return result[0].insertId;
}

export async function updateMeal(
  userId: number,
  mealId: number,
  updates: Partial<Pick<InsertMeal, 'mealType' | 'foods' | 'notes'>>
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(meals)
    .set(updates)
    .where(and(eq(meals.id, mealId), eq(meals.userId, userId)));
}

export async function deleteMeal(userId: number, mealId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(meals).where(and(eq(meals.id, mealId), eq(meals.userId, userId)));
}

export async function getMealsByUser(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(meals).where(eq(meals.userId, userId)).orderBy(desc(meals.loggedAt)).limit(limit);
}

export async function getMealsInRange(userId: number, fromTs: number, toTs: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(meals)
    .where(and(eq(meals.userId, userId), gte(meals.loggedAt, fromTs), lte(meals.loggedAt, toTs)))
    .orderBy(desc(meals.loggedAt));
}

// ─── Symptom Queries ───

export async function createSymptom(symptom: InsertSymptom) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(symptoms).values(symptom);
  return result[0].insertId;
}

export async function getSymptomsByUser(userId: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(symptoms).where(eq(symptoms.userId, userId)).orderBy(desc(symptoms.loggedAt)).limit(limit);
}

export async function updateSymptomSeverity(userId: number, id: number, severity: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(symptoms).set({ severity }).where(and(eq(symptoms.id, id), eq(symptoms.userId, userId)));
}

export async function deleteSymptom(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(symptoms).where(and(eq(symptoms.id, id), eq(symptoms.userId, userId)));
}

// ─── Correlation Queries ───

export async function upsertCorrelation(corr: InsertCorrelation) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(correlations).values(corr);
  return result[0].insertId;
}

export async function getCorrelationsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(correlations).where(eq(correlations.userId, userId)).orderBy(desc(correlations.confidence));
}

// ─── Subscription Queries ───

/** Get a user's subscription record. Returns null if no record exists (= free tier). */
export async function getSubscription(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
  return result[0] ?? null;
}

/** Returns true if the user has an active premium subscription. */
export async function isPremium(userId: number): Promise<boolean> {
  if (ENV.unlimitedEmails) {
    const user = await getUserById(userId);
    if (isEmailInList(user?.email, ENV.unlimitedEmails)) return true;
  }
  const sub = await getSubscription(userId);
  if (!sub || sub.tier !== 'premium') return false;
  if (sub.expiresAt && sub.expiresAt < Date.now()) return false;
  return true;
}

/** Upsert subscription record (called from RevenueCat webhook or client receipt). */
export async function upsertSubscription(data: InsertSubscription) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(subscriptions).values(data).onDuplicateKeyUpdate({
    set: {
      tier: data.tier,
      productId: data.productId ?? null,
      platform: data.platform ?? null,
      expiresAt: data.expiresAt ?? null,
      activatedAt: data.activatedAt ?? null,
      rcCustomerId: data.rcCustomerId ?? null,
    },
  });
}

/** Downgrade a user back to free tier (on cancellation/expiry). */
export async function cancelSubscription(userId: number) {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(subscriptions)
    .set({ tier: 'free', expiresAt: null })
    .where(eq(subscriptions.userId, userId));
}

// ─── Scan Usage Queries ───

/** Get today's scan count for a user. Returns 0 if no record. */
export async function getTodayScanCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const result = await db
    .select({
      total: sql<number>`cast(coalesce(sum(${scanUsage.scanCount}), 0) as signed)`,
    })
    .from(scanUsage)
    .where(and(eq(scanUsage.userId, userId), eq(scanUsage.usageDate, today)));
  return Number(result[0]?.total ?? 0);
}

/** Increment today's scan count. Creates the record if it doesn't exist. */
export async function incrementScanCount(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const today = new Date().toISOString().slice(0, 10);
  await db.insert(scanUsage)
    .values({ userId, usageDate: today, scanCount: 1 })
    .onDuplicateKeyUpdate({ set: { scanCount: sql`${scanUsage.scanCount} + 1` } });
  // Re-fetch the updated count
  const result = await db
    .select({
      total: sql<number>`cast(coalesce(sum(${scanUsage.scanCount}), 0) as signed)`,
    })
    .from(scanUsage)
    .where(and(eq(scanUsage.userId, userId), eq(scanUsage.usageDate, today)));
  return Number(result[0]?.total ?? 1);
}

// ─── Reintroduction Challenges ───

export async function getReintroChallenges(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reintroChallenges)
    .where(eq(reintroChallenges.userId, userId))
    .orderBy(desc(reintroChallenges.startedAt));
}

export async function getActiveReintroChallenge(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(reintroChallenges)
    .where(and(eq(reintroChallenges.userId, userId), eq(reintroChallenges.status, "active")))
    .limit(1);
  return rows[0] ?? null;
}

export async function createReintroChallenge(data: {
  userId: number; foodGroup: string; testFood: string; doses: [string, string, string]; startedAt: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reintroChallenges).values({ ...data, checkIns: [], status: "active" });
  return result[0].insertId;
}

export async function updateReintroCheckIns(userId: number, id: number, checkIns: ReintroCheckIn[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reintroChallenges)
    .set({ checkIns })
    .where(and(eq(reintroChallenges.id, id), eq(reintroChallenges.userId, userId)));
}

export async function finishReintroChallenge(
  userId: number,
  id: number,
  data: { status: "completed" | "abandoned"; outcome: ReintroOutcome | null; toleratedDay: number | null; lowConfidence: boolean; finishedAt: number }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reintroChallenges)
    .set({ ...data, lowConfidence: data.lowConfidence ? 1 : 0 })
    .where(and(eq(reintroChallenges.id, id), eq(reintroChallenges.userId, userId)));
}

// ─── Fitness Queries ───

export async function getFitnessProfile(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(fitnessProfile).where(eq(fitnessProfile.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertFitnessProfile(userId: number, data: { proteinTargetG: number; waterTargetMl: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(fitnessProfile)
    .values({ userId, ...data })
    .onDuplicateKeyUpdate({ set: data });
}

export async function createWeightLog(userId: number, weightLb10: number, loggedAt: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(weightLogs).values({ userId, weightLb10, loggedAt });
  return result[0].insertId;
}

export async function createIntakeLog(userId: number, kind: "protein" | "water", amount: number, loggedAt: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(intakeLogs).values({ userId, kind, amount, loggedAt });
  return result[0].insertId;
}

export async function deleteIntakeLog(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(intakeLogs).where(and(eq(intakeLogs.id, id), eq(intakeLogs.userId, userId)));
}

export async function createLiftLog(
  userId: number,
  data: { exercise: string; weightLb: number; reps: number; sets: number; notes: string | null; loggedAt: number }
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(liftLogs).values({ userId, ...data });
  return result[0].insertId;
}

export async function deleteLiftLog(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(liftLogs).where(and(eq(liftLogs.id, id), eq(liftLogs.userId, userId)));
}

export async function deleteWeightLog(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(weightLogs).where(and(eq(weightLogs.id, id), eq(weightLogs.userId, userId)));
}

export async function getFitnessDataInRange(userId: number, fromTs: number, toTs: number) {
  const db = await getDb();
  if (!db) return { intake: [], weights: [], lifts: [] };
  const [intake, weights, lifts] = await Promise.all([
    db.select().from(intakeLogs)
      .where(and(eq(intakeLogs.userId, userId), gte(intakeLogs.loggedAt, fromTs), lte(intakeLogs.loggedAt, toTs)))
      .orderBy(desc(intakeLogs.loggedAt)),
    db.select().from(weightLogs)
      .where(and(eq(weightLogs.userId, userId), gte(weightLogs.loggedAt, fromTs), lte(weightLogs.loggedAt, toTs)))
      .orderBy(desc(weightLogs.loggedAt)),
    db.select().from(liftLogs)
      .where(and(eq(liftLogs.userId, userId), gte(liftLogs.loggedAt, fromTs), lte(liftLogs.loggedAt, toTs)))
      .orderBy(desc(liftLogs.loggedAt)),
  ]);
  return { intake, weights, lifts };
}

// ─── Food facts cache ───

export async function getFoodFactsByKeys(keys: string[]) {
  const db = await getDb();
  if (!db || keys.length === 0) return [];
  return db.select().from(foodCache).where(inArray(foodCache.foodKey, keys));
}

/** Insert foods; rows whose key already exists are left untouched. */
export async function saveFoodFacts(facts: Array<typeof foodCache.$inferInsert>) {
  const db = await getDb();
  if (!db || facts.length === 0) return;
  await db.insert(foodCache).ignore().values(facts);
}

export async function getProductCache(key: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(productCache).where(eq(productCache.productKey, key)).limit(1);
  return rows[0] ?? null;
}

export async function saveProductCache(row: typeof productCache.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(productCache).values(row).onDuplicateKeyUpdate({
    set: { name: row.name, ingredients: row.ingredients, found: row.found, createdAt: new Date() },
  });
}

// ─── Trigger explanations (cached AI write-ups) ───

export async function getTriggerExplanation(userId: number, triggerKey: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(triggerExplanations)
    .where(and(eq(triggerExplanations.userId, userId), eq(triggerExplanations.triggerKey, triggerKey))).limit(1);
  return rows[0] ?? null;
}

export async function saveTriggerExplanation(userId: number, triggerKey: string, statsHash: string, explanation: TriggerExplanation) {
  const db = await getDb();
  if (!db) return;
  await db.insert(triggerExplanations).values({ userId, triggerKey, statsHash, explanation }).onDuplicateKeyUpdate({
    set: { statsHash, explanation, createdAt: new Date() },
  });
}

// ─── Dose log ───

export async function createDose(row: typeof doseLogs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(doseLogs).values(row);
  return result[0].insertId;
}

export async function getDosesByUser(userId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(doseLogs).where(eq(doseLogs.userId, userId)).orderBy(desc(doseLogs.loggedAt)).limit(limit);
}

export async function deleteDose(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(doseLogs).where(and(eq(doseLogs.id, id), eq(doseLogs.userId, userId)));
}

export async function getDoseSchedules(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(doseSchedules).where(eq(doseSchedules.userId, userId));
}

export async function setDoseSchedule(userId: number, compoundKey: string, intervalDays: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(doseSchedules).values({ userId, compoundKey, intervalDays }).onDuplicateKeyUpdate({ set: { intervalDays } });
}
