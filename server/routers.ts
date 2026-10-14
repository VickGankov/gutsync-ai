import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { z } from "zod";
import { nanoid } from "nanoid";
import {
  createMeal,
  updateMeal,
  deleteMeal,
  getMealsByUser,
  getMealsInRange,
  createSymptom,
  getSymptomsByUser,
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
} from "./db";
import {
  REINTRO_GROUPS,
  assessChallenge,
  currentChallengeDay,
  type ReintroCheckIn,
} from "@shared/reintro";
import { TRPCError } from "@trpc/server";
import type { MealFood } from "../drizzle/schema";

// Free tier: 3 AI scans per day
const FREE_DAILY_SCAN_LIMIT = 3;

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
- foods: array of food items, each with { name, category, fodmap, hiddenIngredients }
  - category: one of "protein", "carb", "fat", "vegetable", "fruit", "dairy", "grain", "other"
  - fodmap: one of "low", "moderate", "high" (based on Monash University FODMAP guidelines)
  - hiddenIngredients: array of likely hidden ingredients (e.g. garlic powder, onion, HFCS, wheat)
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
          { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
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
                },
                required: ["name", "category", "fodmap", "hiddenIngredients"],
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

// ─── Correlation Analysis ───

async function analyzeCorrelations(
  mealsData: Array<{ foods: MealFood[]; loggedAt: number }>,
  symptomsData: Array<{ type: string; severity: number; loggedAt: number }>
): Promise<Array<{
  trigger: string;
  symptom: string;
  confidence: number;
  occurrences: number;
  description: string;
  recommendation: string;
}>> {
  if (mealsData.length < 3 || symptomsData.length < 2) {
    return [];
  }

  const result = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are GutSync's correlation engine. Analyze the food and symptom data to find patterns.
Look for:
- Foods that consistently appear 2-48 hours before symptoms
- Combinations of foods that trigger symptoms together
- Hidden ingredients (garlic, onion, lactose) that appear across multiple meals before symptoms
- Time-of-day patterns

Return a JSON array of discovered correlations. Be conservative — only report patterns with reasonable confidence.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          meals: mealsData.map(m => ({
            foods: m.foods.map(f => f.name),
            allIngredients: m.foods.flatMap(f => [f.name, ...f.hiddenIngredients]),
            fodmapLevels: m.foods.map(f => ({ name: f.name, fodmap: f.fodmap })),
            timestamp: m.loggedAt,
          })),
          symptoms: symptomsData,
        }),
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "correlation_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            correlations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  trigger: { type: "string" },
                  symptom: { type: "string" },
                  confidence: { type: "integer", description: "0-100" },
                  occurrences: { type: "integer" },
                  description: { type: "string" },
                  recommendation: { type: "string" },
                },
                required: ["trigger", "symptom", "confidence", "occurrences", "description", "recommendation"],
                additionalProperties: false,
              },
            },
          },
          required: ["correlations"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = result.choices[0]?.message?.content;
  if (!content || typeof content !== "string") return [];
  try {
    const parsed = JSON.parse(content);
    return parsed.correlations || [];
  } catch {
    console.error("[analyzeCorrelations] Failed to parse LLM response:", content.slice(0, 200));
    return [];
  }
}

// ─── Router ───

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
      .input(z.object({ imageBase64: z.string(), mimeType: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        // ── Enforce free-tier scan limit ──────────────────────────────
        const premium = await isPremium(ctx.user.id);
        if (!premium) {
          const todayCount = await getTodayScanCount(ctx.user.id);
          if (todayCount >= FREE_DAILY_SCAN_LIMIT) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: `FREE_LIMIT_REACHED:${todayCount}`,
            });
          }
        }

        // Upload image to S3
        const fileKey = `meals/${ctx.user.id}/${nanoid()}.jpg`;
        const imageBuffer = Buffer.from(input.imageBase64, "base64");
        const { url: photoUrl } = await storagePut(fileKey, imageBuffer, input.mimeType || "image/jpeg");

        // Run AI analysis
        // Send the image inline so the AI provider never has to fetch it from storage.
        const analysis = await analyzeFood(`data:${input.mimeType || "image/jpeg"};base64,${input.imageBase64}`);

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
        })),
        notes: z.string().optional(),
        photoUrl: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const mealId = await createMeal({
          userId: ctx.user.id,
          mealType: input.mealType,
          foods: input.foods,
          notes: input.notes ?? null,
          photoUrl: input.photoUrl,
          loggedAt: Date.now(),
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
        type: z.enum(["bloating", "abdominal_pain", "gas", "nausea", "fatigue", "headache", "diarrhea", "constipation", "energy_boost", "better_digestion", "improved_mood", "better_sleep", "clearer_skin", "reduced_brain_fog"]),
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

  insights: router({
    correlations: protectedProcedure.query(async ({ ctx }) => {
      return getCorrelationsByUser(ctx.user.id);
    }),

    runAnalysis: protectedProcedure.mutation(async ({ ctx }) => {
      // Get last 7 days of data
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

      const [mealsData, symptomsData] = await Promise.all([
        getMealsInRange(ctx.user.id, sevenDaysAgo, now),
        getSymptomsByUser(ctx.user.id, 50),
      ]);

      // Filter symptoms to last 7 days
      const recentSymptoms = symptomsData.filter(s => s.loggedAt >= sevenDaysAgo);

      // Run AI correlation analysis
      const newCorrelations = await analyzeCorrelations(
        mealsData.map(m => ({ foods: m.foods as MealFood[], loggedAt: m.loggedAt })),
        recentSymptoms.map(s => ({ type: s.type, severity: s.severity, loggedAt: s.loggedAt }))
      );

      // Save correlations
      for (const corr of newCorrelations) {
        await upsertCorrelation({
          userId: ctx.user.id,
          trigger: corr.trigger,
          symptom: corr.symptom,
          confidence: corr.confidence,
          occurrences: corr.occurrences,
          description: corr.description,
          recommendation: corr.recommendation,
          discoveredAt: Date.now(),
        });
      }

      return { correlationsFound: newCorrelations.length, correlations: newCorrelations };
    }),

    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const fortyEightHoursAgo = now - 48 * 60 * 60 * 1000;

      const [allMeals, recentMeals, allSymptoms, correlationsData] = await Promise.all([
        getMealsByUser(ctx.user.id, 50),
        getMealsInRange(ctx.user.id, fortyEightHoursAgo, now),
        getSymptomsByUser(ctx.user.id, 50),
        getCorrelationsByUser(ctx.user.id),
      ]);

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
        topCorrelation: correlationsData[0] ?? null,

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
