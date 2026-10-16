import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut, storageDelete, avatarKeyFromUrl } from "./storage";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  createMeal,
  saveFoodFiber,
  createWaistLog, getWaistLogs, deleteWaistLog,
  getSupplements, addSupplement, archiveSupplement, getSupplementLogs, setSupplementTaken,
  setSupplementDose, setUserAvatar, getSupplementHistory, getLabResults, addLabResults, updateLabResult, renameLabMarker, deleteLabResult,
  updateMeal,
  deleteMeal,
  getMealsByUser,
  getMealsInRange,
  createSymptom,
  getSymptomsByUser,
  updateSymptomSeverity,
  deleteSymptom,
  getFoodFactsByKeys, getProductCache, saveProductCache,
  saveFoodFacts,
  upsertCorrelation,
  getCorrelationsByUser,

  getSubscription,
  isPremium,
  upsertSubscription,
  cancelSubscription,
  getTodayScanCount,
  incrementScanCount,
  getReintroChallenges,
  getActiveReintroChallenge,
  createReintroChallenge,
  updateReintroCheckIns,
  finishReintroChallenge,
  getFitnessProfile,
  upsertFitnessProfile,
  createWeightLog,
  deleteWeightLog,
  createIntakeLog,
  deleteIntakeLog,
  createLiftLog,
  deleteLiftLog,
  getFitnessDataInRange,
  createDose, getDosesByUser, deleteDose, getDoseSchedules, setDoseSchedule,
} from "./db";
import {
  REINTRO_GROUPS,
  assessChallenge,
  currentChallengeDay,
  type ReintroCheckIn,
} from "@shared/reintro";
import { buildFitnessSummary, DAY_MS } from "./fitness";
import { findProduct } from "./productLookup";
import { loadTriggers, getOrCreateExplanation, triggerKey } from "./triggerInsights";
import { ofMeals, pct } from "../shared/triggers";
import { SITES, compoundKey, fmtMg } from "../shared/dose";
import { buildRuns, matchExisting, normalizeMarker, type Run } from "../shared/labs";
import { dateKeyOf } from "../shared/weekly";
import { extractLabs, pdfToText } from "./labExtract";
import { analyzeWithCache, identifyFoods, identifyFoodsFromText, lookupFoodFacts, ensureFoodSeed, readLabelImage, applyLabelToFoods } from "./foodAnalysis";
import { classifyIngredients } from "../shared/ingredients";
import { TRPCError } from "@trpc/server";
import type { MealFood } from "../drizzle/schema";

// Free tier: 3 AI scans per day
const FREE_DAILY_SCAN_LIMIT = 10;

function getRequestBaseUrl(req: { protocol?: string; headers?: Record<string, string | string[] | undefined>; get?: (name: string) => string | undefined }) {
  const origin = req.get?.('origin') || req.headers?.origin;
  if (typeof origin === 'string' && origin) return origin;

  const forwardedProto = req.headers?.['x-forwarded-proto'];
  const forwardedHost = req.headers?.['x-forwarded-host'];
  const host = forwardedHost || req.headers?.host;
  const proto = forwardedProto || req.protocol || 'https';

  if (typeof host === 'string') return `${Array.isArray(proto) ? proto[0] : proto}://${host}`;
  return undefined;
}

// ─── AI Food Analysis ───

