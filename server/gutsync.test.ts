import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  createMeal: vi.fn().mockResolvedValue(1),
  getMealsByUser: vi.fn().mockResolvedValue([]),
  getMealsInRange: vi.fn().mockResolvedValue([]),
  createSymptom: vi.fn().mockResolvedValue(1),
  getSymptomsByUser: vi.fn().mockResolvedValue([]),
  updateSymptomSeverity: vi.fn().mockResolvedValue(undefined),
  deleteSymptom: vi.fn().mockResolvedValue(undefined),
  upsertCorrelation: vi.fn(),
  getCorrelationsByUser: vi.fn().mockResolvedValue([]),
  // Subscription mocks (default: free tier, 0 scans used)
  getSubscription: vi.fn().mockResolvedValue(null),
  isPremium: vi.fn().mockResolvedValue(false),
  upsertSubscription: vi.fn().mockResolvedValue(undefined),
  cancelSubscription: vi.fn().mockResolvedValue(undefined),
  getTodayScanCount: vi.fn().mockResolvedValue(0),
  incrementScanCount: vi.fn().mockResolvedValue(1),
}));

// Mock the LLM module
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [{
      message: {
        content: JSON.stringify({
          foods: [
            { name: "Grilled Chicken", category: "protein", fodmap: "low", hiddenIngredients: [] },
            { name: "White Rice", category: "grain", fodmap: "low", hiddenIngredients: [] },
          ],
          mealType: "lunch",
          summary: "Grilled chicken with rice",
        }),
      },
    }],
  }),
}));

