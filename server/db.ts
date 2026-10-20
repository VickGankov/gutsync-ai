import { isEmailInList } from "./access";
import { eq, desc, and, gte, lte, lt, or, sql, inArray, isNull } from "drizzle-orm";
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
  waistLogs, supplements, supplementLogs, labResults,
  pushSubscriptions, notificationPrefs, notificationLog,
} from "../drizzle/schema";
import { resolvePlan, scanLimitFor, type Plan } from "@shared/plans";
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

export async function setUserAvatar(userId: number, avatarUrl: string | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ avatarUrl }).where(eq(users.id, userId));
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

export interface Entitlement { plan: Plan; unlimited: boolean; dailyLimit: number | null; founderAt: number | null }

/** Works out a user's plan, their daily scan limit (null = unlimited) and when they became a founder. */
export async function getEntitlement(userId: number): Promise<Entitlement> {
  const user = await getUserById(userId);
  const unlimited = !!(ENV.unlimitedEmails && isEmailInList(user?.email, ENV.unlimitedEmails));
  const sub = await getSubscription(userId);
  const paid = !!sub && sub.tier === 'premium' && !(sub.expiresAt && sub.expiresAt < Date.now());
  const founderAt = user?.founderAt ?? null;
  const plan = resolvePlan({ premium: paid || unlimited, founder: founderAt != null });
  return { plan, unlimited, dailyLimit: unlimited ? null : scanLimitFor(plan), founderAt };
}

export async function countFounders(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const r = await db.select({ n: sql<number>`cast(count(*) as signed)` }).from(users).where(sql`${users.founderAt} is not null`);
  return Number(r[0]?.n ?? 0);
}

/** Marks a user as a founder if there is room. "already" when they are one. */
export async function claimFounder(userId: number, limit: number): Promise<"ok" | "already" | "full"> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const [u] = await db.select({ founderAt: users.founderAt }).from(users).where(eq(users.id, userId)).limit(1);
  if (u?.founderAt != null) return "already";
  if ((await countFounders()) >= limit) return "full";
  await db.update(users).set({ founderAt: Date.now() }).where(and(eq(users.id, userId), isNull(users.founderAt)));
  return "ok";
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

