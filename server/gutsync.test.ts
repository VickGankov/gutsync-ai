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
  upsertCorrelation: vi.fn(),
  getCorrelationsByUser: vi.fn().mockResolvedValue([]),
  createWearableEntry: vi.fn().mockResolvedValue(1),
  getWearableDataByUser: vi.fn().mockResolvedValue([]),
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

describe("GutSync AI Server Procedures", () => {
  let db: typeof import("./db");

  beforeEach(async () => {
    vi.clearAllMocks();
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
      expect(db.createMeal).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          mealType: "lunch",
          photoUrl: "https://cdn.example.com/meals/test.jpg",
        })
      );
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
      vi.mocked(db.getWearableDataByUser).mockResolvedValue([]);

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
      vi.mocked(db.getWearableDataByUser).mockResolvedValue([]);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.insights.dashboard();

      expect(result.gutHealthScore).toBeLessThan(50);
    });
  });

  // ─── Wearable ───
  describe("wearable.log", () => {
    it("logs wearable data", async () => {
      vi.mocked(db.createWearableEntry).mockResolvedValue(5);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.wearable.log({
        hrv: 55,
        heartRate: 68,
        sleepQuality: 82,
        stressLevel: 25,
      });

      expect(result.id).toBe(5);
      expect(db.createWearableEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          hrv: 55,
          heartRate: 68,
          sleepQuality: 82,
          stressLevel: 25,
        })
      );
    });

    it("validates HRV range", async () => {
      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      await expect(caller.wearable.log({
        hrv: -1,
        heartRate: 68,
        sleepQuality: 82,
        stressLevel: 25,
      })).rejects.toThrow();
    });
  });

  describe("wearable.recent", () => {
    it("returns recent wearable data", async () => {
      const mockData = [
        { id: 1, userId: 1, hrv: 55, heartRate: 68, sleepQuality: 82, stressLevel: 25, recordedAt: Date.now() },
      ];
      vi.mocked(db.getWearableDataByUser).mockResolvedValue(mockData as any);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.wearable.recent();

      expect(db.getWearableDataByUser).toHaveBeenCalledWith(1, 7);
      expect(result).toEqual(mockData);
    });
  });
});