// Mock the storage module
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/meals/test.jpg", key: "meals/test.jpg" }),
  storageGet: vi.fn(),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-123",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("GutSync Server Procedures", () => {
  let db: typeof import("./db");

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    db = await import("./db");
  });

  // ─── Auth ───
  describe("auth.me", () => {
    it("returns user when authenticated", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).toBeDefined();
      expect(result?.openId).toBe("test-user-123");
      expect(result?.name).toBe("Test User");
    });

    it("returns null when not authenticated", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.auth.me();
      expect(result).toBeNull();
    });
  });

  // ─── Meals ───
  describe("meals.list", () => {
    it("returns meals for authenticated user", async () => {
      const mockMeals = [
        { id: 1, userId: 1, mealType: "lunch", foods: [], loggedAt: Date.now(), createdAt: new Date() },
      ];
      vi.mocked(db.getMealsByUser).mockResolvedValue(mockMeals as any);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.meals.list({ limit: 10 });

      expect(db.getMealsByUser).toHaveBeenCalledWith(1, 10);
      expect(result).toEqual(mockMeals);
    });

    it("defaults to limit 20 when not specified", async () => {
      vi.mocked(db.getMealsByUser).mockResolvedValue([]);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      await caller.meals.list();

      expect(db.getMealsByUser).toHaveBeenCalledWith(1, 20);
    });

    it("rejects unauthenticated users", async () => {
      const ctx = createUnauthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.meals.list()).rejects.toThrow();
    });
  });

  describe("meals.logManual", () => {
    it("creates a meal with manual input", async () => {
      vi.mocked(db.createMeal).mockResolvedValue(42);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.meals.logManual({
        mealType: "breakfast",
        foods: [
          { name: "Oatmeal", category: "grain", fodmap: "low", hiddenIngredients: [] },
          { name: "Blueberries", category: "fruit", fodmap: "low", hiddenIngredients: [] },
        ],
        notes: "Morning oatmeal bowl",
      });

      expect(result.id).toBe(42);
      expect(db.createMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          mealType: "breakfast",
          foods: expect.arrayContaining([
            expect.objectContaining({ name: "Oatmeal" }),
          ]),
          notes: "Morning oatmeal bowl",
        })
      );
    });
  });

  describe("meals.analyzePhoto", () => {
    it("uploads image, runs AI analysis, and saves meal", async () => {
      vi.mocked(db.createMeal).mockResolvedValue(7);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const fakeBase64 = Buffer.from("fake-image-data").toString("base64");

      const result = await caller.meals.analyzePhoto({
        imageBase64: fakeBase64,
        mimeType: "image/jpeg",
      });

      expect(result.mealType).toBe("lunch");
      expect(result.foods).toHaveLength(2);
      expect(result.foods[0].name).toBe("Grilled Chicken");
      expect(result.photoUrl).toBe("https://cdn.example.com/meals/test.jpg");
      expect(result.summary).toBe("Grilled chicken with rice");
      // analyzePhoto no longer saves meals — saving happens via logManual on user confirm
      expect(db.createMeal).not.toHaveBeenCalled();
    });
  });

  // ─── Symptoms ───
  describe("symptoms.list", () => {
    it("returns symptoms for authenticated user", async () => {
      const mockSymptoms = [
        { id: 1, userId: 1, type: "bloating", severity: 3, source: "manual", loggedAt: Date.now() },
      ];
      vi.mocked(db.getSymptomsByUser).mockResolvedValue(mockSymptoms as any);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.symptoms.list({ limit: 5 });

      expect(db.getSymptomsByUser).toHaveBeenCalledWith(1, 5);
      expect(result).toEqual(mockSymptoms);
    });
  });

  describe("symptoms.log", () => {
    it("logs a symptom with correct data", async () => {
      vi.mocked(db.createSymptom).mockResolvedValue(10);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.symptoms.log({
        type: "bloating",
        severity: 4,
        source: "manual",
        notes: "After lunch",
      });

      expect(result.id).toBe(10);
      expect(db.createSymptom).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          type: "bloating",
          severity: 4,
          source: "manual",
          notes: "After lunch",
        })
      );
    });

    it("defaults source to manual when not specified", async () => {
      vi.mocked(db.createSymptom).mockResolvedValue(11);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      await caller.symptoms.log({ type: "gas", severity: 2 });

      expect(db.createSymptom).toHaveBeenCalledWith(
        expect.objectContaining({ source: "manual" })
      );
    });

    it("validates severity range", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(caller.symptoms.log({ type: "bloating", severity: 0 })).rejects.toThrow();
      await expect(caller.symptoms.log({ type: "bloating", severity: 6 })).rejects.toThrow();
    });
  });

  // ─── Insights ───
  describe("insights.correlations", () => {
    it("returns correlations for authenticated user", async () => {
      const mockCorrelations = [
        { id: 1, trigger: "Garlic", symptom: "Bloating", confidence: 85, occurrences: 4 },
      ];
      vi.mocked(db.getCorrelationsByUser).mockResolvedValue(mockCorrelations as any);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.insights.correlations();

      expect(db.getCorrelationsByUser).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockCorrelations);
    });
  });

  describe("insights.dashboard", () => {
    it("returns dashboard data with computed gut health score", async () => {
      vi.mocked(db.getMealsByUser).mockResolvedValue([
        { id: 1, userId: 1, mealType: "lunch", foods: [], loggedAt: Date.now(), createdAt: new Date() },
      ] as any);
      vi.mocked(db.getMealsInRange).mockResolvedValue([]);
      vi.mocked(db.getSymptomsByUser).mockResolvedValue([]);
      vi.mocked(db.getCorrelationsByUser).mockResolvedValue([]);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.insights.dashboard();

      expect(result.gutHealthScore).toBeGreaterThanOrEqual(20);
      expect(result.gutHealthScore).toBeLessThanOrEqual(95);
      expect(result.totalMeals).toBe(1);
      expect(result.totalSymptoms).toBe(0);
      expect(result.topCorrelation).toBeNull();
    });

    it("lowers gut health score when symptoms are severe", async () => {
      const now = Date.now();
      vi.mocked(db.getMealsByUser).mockResolvedValue([]);
      vi.mocked(db.getMealsInRange).mockResolvedValue([]);
      vi.mocked(db.getSymptomsByUser).mockResolvedValue([
        { id: 1, userId: 1, type: "bloating", severity: 5, source: "manual", loggedAt: now, createdAt: new Date(), notes: null },
        { id: 2, userId: 1, type: "abdominal_pain", severity: 5, source: "manual", loggedAt: now, createdAt: new Date(), notes: null },
      ] as any);
      vi.mocked(db.getCorrelationsByUser).mockResolvedValue([]);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.insights.dashboard();

      expect(result.gutHealthScore).toBeLessThan(50);
    });
  });

  // ─── Subscription ───
  describe("subscription.status", () => {
    it("returns free tier status with scan counts", async () => {
      vi.mocked(db.getSubscription).mockResolvedValue(null);
      vi.mocked(db.isPremium).mockResolvedValue(false);
      vi.mocked(db.getTodayScanCount).mockResolvedValue(1);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.subscription.status();

      expect(result.tier).toBe("free");
      expect(result.isPremium).toBe(false);
      expect(result.todayScans).toBe(1);
      expect(result.dailyLimit).toBe(10);
      expect(result.scansRemaining).toBe(9);
    });

    it("returns premium status with null scansRemaining", async () => {
      vi.mocked(db.getSubscription).mockResolvedValue({
        id: 1, userId: 1, tier: "premium", rcCustomerId: "rc_123",
        productId: "gutsync_premium_monthly", platform: "ios",
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        activatedAt: Date.now(), createdAt: new Date(), updatedAt: new Date(),
      } as any);
      vi.mocked(db.isPremium).mockResolvedValue(true);
      vi.mocked(db.getTodayScanCount).mockResolvedValue(10);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.subscription.status();

      expect(result.tier).toBe("premium");
      expect(result.isPremium).toBe(true);
      expect(result.scansRemaining).toBeNull(); // unlimited
    });
  });

  describe("subscription.activate", () => {
    it("rejects activation without a valid RevenueCat customer ID when RC key is present", async () => {
      // The activate procedure calls RevenueCat API to verify the entitlement.
      // Without a real RC key in test env, it throws BAD_REQUEST (no entitlement found).
      // This test validates that the gate is enforced — not bypassed.
      vi.stubEnv("REVENUECAT_SECRET_KEY", "test_revenuecat_secret");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ subscriber: { entitlements: {} } }),
      }));

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);

      await expect(
        caller.subscription.activate({
          rcCustomerId: "fake_customer_id",
          productId: "gutsync_premium_monthly",
          platform: "web",
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        })
      ).rejects.toThrow(); // Throws because RC API returns no entitlement for fake ID
    });
  });

  describe("meals.analyzePhoto — free tier limit enforcement", () => {
    it("blocks scan when free limit is reached", async () => {
      vi.mocked(db.isPremium).mockResolvedValue(false);
      vi.mocked(db.getTodayScanCount).mockResolvedValue(3); // at limit

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const fakeBase64 = Buffer.from("fake-image-data").toString("base64");

      await expect(
        caller.meals.analyzePhoto({ imageBase64: fakeBase64, mimeType: "image/jpeg" })
      ).rejects.toThrow(/FREE_LIMIT_REACHED/);
    });

    it("allows scan for premium users regardless of count", async () => {
      vi.mocked(db.isPremium).mockResolvedValue(true);
      vi.mocked(db.getTodayScanCount).mockResolvedValue(99); // way over limit
      vi.mocked(db.createMeal).mockResolvedValue(8);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const fakeBase64 = Buffer.from("fake-image-data").toString("base64");

      const result = await caller.meals.analyzePhoto({ imageBase64: fakeBase64, mimeType: "image/jpeg" });
      expect(result.mealType).toBe("lunch");
      // Premium users should NOT have scan count incremented
      expect(db.incrementScanCount).not.toHaveBeenCalled();
    });

    it("increments scan count for free-tier users after successful scan", async () => {
      vi.mocked(db.isPremium).mockResolvedValue(false);
      vi.mocked(db.getTodayScanCount).mockResolvedValue(1); // 1 of 10 used
      vi.mocked(db.createMeal).mockResolvedValue(9);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const fakeBase64 = Buffer.from("fake-image-data").toString("base64");

      await caller.meals.analyzePhoto({ imageBase64: fakeBase64, mimeType: "image/jpeg" });
      expect(db.incrementScanCount).toHaveBeenCalledWith(1);
    });
  });
});

describe("symptoms.update / delete", () => {
  it("scopes update and delete to the signed-in user", async () => {
    const db = await import("./db");
    const caller = appRouter.createCaller(createAuthContext());
    await caller.symptoms.update({ id: 7, severity: 4 });
    expect(db.updateSymptomSeverity).toHaveBeenCalledWith(1, 7, 4);
    await caller.symptoms.delete({ id: 7 });
    expect(db.deleteSymptom).toHaveBeenCalledWith(1, 7);
    await expect(caller.symptoms.update({ id: 7, severity: 6 })).rejects.toThrow();
  });
});