/** Fill in fiber for cached foods that were saved before fiber tracking. Never touches other columns. */
export async function saveFoodFiber(rows: Array<{ foodKey: string; fiberPer100gTenths: number }>) {
  const db = await getDb();
  if (!db || rows.length === 0) return;
  for (const r of rows) {
    await db.update(foodCache).set({ fiberPer100gTenths: r.fiberPer100gTenths }).where(and(eq(foodCache.foodKey, r.foodKey), isNull(foodCache.fiberPer100gTenths)));
  }
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


// ─── Waist ───

export async function createWaistLog(userId: number, waistIn10: number, loggedAt: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(waistLogs).values({ userId, waistIn10, loggedAt });
  return result[0].insertId;
}

export async function getWaistLogs(userId: number, fromTs: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(waistLogs)
    .where(and(eq(waistLogs.userId, userId), gte(waistLogs.loggedAt, fromTs)))
    .orderBy(desc(waistLogs.loggedAt));
}

export async function deleteWaistLog(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(waistLogs).where(and(eq(waistLogs.id, id), eq(waistLogs.userId, userId)));
}

// ─── Supplement checklist ───

export async function getSupplements(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(supplements)
    .where(and(eq(supplements.userId, userId), eq(supplements.archived, false)))
    .orderBy(supplements.id);
}

export async function addSupplement(userId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(supplements).values({ userId, name });
  return result[0].insertId;
}

export async function archiveSupplement(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(supplements).set({ archived: true }).where(and(eq(supplements.id, id), eq(supplements.userId, userId)));
}

/** Supplement ids taken on each given local date. */
export async function getSupplementLogs(userId: number, dateKeys: string[]) {
  const db = await getDb();
  if (!db || dateKeys.length === 0) return [];
  return db.select().from(supplementLogs)
    .where(and(eq(supplementLogs.userId, userId), inArray(supplementLogs.dateKey, dateKeys)));
}

export async function setSupplementTaken(userId: number, supplementId: number, dateKey: string, taken: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Only the owner's own supplements can be checked off.
  const own = await db.select({ id: supplements.id, dose: supplements.dose }).from(supplements)
    .where(and(eq(supplements.id, supplementId), eq(supplements.userId, userId))).limit(1);
  if (own.length === 0) throw new Error("Supplement not found");
  if (taken) {
    await db.insert(supplementLogs).ignore().values({ userId, supplementId, dateKey, dose: own[0].dose ?? null, loggedAt: Date.now() });
  } else {
    await db.delete(supplementLogs).where(and(eq(supplementLogs.supplementId, supplementId), eq(supplementLogs.dateKey, dateKey), eq(supplementLogs.userId, userId)));
  }
}

/** Set or clear a supplement's dose. If it was already ticked on `dateKey`, that day's record follows the change. */
export async function setSupplementDose(userId: number, supplementId: number, dose: string | null, dateKey?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const res = await db.update(supplements).set({ dose }).where(and(eq(supplements.id, supplementId), eq(supplements.userId, userId)));
  if (dateKey) {
    await db.update(supplementLogs).set({ dose })
      .where(and(eq(supplementLogs.supplementId, supplementId), eq(supplementLogs.userId, userId), eq(supplementLogs.dateKey, dateKey)));
  }
  return res;
}

/** Every supplement the user has had (archived too, so history stays) with the days taken in a date range. */
export async function getSupplementHistory(userId: number, fromKey: string, toKey: string) {
  const db = await getDb();
  if (!db) return { names: new Map<number, string>(), logs: [] as { supplementId: number; dateKey: string; dose: string | null }[] };
  const [items, logs] = await Promise.all([
    db.select({ id: supplements.id, name: supplements.name }).from(supplements).where(eq(supplements.userId, userId)),
    db.select({ supplementId: supplementLogs.supplementId, dateKey: supplementLogs.dateKey, dose: supplementLogs.dose }).from(supplementLogs)
      .where(and(eq(supplementLogs.userId, userId), gte(supplementLogs.dateKey, fromKey), lte(supplementLogs.dateKey, toKey))),
  ]);
  return { names: new Map(items.map(i => [i.id, i.name])), logs };
}

// ─── Blood work ───

export async function getLabResults(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(labResults).where(eq(labResults.userId, userId)).orderBy(labResults.drawnOn, labResults.id).limit(2000);
}

export type NewLabResult = { marker: string; value: number; unit: string; refLow: number | null; refHigh: number | null; drawnOn: string; notes?: string | null };

export async function addLabResults(userId: number, rows: NewLabResult[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  if (rows.length === 0) return 0;
  await db.insert(labResults).values(rows.map(r => ({ ...r, notes: r.notes ?? null, userId })));
  return rows.length;
}

export async function updateLabResult(userId: number, id: number, patch: Partial<NewLabResult>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(labResults).set(patch).where(and(eq(labResults.id, id), eq(labResults.userId, userId)));
}

/** Rename every result of one marker, which merges it into `to` when the user already has results under that name. */
export async function renameLabMarker(userId: number, from: string, to: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(labResults).set({ marker: to }).where(and(eq(labResults.userId, userId), eq(labResults.marker, from)));
}

export async function deleteLabResult(userId: number, id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(labResults).where(and(eq(labResults.id, id), eq(labResults.userId, userId)));
}


/** Everything the user has logged, for "Export My Data". Never includes the password hash or other accounts' data. */
export async function exportUserData(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const mine = <T extends { userId: any }>(t: any) => db.select().from(t).where(eq((t as T).userId, userId));
  const [account] = await db.select({ email: users.email, name: users.name, createdAt: users.createdAt, sensitivities: users.sensitivities }).from(users).where(eq(users.id, userId)).limit(1);
  const [
    mealRows, symptomRows, fitness, weights, waists, intake, lifts, supps, suppLogs, doses, schedules, labs, challenges,
  ] = await Promise.all([
    mine(meals), mine(symptoms), mine(fitnessProfile), mine(weightLogs), mine(waistLogs), mine(intakeLogs), mine(liftLogs),
    mine(supplements), mine(supplementLogs), mine(doseLogs), mine(doseSchedules), mine(labResults), mine(reintroChallenges),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    account: account ?? null,
    meals: mealRows, symptoms: symptomRows, fitnessProfile: fitness,
    weightLogs: weights, waistLogs: waists, intakeLogs: intake, liftLogs: lifts,
    supplements: supps, supplementLogs: suppLogs, doseLogs: doses, doseSchedules: schedules,
    labResults: labs, reintroChallenges: challenges,
  };
}


// ─── Reminders ───

export type NotificationPrefs = { mealReminders: boolean; mealTimes: string[]; symptomCheckins: boolean; timeZone: string };

export async function getNotificationPrefs(userId: number): Promise<NotificationPrefs | null> {
  const db = await getDb();
  if (!db) return null;
  const [r] = await db.select().from(notificationPrefs).where(eq(notificationPrefs.userId, userId)).limit(1);
  return r ? { mealReminders: r.mealReminders, mealTimes: r.mealTimes, symptomCheckins: r.symptomCheckins, timeZone: r.timeZone } : null;
}

export async function saveNotificationPrefs(userId: number, p: NotificationPrefs) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(notificationPrefs).values({ userId, ...p })
    .onDuplicateKeyUpdate({ set: { mealReminders: p.mealReminders, mealTimes: p.mealTimes, symptomCheckins: p.symptomCheckins, timeZone: p.timeZone } });
}

export async function listUsersWithReminders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notificationPrefs).where(or(eq(notificationPrefs.mealReminders, true), eq(notificationPrefs.symptomCheckins, true)));
}

