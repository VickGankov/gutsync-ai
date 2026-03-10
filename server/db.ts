import { eq, desc, and, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users,
  InsertMeal, meals, type MealFood,
  InsertSymptom, symptoms,
  InsertCorrelation, correlations,
  InsertWearableData, wearableData,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
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

// ─── Meal Queries ───

export async function createMeal(meal: InsertMeal) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(meals).values(meal);
  return result[0].insertId;
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

// ─── Wearable Data Queries ───

export async function createWearableEntry(entry: InsertWearableData) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(wearableData).values(entry);
  return result[0].insertId;
}

export async function getWearableDataByUser(userId: number, limit = 7) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(wearableData).where(eq(wearableData.userId, userId)).orderBy(desc(wearableData.recordedAt)).limit(limit);
}