async function analyzeFood(imageUrl: string): Promise<{
  foods: MealFood[];
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  summary: string;
}> {
  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are GutSync, a specialized food analysis assistant for people with IBS and gut health issues.
Analyze the food photo and return a JSON object with:
- foods: array of food items, each with { name, category, fodmap, hiddenIngredients, proteinGrams }
  - category: one of "protein", "carb", "fat", "vegetable", "fruit", "dairy", "grain", "other"
  - fodmap: one of "low", "moderate", "high" (based on Monash University FODMAP guidelines)
  - hiddenIngredients: array of likely hidden ingredients (e.g. garlic powder, onion, HFCS, wheat)
  - proteinGrams: your best estimate of grams of protein in the visible portion (number, 0 if negligible)
- mealType: one of "breakfast", "lunch", "dinner", "snack" (infer from the food items)
- summary: a brief 1-sentence description of the meal

Be thorough about hidden ingredients that are common IBS triggers. Consider:
- Garlic and onion (in sauces, seasonings, dressings)
- High-fructose corn syrup (in breads, condiments)
- Wheat (in sauces, coatings)
- Lactose (in cream-based items)
- Sugar alcohols (in "sugar-free" items)`,
      },
      {
        role: "user",
        content: [
          { type: "text", text: "Analyze this meal photo for gut health tracking. Identify all foods, their FODMAP levels, and any likely hidden ingredients." },
          { type: "image_url", image_url: { url: imageUrl, detail: "auto" } },
        ],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "food_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            foods: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Name of the food item" },
                  category: {
                    type: "string",
                    enum: ["protein", "carb", "fat", "vegetable", "fruit", "dairy", "grain", "other"],
                  },
                  fodmap: {
                    type: "string",
                    enum: ["low", "moderate", "high"],
                  },
                  hiddenIngredients: {
                    type: "array",
                    items: { type: "string" },
                    description: "Likely hidden ingredients that could trigger IBS",
                  },
                  proteinGrams: {
                    type: "number",
                    description: "Estimated grams of protein in the visible portion",
                  },
                },
                required: ["name", "category", "fodmap", "hiddenIngredients", "proteinGrams"],
                additionalProperties: false,
              },
            },
            mealType: {
              type: "string",
              enum: ["breakfast", "lunch", "dinner", "snack"],
            },
            summary: { type: "string" },
          },
          required: ["foods", "mealType", "summary"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("AI analysis returned empty response");
  }
  return JSON.parse(content);
}

/** Fast path: identify foods, read facts from the shared cache, ask the AI only about new foods. */
async function analyzeMeal(imageUrl: string) {
  await ensureFoodSeed(saveFoodFacts);
  return analyzeWithCache(imageUrl, {
    identify: identifyFoods,
    lookup: lookupFoodFacts,
    getFacts: getFoodFactsByKeys,
    saveFacts: saveFoodFacts,
    saveFiber: saveFoodFiber,
    findProduct: name => findProduct(name, { get: getProductCache, save: saveProductCache }),
    legacy: analyzeFood,
  });
}

/** Same pipeline for a typed description: "2 eggs, toast with butter, coffee". */
async function analyzeMealText(text: string) {
  await ensureFoodSeed(saveFoodFacts);
  return analyzeWithCache(text, {
    identify: identifyFoodsFromText,
    lookup: lookupFoodFacts,
    getFacts: getFoodFactsByKeys,
    saveFacts: saveFoodFacts,
    saveFiber: saveFoodFiber,
    findProduct: name => findProduct(name, { get: getProductCache, save: saveProductCache }),
    // There is no single-call fallback for text: surface the real error instead.
    legacy: async () => { throw new Error("Could not analyze that description. Try again or add the items by hand."); },
  });
}

/** Throws FREE_LIMIT_REACHED for free users at their daily limit. Returns whether the user is premium. */
async function enforceScanLimit(userId: number): Promise<boolean> {
  const premium = await isPremium(userId);
  if (!premium) {
    const todayCount = await getTodayScanCount(userId);
    if (todayCount >= FREE_DAILY_SCAN_LIMIT) {
      throw new TRPCError({ code: 'FORBIDDEN', message: `FREE_LIMIT_REACHED:${todayCount}` });
    }
  }
  return premium;
}

const labRowInput = z.object({
  marker: z.string().trim().min(1).max(60),
  value: z.number().finite().min(-1e9).max(1e9),
  unit: z.string().trim().min(1).max(24),
  refLow: z.number().finite().nullable().optional(),
  refHigh: z.number().finite().nullable().optional(),
  drawnOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(200).optional(),
});

function cleanLabRow(r: z.infer<typeof labRowInput>, existing: string[] = []) {
  const today = new Date(Date.now() + 14 * 3600_000).toISOString().slice(0, 10); // allow any timezone's "today"
  if (r.drawnOn > today) throw new TRPCError({ code: "BAD_REQUEST", message: "The draw date can't be in the future." });
  let refLow = r.refLow ?? null, refHigh = r.refHigh ?? null;
  if (refLow !== null && refHigh !== null && refLow > refHigh) { refLow = null; refHigh = null; }
  return { marker: matchExisting(normalizeMarker(r.marker), existing), value: r.value, unit: r.unit, refLow, refHigh, drawnOn: r.drawnOn, notes: r.notes || null };
}

// ─── Router ───

/** The marker names this user already has, so new entries fold into them. */
async function existingMarkers(userId: number) {
  return Array.from(new Set((await getLabResults(userId)).map(r => r.marker)));
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    /** Only fields the app needs. The full row holds the password hash, which must never reach the browser. */
    me: publicProcedure.query(opts => {
      const u = opts.ctx.user;
      return u ? { id: u.id, email: u.email, name: u.name, role: u.role, avatarUrl: u.avatarUrl ?? null } : null;
    }),
    registerEmail: publicProcedure.input(z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().optional() })).mutation(async ({ input, ctx }) => {
      const { registerEmail } = await import('./emailAuth');
      const user = await registerEmail(input.email, input.password, input.name);
      const { sdk } = await import('./_core/sdk');
      const token = await sdk.createSessionToken(user.id.toString(), { name: user.name || '' });
      const opts = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...opts, maxAge: 365*24*60*60*1000 });
      return { success: true, user };
    }),
    loginEmail: publicProcedure.input(z.object({ email: z.string().email(), password: z.string() })).mutation(async ({ input, ctx }) => {
      const { loginEmail } = await import('./emailAuth');
      const user = await loginEmail(input.email, input.password);
      const { sdk } = await import('./_core/sdk');
      const token = await sdk.createSessionToken(user.id.toString(), { name: user.name || '' });
      const opts = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...opts, maxAge: 365*24*60*60*1000 });
      return { success: true, user };
    }),
    forgotPassword: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ input, ctx }) => {
        const { requestPasswordReset } = await import('./emailAuth');
        await requestPasswordReset(input.email, getRequestBaseUrl(ctx.req));
        return { success: true } as const;
      }),
    resetPassword: publicProcedure
      .input(z.object({ token: z.string().min(1), newPassword: z.string().min(8) }))
      .mutation(async ({ input }) => {
        const { resetPasswordWithToken } = await import('./emailAuth');
        await resetPasswordWithToken(input.token, input.newPassword);
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  meals: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
      .query(async ({ ctx, input }) => {
        return getMealsByUser(ctx.user.id, input?.limit ?? 20);
      }),

    analyzePhoto: protectedProcedure
      .input(z.object({
        imageBase64: z.string(),
        mimeType: z.string().optional(),
        /** Optional photo of the ingredient label, analysed together with the food photo as one scan. */
        labelBase64: z.string().optional(),
        labelMimeType: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const premium = await enforceScanLimit(ctx.user.id);

        // Upload the photo and run the AI analysis at the same time.
        // The image is sent inline so the AI provider never has to fetch it from storage.
        const fileKey = `meals/${ctx.user.id}/${nanoid()}.jpg`;
        const imageBuffer = Buffer.from(input.imageBase64, "base64");
        const labelPromise = input.labelBase64
          ? readLabelImage(`data:${input.labelMimeType || "image/jpeg"};base64,${input.labelBase64}`).catch(() => null)
          : Promise.resolve(null);
        const [{ url: photoUrl }, analysis, label] = await Promise.all([
          storagePut(fileKey, imageBuffer, input.mimeType || "image/jpeg"),
          analyzeMeal(`data:${input.mimeType || "image/jpeg"};base64,${input.imageBase64}`),
          labelPromise,
        ]);
        const labelUsed = !!label && label.ingredients.length >= 2;
        if (label && analysis.foods?.length) analysis.foods = applyLabelToFoods(analysis.foods, label);

        // ── Reject if no food detected ──────────────────────────────
        if (!analysis.foods || analysis.foods.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'NO_FOOD_DETECTED',
          });
        }

        // Increment scan usage for free-tier tracking
        if (!premium) {
          await incrementScanCount(ctx.user.id);
        }

        return {
          photoUrl,
          mealType: analysis.mealType,
          foods: analysis.foods,
          summary: analysis.summary,
          timings: analysis.timings ?? null,
          labelRead: input.labelBase64 ? labelUsed : null,
        };
      }),

    /** Typed meal description instead of a photo. Counts as one scan, like a photo. */
    analyzeText: protectedProcedure
      .input(z.object({ text: z.string().trim().min(2).max(600) }))
      .mutation(async ({ ctx, input }) => {
        const premium = await enforceScanLimit(ctx.user.id);
        const analysis = await analyzeMealText(input.text);
        if (!analysis.foods || analysis.foods.length === 0) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'NO_FOOD_DETECTED' });
        }
        if (!premium) await incrementScanCount(ctx.user.id);
        return {
          photoUrl: null,
          mealType: analysis.mealType,
          foods: analysis.foods,
          summary: analysis.summary,
          timings: analysis.timings ?? null,
        };
      }),

    /** Read an ingredient label from a photo and classify its FODMAP triggers. Counts as one scan. */
    readLabel: protectedProcedure
      .input(z.object({ imageBase64: z.string(), mimeType: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        const premium = await enforceScanLimit(ctx.user.id);
        const label = await readLabelImage(`data:${input.mimeType || "image/jpeg"};base64,${input.imageBase64}`);
        if (label.ingredients.length < 2) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'LABEL_NOT_READABLE' });
        }
        if (!premium) await incrementScanCount(ctx.user.id);
        const verdict = classifyIngredients(label.ingredients);
        return {
          productName: label.productName || null,
          ingredients: label.ingredients,
          fodmap: verdict.fodmap,
          hiddenIngredients: verdict.triggers,
          proteinGrams: label.proteinGrams > 0 ? Math.round(label.proteinGrams) : null,
          allIngredients: label.ingredients,
        };
      }),

    logManual: protectedProcedure
      .input(z.object({
        mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
        foods: z.array(z.object({
          name: z.string(),
          category: z.enum(["protein", "carb", "fat", "vegetable", "fruit", "dairy", "grain", "other"]),
          fodmap: z.enum(["low", "moderate", "high"]),
          hiddenIngredients: z.array(z.string()),
          proteinGrams: z.number().min(0).max(500).optional(),
          fiberGrams: z.number().min(0).max(200).optional(),
          ingredients: z.array(z.string().max(160)).max(80).optional(),
          volumeMl: z.number().int().min(0).max(5000).optional(),
        })),
        notes: z.string().optional(),
        photoUrl: z.string().optional(),
        /** When it was eaten (ms). Defaults to now; must be in the past 30 days and not in the future. */
        loggedAt: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const now = Date.now();
        if (input.loggedAt !== undefined && (input.loggedAt > now + 5 * 60_000 || input.loggedAt < now - 30 * 86_400_000)) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'The time must be within the last 30 days and not in the future.' });
        }
        const mealId = await createMeal({
          userId: ctx.user.id,
          mealType: input.mealType,
          foods: input.foods,
          notes: input.notes ?? null,
          photoUrl: input.photoUrl,
          loggedAt: Math.min(input.loggedAt ?? now, now),
        });
        return { id: mealId };
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
        foods: z.array(z.object({
          name: z.string(),
          category: z.enum(["protein", "carb", "fat", "vegetable", "fruit", "dairy", "grain", "other"]),
          fodmap: z.enum(["low", "moderate", "high"]),
          hiddenIngredients: z.array(z.string()),
          proteinGrams: z.number().min(0).max(500).optional(),
          fiberGrams: z.number().min(0).max(200).optional(),
          ingredients: z.array(z.string().max(160)).max(80).optional(),
          volumeMl: z.number().int().min(0).max(5000).optional(),
        })).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await updateMeal(ctx.user.id, input.id, {
          ...(input.mealType && { mealType: input.mealType }),
          ...(input.foods && { foods: input.foods }),
          ...(input.notes !== undefined && { notes: input.notes }),
        });
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteMeal(ctx.user.id, input.id);
        return { success: true };
      }),
  }),

  symptoms: router({
    list: protectedProcedure
      .input(z.object({ limit: z.number().min(1).max(50).optional() }).optional())
      .query(async ({ ctx, input }) => {
        return getSymptomsByUser(ctx.user.id, input?.limit ?? 20);
      }),

    log: protectedProcedure
      .input(z.object({
        type: z.enum(["bloating", "abdominal_pain", "gas", "nausea", "fatigue", "headache", "diarrhea", "constipation", "acid_reflux", "vomiting", "low_appetite", "energy_boost", "better_digestion", "improved_mood", "better_sleep", "clearer_skin", "reduced_brain_fog", "injection_site_reaction", "dizziness", "racing_heart"]),
        severity: z.number().min(1).max(5),
        source: z.enum(["manual"]).optional(),
        notes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const symptomId = await createSymptom({
          userId: ctx.user.id,
          type: input.type,
          severity: input.severity,
          source: input.source ?? "manual",
          notes: input.notes ?? null,
          loggedAt: Date.now(),
        });
        return { id: symptomId };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number().int(), severity: z.number().int().min(1).max(5) }))
      .mutation(async ({ ctx, input }) => {
        await updateSymptomSeverity(ctx.user.id, input.id, input.severity);
        return { success: true } as const;
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await deleteSymptom(ctx.user.id, input.id);
        return { success: true } as const;
      }),
  }),

  reintro: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getReintroChallenges(ctx.user.id);
    }),

    start: protectedProcedure
      .input(z.object({
        foodGroup: z.enum(REINTRO_GROUPS),
        testFood: z.string().trim().min(1).max(100),
        doses: z.tuple([z.string().trim().min(1).max(40), z.string().trim().min(1).max(40), z.string().trim().min(1).max(40)]),
      }))
      .mutation(async ({ ctx, input }) => {
        const active = await getActiveReintroChallenge(ctx.user.id);
        if (active) {
          throw new TRPCError({ code: "CONFLICT", message: "Finish or stop your current challenge before starting another." });
        }
        const id = await createReintroChallenge({ userId: ctx.user.id, ...input, startedAt: Date.now() });
        return { id };
      }),

    checkIn: protectedProcedure
      .input(z.object({
        id: z.number(),
        day: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        severity: z.number().int().min(0).max(5),
        stressed: z.boolean(),
        poorSleep: z.boolean(),
        ateDose: z.boolean(),
        note: z.string().max(500).optional(),
        tzOffsetMinutes: z.number().int().min(-840).max(840).default(0),
      }))
      .mutation(async ({ ctx, input }) => {
        const challenge = await getActiveReintroChallenge(ctx.user.id);
        if (!challenge || challenge.id !== input.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "No active challenge with that id." });
        }
        const now = Date.now();
        const dueDay = currentChallengeDay(challenge.startedAt, now, input.tzOffsetMinutes);
        if (input.day > dueDay) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Day ${input.day} hasn't started yet.` });
        }
        const checkIn: ReintroCheckIn = {
          day: input.day,
          severity: input.severity,
          stressed: input.stressed,
          poorSleep: input.poorSleep,
          ateDose: input.ateDose,
          ...(input.note ? { note: input.note } : {}),
          loggedAt: now,
        };
        const checkIns = [...(challenge.checkIns ?? []).filter(c => c.day !== input.day), checkIn]
          .sort((a, b) => a.day - b.day);
        await updateReintroCheckIns(ctx.user.id, challenge.id, checkIns);

        // assessChallenge returns a result once all 3 days are in, or early on a reaction
        // (the dose is never increased after symptoms).
        const assessment = assessChallenge(checkIns);
        if (assessment) {
          await finishReintroChallenge(ctx.user.id, challenge.id, {
            status: "completed",
            outcome: assessment.outcome,
            toleratedDay: assessment.toleratedDay,
            lowConfidence: assessment.lowConfidence,
            finishedAt: now,
          });
        }
        return { assessment };
      }),

    abandon: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await finishReintroChallenge(ctx.user.id, input.id, {
          status: "abandoned", outcome: null, toleratedDay: null, lowConfidence: false, finishedAt: Date.now(),
        });
        return { success: true };
      }),
  }),

  profile: router({
    /** Replace the profile photo. The browser sends a small square JPEG; we check it really is one before storing. */
    setAvatar: protectedProcedure
      .input(z.object({ imageBase64: z.string().max(400_000) }))
      .mutation(async ({ ctx, input }) => {
        const buf = Buffer.from(input.imageBase64, "base64");
        const isJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
        if (!isJpeg || buf.length > 250_000) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "That photo couldn't be used. Try a different one." });
        }
        let url: string;
        try {
          ({ url } = await storagePut(`avatars/${ctx.user.id}/${nanoid()}.jpg`, buf, "image/jpeg"));
        } catch (e) {
          console.error("[profile.setAvatar] upload failed:", e);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn't save your photo. Try again in a moment." });
        }
        const oldKey = avatarKeyFromUrl(ctx.user.avatarUrl, ctx.user.id);
        await setUserAvatar(ctx.user.id, url);
        if (oldKey) await storageDelete(oldKey);
        return { avatarUrl: url };
      }),

    removeAvatar: protectedProcedure.mutation(async ({ ctx }) => {
      const oldKey = avatarKeyFromUrl(ctx.user.avatarUrl, ctx.user.id);
      await setUserAvatar(ctx.user.id, null);
      if (oldKey) await storageDelete(oldKey);
      return { success: true };
    }),
  }),

  supplement: router({
    /** The user's checklist with which items are checked on the given local dates. */
    list: protectedProcedure
      .input(z.object({ dateKeys: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(14) }))
      .query(async ({ ctx, input }) => {
        const [items, logs] = await Promise.all([getSupplements(ctx.user.id), getSupplementLogs(ctx.user.id, input.dateKeys)]);
        return {
          items: items.map(i => ({ id: i.id, name: i.name, dose: i.dose ?? null })),
          taken: logs.map(l => ({ supplementId: l.supplementId, dateKey: l.dateKey })),
        };
      }),

    add: protectedProcedure
      .input(z.object({ name: z.string().trim().min(1).max(60), dose: z.string().trim().max(40).optional() }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getSupplements(ctx.user.id);
        if (existing.length >= 20) throw new TRPCError({ code: 'BAD_REQUEST', message: 'You can keep up to 20 supplements.' });
        if (existing.some(e => e.name.toLowerCase() === input.name.toLowerCase())) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'That one is already on your list.' });
        }
        const id = await addSupplement(ctx.user.id, input.name);
        if (input.dose) await setSupplementDose(ctx.user.id, id, input.dose);
        return { id };
      }),

    /** Optional free-text dose, e.g. "2000 IU". Empty clears it. If it was ticked today, today's record follows. */
    setDose: protectedProcedure
      .input(z.object({ id: z.number().int(), dose: z.string().trim().max(40), dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }))
      .mutation(async ({ ctx, input }) => {
        await setSupplementDose(ctx.user.id, input.id, input.dose || null, input.dateKey);
        return { success: true };
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await archiveSupplement(ctx.user.id, input.id);
        return { success: true };
      }),

    toggle: protectedProcedure
      .input(z.object({ id: z.number().int(), dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), taken: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        await setSupplementTaken(ctx.user.id, input.id, input.dateKey, input.taken);
        return { success: true };
      }),
  }),

  labs: router({
    list: protectedProcedure.query(async ({ ctx }) => getLabResults(ctx.user.id)),

    add: protectedProcedure
      .input(labRowInput)
      .mutation(async ({ ctx, input }) => {
        await addLabResults(ctx.user.id, [cleanLabRow(input, await existingMarkers(ctx.user.id))]);
        return { success: true };
      }),

    /** Save the rows the user reviewed and confirmed from an imported report. */
    addMany: protectedProcedure
      .input(z.object({ rows: z.array(labRowInput).min(1).max(100) }))
      .mutation(async ({ ctx, input }) => {
        const existing = await existingMarkers(ctx.user.id);
        const saved = await addLabResults(ctx.user.id, input.rows.map(r => cleanLabRow(r, existing)));
        return { saved };
      }),

    update: protectedProcedure
      .input(z.object({ id: z.number().int(), row: labRowInput }))
      .mutation(async ({ ctx, input }) => {
        await updateLabResult(ctx.user.id, input.id, cleanLabRow(input.row, await existingMarkers(ctx.user.id)));
        return { success: true };
      }),

    /** Rename a marker, or merge it into another one the user already has (e.g. "LDL" and "LDLC"). */
    renameMarker: protectedProcedure
      .input(z.object({ from: z.string().trim().min(1).max(60), to: z.string().trim().min(1).max(60) }))
      .mutation(async ({ ctx, input }) => {
        const to = normalizeMarker(input.to);
        if (to === input.from) return { success: true };
        await renameLabMarker(ctx.user.id, input.from, to);
        return { success: true, marker: to };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await deleteLabResult(ctx.user.id, input.id);
        return { success: true };
      }),

    /** Read a report photo, screenshot or text PDF into draft rows. Nothing is saved and the file is not kept. Counts as one scan. */
    extract: protectedProcedure
      .input(z.object({ fileBase64: z.string().max(14_000_000), mimeType: z.string().max(60) }))
      .mutation(async ({ ctx, input }) => {
        const premium = await enforceScanLimit(ctx.user.id);
        const isPdf = input.mimeType === "application/pdf";
        if (!isPdf && !/^image\/(jpeg|png|webp|heic|heif)$/.test(input.mimeType)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a photo, screenshot or PDF of your report." });
        }
        let result;
        try {
          if (isPdf) {
            const text = await pdfToText(Buffer.from(input.fileBase64, "base64"));
            if (text.length < 40) {
              throw new TRPCError({ code: "BAD_REQUEST", message: "This PDF looks like a scan with no readable text. Upload a photo or screenshot of the results instead." });
            }
            result = await extractLabs({ kind: "text", text });
          } else {
            result = await extractLabs({ kind: "image", dataUrl: `data:${input.mimeType};base64,${input.fileBase64}` });
          }
        } catch (e) {
          if (e instanceof TRPCError) throw e;
          console.error("[labs.extract] failed:", e);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Couldn't read that report. Try a clearer photo, or enter the values by hand." });
        }
        if (result.rows.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "No numeric results found in that file. Try a clearer photo, or enter the values by hand." });
        }
        if (!premium) await incrementScanCount(ctx.user.id);
        // Fold names into markers the user already tracks, so a new report extends the same chart.
        const existing = await existingMarkers(ctx.user.id);
        return { ...result, rows: result.rows.map(r => ({ ...r, marker: matchExisting(r.marker, existing) })) };
      }),

    /** What the user was taking between two dates: supplement runs (with dose changes) and logged compound doses. */
    overlay: protectedProcedure
      .input(z.object({
        fromKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        toKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        tzOffsetMinutes: z.number().int().min(-840).max(840),
      }))
      .query(async ({ ctx, input }): Promise<{ runs: Run[] }> => {
        const [hist, doses] = await Promise.all([
          getSupplementHistory(ctx.user.id, input.fromKey, input.toKey),
          getDosesByUser(ctx.user.id, 1000),
        ]);
        const runs: Run[] = [];
        const bySupp = new Map<number, { dateKey: string; dose: string | null }[]>();
        for (const l of hist.logs) bySupp.set(l.supplementId, [...(bySupp.get(l.supplementId) ?? []), { dateKey: l.dateKey, dose: l.dose ?? null }]);
        bySupp.forEach((entries, id) => runs.push(...buildRuns(hist.names.get(id) ?? "Supplement", "supplement", entries, 3)));

        const byCompound = new Map<string, { label: string; entries: { dateKey: string; dose: string | null }[] }>();
        for (const d of doses) {
          const key = compoundKey(d.compound);
          const dateKey = dateKeyOf(d.loggedAt, input.tzOffsetMinutes);
          if (dateKey < input.fromKey || dateKey > input.toKey) continue;
          const g = byCompound.get(key) ?? { label: d.compound, entries: [] };
          g.entries.push({ dateKey, dose: fmtMg(d.doseMcg) });
          byCompound.set(key, g);
        }
        byCompound.forEach(g => runs.push(...buildRuns(g.label, "compound", g.entries, 21)));
        return { runs: runs.sort((a, b) => a.startOn.localeCompare(b.startOn)) };
      }),
  }),

  dose: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const [doses, schedules] = await Promise.all([getDosesByUser(ctx.user.id, 200), getDoseSchedules(ctx.user.id)]);
      return {
        doses,
        schedules: schedules.map(s => ({ compound: s.compoundKey, intervalDays: s.intervalDays })),
      };
    }),

    log: protectedProcedure
      .input(z.object({
        compound: z.string().trim().min(1).max(80),
        doseMcg: z.number().int().min(1).max(50_000),
        site: z.enum(SITES).optional(),
        notes: z.string().max(500).optional(),
        loggedAt: z.number().int().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const now = Date.now();
        const at = input.loggedAt ?? now;
        if (at > now + 5 * 60_000 || at < now - 366 * 86_400_000) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Dose time must be within the last year and not in the future" });
        }
        const id = await createDose({
          userId: ctx.user.id,
          compound: input.compound,
          doseMcg: input.doseMcg,
          site: input.site ?? null,
          notes: input.notes?.trim() || null,
          loggedAt: at,
        });
        return { id };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ ctx, input }) => {
        await deleteDose(ctx.user.id, input.id);
        return { success: true } as const;
      }),

    setInterval: protectedProcedure
      .input(z.object({ compound: z.string().trim().min(1).max(80), days: z.number().int().min(1).max(60) }))
      .mutation(async ({ ctx, input }) => {
        await setDoseSchedule(ctx.user.id, compoundKey(input.compound).slice(0, 80), input.days);
        return { success: true } as const;
      }),
  }),

  fitness: router({
    profile: protectedProcedure.query(async ({ ctx }) => {
      const p = await getFitnessProfile(ctx.user.id);
      return {
        proteinTargetG: p?.proteinTargetG ?? 150,
        waterTargetMl: p?.waterTargetMl ?? 3785,
      };
    }),

    setProfile: protectedProcedure
      .input(z.object({
        proteinTargetG: z.number().int().min(20).max(500),
        waterTargetMl: z.number().int().min(500).max(10000),
      }))
      .mutation(async ({ ctx, input }) => {
        await upsertFitnessProfile(ctx.user.id, input);
        return { success: true };
      }),

    logWeight: protectedProcedure
      .input(z.object({ weightLb: z.number().min(50).max(800) }))
      .mutation(async ({ ctx, input }) => {
        const id = await createWeightLog(ctx.user.id, Math.round(input.weightLb * 10), Date.now());
        return { id };
      }),

    deleteWeight: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteWeightLog(ctx.user.id, input.id);
        return { success: true };
      }),

    logIntake: protectedProcedure
      .input(z.object({
        kind: z.enum(["protein", "water"]),
        amount: z.number().int().min(1).max(5000),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createIntakeLog(ctx.user.id, input.kind, input.amount, Date.now());
        return { id };
      }),

    deleteIntake: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteIntakeLog(ctx.user.id, input.id);
        return { success: true };
      }),

    logLift: protectedProcedure
      .input(z.object({
        exercise: z.string().trim().min(1).max(100),
        weightLb: z.number().int().min(0).max(2000),
        reps: z.number().int().min(1).max(100),
        sets: z.number().int().min(1).max(20).optional(),
        notes: z.string().max(500).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const id = await createLiftLog(ctx.user.id, {
          exercise: input.exercise,
          weightLb: input.weightLb,
          reps: input.reps,
          sets: input.sets ?? 1,
          notes: input.notes ?? null,
          loggedAt: Date.now(),
        });
        return { id };
      }),

    deleteLift: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteLiftLog(ctx.user.id, input.id);
        return { success: true };
      }),

    logWaist: protectedProcedure
      .input(z.object({ waistIn: z.number().min(15).max(80) }))
      .mutation(async ({ ctx, input }) => {
        const id = await createWaistLog(ctx.user.id, Math.round(input.waistIn * 10), Date.now());
        return { id };
      }),

    deleteWaist: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteWaistLog(ctx.user.id, input.id);
        return { success: true };
      }),

    waists: protectedProcedure.query(async ({ ctx }) => {
      const rows = await getWaistLogs(ctx.user.id, Date.now() - 120 * DAY_MS);
      return rows.map(w => ({ id: w.id, waistIn: w.waistIn10 / 10, loggedAt: w.loggedAt }));
    }),

    summary: protectedProcedure
      .input(z.object({
        days: z.number().int().min(1).max(120).default(28),
        tzOffsetMinutes: z.number().int().min(-840).max(840).default(0),
      }))
      .query(async ({ ctx, input }) => {
        const now = Date.now();
        const fromTs = now - (input.days + 1) * DAY_MS;
        const [mealsData, fitnessData, profile] = await Promise.all([
          getMealsInRange(ctx.user.id, fromTs, now),
          getFitnessDataInRange(ctx.user.id, fromTs, now),
          getFitnessProfile(ctx.user.id),
        ]);
        const summary = buildFitnessSummary({
          now,
          days: input.days,
          tzOffsetMinutes: input.tzOffsetMinutes,
          meals: mealsData.map(m => ({ foods: m.foods as MealFood[], loggedAt: m.loggedAt })),
          intake: fitnessData.intake,
          weights: fitnessData.weights,
          lifts: fitnessData.lifts,
        });
        return {
          ...summary,
          targets: {
            proteinTargetG: profile?.proteinTargetG ?? 150,
            waterTargetMl: profile?.waterTargetMl ?? 3785,
          },
          recentIntake: fitnessData.intake.slice(0, 10),
          recentWeights: fitnessData.weights.slice(0, 10).map(w => ({ id: w.id, weightLb: w.weightLb10 / 10, loggedAt: w.loggedAt })),
          recentLifts: fitnessData.lifts.slice(0, 15),
        };
      }),
  }),

  insights: router({
    correlations: protectedProcedure.query(async ({ ctx }) => {
      return getCorrelationsByUser(ctx.user.id);
    }),

    /** Triggers found by counting (no AI): see shared/triggers.ts. */
    triggers: protectedProcedure.query(async ({ ctx }) => {
      const { triggers, mealCount, symptomCount } = await loadTriggers(ctx.user.id);
      return { mealCount, symptomCount, triggers: triggers.map(t => ({ ...t, key: triggerKey(t) })) };
    }),

    /** AI write-up for one trigger, built from the counts and cached until they change. */
    explain: protectedProcedure
      .input(z.object({ key: z.string().min(1).max(255) }))
      .mutation(async ({ ctx, input }) => {
        const { triggers } = await loadTriggers(ctx.user.id);
        const stat = triggers.find(t => triggerKey(t) === input.key);
        if (!stat) throw new TRPCError({ code: "NOT_FOUND", message: "That pattern is no longer in your data" });
        try {
          return await getOrCreateExplanation(ctx.user.id, stat);
        } catch (err) {
          console.error("[insights.explain] failed:", err instanceof Error ? err.message : err);
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Could not write the explanation right now" });
        }
      }),

    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;

      const [allMeals, recentMeals, allSymptoms, found] = await Promise.all([
        getMealsByUser(ctx.user.id, 50),
        getMealsInRange(ctx.user.id, fortyEightHoursAgo, now),
        getSymptomsByUser(ctx.user.id, 50),
        loadTriggers(ctx.user.id),
      ]);
      const top = found.triggers.find(t => t.status === "trigger");

      // Calculate gut health score (simple heuristic)
      const recentSymptoms = allSymptoms.filter(s => s.loggedAt >= sevenDaysAgo);
      const avgSeverity = recentSymptoms.length > 0
        ? recentSymptoms.reduce((sum, s) => sum + s.severity, 0) / recentSymptoms.length
        : 0;
      const gutHealthScore = Math.max(20, Math.min(95, Math.round(85 - avgSeverity * 10 + (allMeals.length > 5 ? 5 : 0))));

      // Streak calculation
      const streakDays = Math.min(allMeals.length, 30);

      return {
        gutHealthScore,
        streakDays,
        totalMeals: allMeals.length,
        totalSymptoms: allSymptoms.length,
        recentMeals: recentMeals.slice(0, 5),
        recentSymptoms: allSymptoms.slice(0, 5),
        topCorrelation: top ? {
          trigger: top.names.join(" + "),
          symptom: top.symptom.replace(/_/g, " "),
          discoveredAt: top.lastHitAt,
          recommendation: `${ofMeals(top.hits, top.exposures)} with this were followed by ${top.symptom.replace(/_/g, " ")} (${pct(top.rate)}, vs ${pct(top.otherRate)} otherwise).`,
        } : null,

      };
    }),
  }),

  subscription: router({
    /** Get the current user's subscription status and scan usage. */
    status: protectedProcedure.query(async ({ ctx }) => {
      const [sub, todayScans, premium] = await Promise.all([
        getSubscription(ctx.user.id),
        getTodayScanCount(ctx.user.id),
        isPremium(ctx.user.id),
      ]);
      return {
        tier: sub?.tier ?? 'free',
        isPremium: premium,
        productId: sub?.productId ?? null,
        platform: sub?.platform ?? null,
        expiresAt: sub?.expiresAt ?? null,
        activatedAt: sub?.activatedAt ?? null,
        todayScans,
        dailyLimit: FREE_DAILY_SCAN_LIMIT,
        scansRemaining: premium ? null : Math.max(0, FREE_DAILY_SCAN_LIMIT - todayScans),
      };
    }),

    /**
     * Called from the client after a successful RevenueCat purchase.
     * The client passes the RC customer info; server verifies via RC REST API.
     */
    activate: protectedProcedure
      .input(z.object({
        rcCustomerId: z.string(),
        productId: z.string(),
        platform: z.enum(['ios', 'android', 'web']),
        expiresAt: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Verify with RevenueCat REST API if key is configured
        const rcApiKey = process.env.REVENUECAT_SECRET_KEY;
        if (rcApiKey) {
          try {
            const res = await fetch(
              `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(input.rcCustomerId)}`,
              { headers: { Authorization: `Bearer ${rcApiKey}`, 'Content-Type': 'application/json' } }
            );
            if (!res.ok) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not verify purchase with RevenueCat' });
            }
            const data = await res.json() as { subscriber?: { entitlements?: Record<string, { expires_date?: string }> } };
            const entitlement = data.subscriber?.entitlements?.['premium'];
            if (!entitlement) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: 'No active premium entitlement found' });
            }
            const expiresAt = entitlement.expires_date ? new Date(entitlement.expires_date).getTime() : null;
            await upsertSubscription({
              userId: ctx.user.id,
              rcCustomerId: input.rcCustomerId,
              tier: 'premium',
              productId: input.productId,
              platform: input.platform,
              expiresAt: expiresAt ?? undefined,
              activatedAt: Date.now(),
            });
          } catch (err) {
            if (err instanceof TRPCError) throw err;
            throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'RevenueCat verification failed' });
          }
        } else {
          if (process.env.NODE_ENV === 'production') {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: 'RevenueCat verification is not configured',
            });
          }
          // No RC key configured — trust client only outside production for local development.
          await upsertSubscription({
            userId: ctx.user.id,
            rcCustomerId: input.rcCustomerId,
            tier: 'premium',
            productId: input.productId,
            platform: input.platform,
            expiresAt: input.expiresAt,
            activatedAt: Date.now(),
          });
        }
        return { success: true, tier: 'premium' };
      }),

    /** Restore purchases — re-verify with RevenueCat and update local record. */
    restore: protectedProcedure
      .input(z.object({ rcCustomerId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const rcApiKey = process.env.REVENUECAT_SECRET_KEY;
        if (!rcApiKey) {
          return { restored: false, tier: 'free' };
        }
        const res = await fetch(
          `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(input.rcCustomerId)}`,
          { headers: { Authorization: `Bearer ${rcApiKey}`, 'Content-Type': 'application/json' } }
        );
        if (!res.ok) return { restored: false, tier: 'free' };
        const data = await res.json() as { subscriber?: { entitlements?: Record<string, { expires_date?: string }> } };
        const entitlement = data.subscriber?.entitlements?.['premium'];
        if (!entitlement) {
          await cancelSubscription(ctx.user.id);
          return { restored: false, tier: 'free' };
        }
        const expiresAt = entitlement.expires_date ? new Date(entitlement.expires_date).getTime() : null;
        await upsertSubscription({
          userId: ctx.user.id,
          rcCustomerId: input.rcCustomerId,
          tier: 'premium',
          expiresAt: expiresAt ?? undefined,
          activatedAt: Date.now(),
        });
        return { restored: true, tier: 'premium' };
      }),

    /** RevenueCat webhook — called by RC server on subscription events. */
    webhook: publicProcedure
      .input(z.object({
        event: z.object({
          type: z.string(),
          app_user_id: z.string(),
          product_id: z.string().optional(),
          expiration_at_ms: z.number().optional(),
          store: z.string().optional(),
        }),
      }))
      .mutation(async ({ input }) => {
        const { type, app_user_id, product_id, expiration_at_ms, store } = input.event;
        // Map store to platform
        const platform = store === 'APP_STORE' ? 'ios' : store === 'PLAY_STORE' ? 'android' : 'web';
        // Find user by RC customer ID
        const db = await import('./db');
        const sub = await db.getSubscription(0); // placeholder — in production, look up by rcCustomerId
        if (['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION'].includes(type)) {
          // Premium activated or renewed — we rely on activate() from client for now
          console.log(`[RC Webhook] ${type} for ${app_user_id}`);
        } else if (['CANCELLATION', 'EXPIRATION', 'BILLING_ISSUE'].includes(type)) {
          console.log(`[RC Webhook] ${type} — subscription lapsed for ${app_user_id}`);
        }
        return { received: true };
      }),
  }),

});

export type AppRouter = typeof appRouter;