export async function saveSubscription(userId: number, sub: { endpoint: string; p256dh: string; auth: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // The same browser can be re-subscribed after signing in as someone else; the endpoint belongs to the latest user.
  await db.insert(pushSubscriptions).values({ userId, ...sub })
    .onDuplicateKeyUpdate({ set: { userId, p256dh: sub.p256dh, auth: sub.auth } });
}

export async function getSubscriptions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

export async function deleteSubscription(endpoint: string, userId?: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(pushSubscriptions).where(userId === undefined
    ? eq(pushSubscriptions.endpoint, endpoint)
    : and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));
}

/** True the first time a (user, key) is claimed, false if it was already sent. */
export async function claimNotification(userId: number, key: string, kind: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    await db.insert(notificationLog).values({ userId, key, kind });
    return true;
  } catch {
    return false;
  }
}

export async function releaseNotification(userId: number, key: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(notificationLog).where(and(eq(notificationLog.userId, userId), eq(notificationLog.key, key)));
}

export async function lastNotificationAt(userId: number, kind: string): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [r] = await db.select({ at: notificationLog.sentAt }).from(notificationLog)
    .where(and(eq(notificationLog.userId, userId), eq(notificationLog.kind, kind))).orderBy(desc(notificationLog.sentAt)).limit(1);
  return r ? r.at.getTime() : null;
}

export async function pruneNotificationLog(olderThanMs: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(notificationLog).where(lt(notificationLog.sentAt, new Date(Date.now() - olderThanMs)));
}

export async function getLastMealAt(userId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [r] = await db.select({ at: meals.loggedAt }).from(meals).where(eq(meals.userId, userId)).orderBy(desc(meals.loggedAt)).limit(1);
  return r?.at ?? null;
}

export async function getLastSymptomAt(userId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const [r] = await db.select({ at: symptoms.loggedAt }).from(symptoms).where(eq(symptoms.userId, userId)).orderBy(desc(symptoms.loggedAt)).limit(1);
  return r?.at ?? null;
}

export async function setUserSensitivities(userId: number, keys: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ sensitivities: keys }).where(eq(users.id, userId));
}
