import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ENV } from "./_core/env";
import bcrypt from "bcrypt";
import { LEGAL_VERSION } from "@shared/legal";
import { scanLimitFor, type Plan } from "@shared/plans";
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
  getDosesByUser: vi.fn().mockResolvedValue([]),
  getDoseSchedules: vi.fn().mockResolvedValue([]),
  updateSymptomSeverity: vi.fn().mockResolvedValue(undefined),
  deleteSymptom: vi.fn().mockResolvedValue(undefined),
  getFoodFactsByKeys: vi.fn().mockResolvedValue([]),
  saveFoodFacts: vi.fn().mockResolvedValue(undefined),
  saveFoodFiber: vi.fn().mockResolvedValue(undefined),
  getSupplements: vi.fn().mockResolvedValue([]),
  addSupplement: vi.fn().mockResolvedValue(5),
  archiveSupplement: vi.fn().mockResolvedValue(undefined),
  getSupplementLogs: vi.fn().mockResolvedValue([]),
  setSupplementTaken: vi.fn().mockResolvedValue(undefined),
  setSupplementDose: vi.fn().mockResolvedValue(undefined),
  setUserAvatar: vi.fn().mockResolvedValue(undefined),
  renameLabMarker: vi.fn().mockResolvedValue(undefined),
  setUserSensitivities: vi.fn().mockResolvedValue(undefined),
  getNotificationPrefs: vi.fn().mockResolvedValue(null),
  saveNotificationPrefs: vi.fn().mockResolvedValue(undefined),
  saveSubscription: vi.fn().mockResolvedValue(undefined),
  getSubscriptions: vi.fn().mockResolvedValue([]),
  deleteSubscription: vi.fn().mockResolvedValue(undefined),
  exportUserData: vi.fn().mockResolvedValue({ exportedAt: "2026-10-17T00:00:00.000Z", account: { email: "test@example.com" }, meals: [] }),
  getLabResults: vi.fn().mockResolvedValue([{ marker: "LDL cholesterol" }, { marker: "Ferritin" }]),
  addLabResults: vi.fn().mockResolvedValue(1),
  createWaistLog: vi.fn().mockResolvedValue(3),
  getWaistLogs: vi.fn().mockResolvedValue([]),
  deleteWaistLog: vi.fn().mockResolvedValue(undefined),
  upsertCorrelation: vi.fn(),
  getCorrelationsByUser: vi.fn().mockResolvedValue([]),
  // Subscription mocks (default: free tier, 0 scans used)
  getSubscription: vi.fn().mockResolvedValue(null),
  isPremium: vi.fn().mockResolvedValue(false),
  getEntitlement: vi.fn().mockResolvedValue({ plan: "free", unlimited: false, dailyLimit: 10, founderAt: null }),
  claimFounder: vi.fn().mockResolvedValue("ok"),
  recordTermsAcceptance: vi.fn().mockResolvedValue(undefined),
  setBirthDate: vi.fn().mockResolvedValue(undefined),
  deleteUserAccount: vi.fn().mockResolvedValue(["meals/1/a.jpg", "avatars/1/b.jpg"]),
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
vi.mock("./storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./storage")>()),
  storagePut: vi.fn().mockResolvedValue({ url: "https://cdn.example.com/meals/test.jpg", key: "meals/test.jpg" }),
  storageGet: vi.fn(),
  storageDelete: vi.fn().mockResolvedValue(undefined),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

const ent = (plan: Plan, unlimited = false) => ({ plan, unlimited, dailyLimit: unlimited ? null : scanLimitFor(plan), founderAt: plan === "founder" ? 1 : null });

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

describe("Triggerplate Server Procedures", () => {
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
      expect(result).not.toHaveProperty("openId");
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

  describe("meals.logManual time", () => {
    const meal = { mealType: "lunch" as const, foods: [{ name: "Rice", category: "grain" as const, fodmap: "low" as const, hiddenIngredients: [] }] };

    it("saves a past meal at the time given", async () => {
      vi.mocked(db.createMeal).mockResolvedValue(1);
      const caller = appRouter.createCaller(createAuthContext());
      const at = Date.now() - 5 * 3_600_000;
      await caller.meals.logManual({ ...meal, loggedAt: at });
      expect(db.createMeal).toHaveBeenCalledWith(expect.objectContaining({ loggedAt: at }));
    });

    it("rejects a time in the future or more than 30 days back", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await expect(caller.meals.logManual({ ...meal, loggedAt: Date.now() + 3_600_000 })).rejects.toThrow(/last 30 days/);
      await expect(caller.meals.logManual({ ...meal, loggedAt: Date.now() - 31 * 86_400_000 })).rejects.toThrow(/last 30 days/);
      expect(db.createMeal).not.toHaveBeenCalled();
    });

    it("keeps fiber estimates on saved foods", async () => {
      vi.mocked(db.createMeal).mockResolvedValue(1);
      const caller = appRouter.createCaller(createAuthContext());
      await caller.meals.logManual({ ...meal, foods: [{ ...meal.foods[0], fiberGrams: 3.5 }] });
      expect(db.createMeal).toHaveBeenCalledWith(expect.objectContaining({ foods: [expect.objectContaining({ fiberGrams: 3.5 })] }));
    });
  });

  describe("meals.analyzeText", () => {
    it("rejects an empty description", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await expect(caller.meals.analyzeText({ text: " " })).rejects.toThrow();
    });

    it("requires sign-in", async () => {
      const caller = appRouter.createCaller(createUnauthContext());
      await expect(caller.meals.analyzeText({ text: "2 eggs and toast" })).rejects.toThrow();
    });

    it("counts a scan for free users and returns no photo", async () => {
      const { invokeLLM } = await import("./_core/llm");
      vi.mocked(invokeLLM)
        .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
          foods: [{ name: "egg", estimatedGrams: 100, packaged: false, labelIngredients: [], likelyTriggers: [], drinkMl: 0, labelProteinG: 0 }],
          mealType: "breakfast", summary: "Eggs",
        }) } }] } as any)
        .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
          foods: [{ key: "egg", category: "protein", fodmap: "low", hiddenIngredients: [], proteinPer100g: 13, fiberPer100g: 0 }],
        }) } }] } as any);
      const caller = appRouter.createCaller(createAuthContext());
      const r = await caller.meals.analyzeText({ text: "2 eggs" });
      expect(r.photoUrl).toBeNull();
      expect(r.mealType).toBe("breakfast");
      expect(r.foods[0].name).toBe("Egg");
      expect(db.incrementScanCount).toHaveBeenCalled();
    });
  });

  describe("reminders", () => {
    const caller = () => appRouter.createCaller(createAuthContext());
    it("returns defaults with everything off for a new user", async () => {
      const r = await caller().reminders.get();
      expect(r.prefs).toEqual({ mealReminders: false, mealTimes: ["08:00", "12:30", "18:30"], symptomCheckins: false, timeZone: "UTC" });
      expect(r.devices).toBe(0);
    });
    it("saves cleaned times and rejects bad input", async () => {
      await caller().reminders.save({ mealReminders: true, mealTimes: ["18:30", "08:00", "08:00"], symptomCheckins: false, timeZone: "America/Los_Angeles" });
      expect(db.saveNotificationPrefs).toHaveBeenLastCalledWith(1, { mealReminders: true, mealTimes: ["08:00", "18:30"], symptomCheckins: false, timeZone: "America/Los_Angeles" });
      await expect(caller().reminders.save({ mealReminders: true, mealTimes: ["8am"], symptomCheckins: false, timeZone: "UTC" })).rejects.toThrow(/times/i);
      await expect(caller().reminders.save({ mealReminders: true, mealTimes: [], symptomCheckins: false, timeZone: "UTC" })).rejects.toThrow(/at least one/i);
      await expect(caller().reminders.save({ mealReminders: false, mealTimes: [], symptomCheckins: false, timeZone: "Mars/Base" })).rejects.toThrow(/time zone/i);
    });
    it("only accepts https push endpoints and requires login", async () => {
      await caller().reminders.subscribe({ endpoint: "https://fcm.googleapis.com/x", p256dh: "k", auth: "a" });
      expect(db.saveSubscription).toHaveBeenLastCalledWith(1, { endpoint: "https://fcm.googleapis.com/x", p256dh: "k", auth: "a" });
      await expect(caller().reminders.subscribe({ endpoint: "http://insecure.example/x", p256dh: "k", auth: "a" })).rejects.toThrow();
      await expect(appRouter.createCaller(createUnauthContext()).reminders.get()).rejects.toThrow();
    });
  });

  describe("dietary profile", () => {
    it("saves only known sensitivities, once each", async () => {
      const r = await appRouter.createCaller(createAuthContext()).profile.setSensitivities({ keys: ["gluten", "nope", "lactose", "gluten"] });
      expect(r.keys).toEqual(["lactose", "gluten"]);
      expect(db.setUserSensitivities).toHaveBeenLastCalledWith(1, ["lactose", "gluten"]);
      await expect(appRouter.createCaller(createUnauthContext()).profile.setSensitivities({ keys: [] })).rejects.toThrow();
    });
  });

  describe("export my data", () => {
    it("returns the signed-in user's export and requires login", async () => {
      const out = await appRouter.createCaller(createAuthContext()).profile.exportData();
      expect(db.exportUserData).toHaveBeenLastCalledWith(1);
      expect(out.account?.email).toBe("test@example.com");
      expect(JSON.stringify(out)).not.toContain("password");
      await expect(appRouter.createCaller(createUnauthContext()).profile.exportData()).rejects.toThrow();
    });
  });

  describe("lab marker merge", () => {
    it("renames a marker, folding known names into canonical ones", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await caller.labs.renameMarker({ from: "ldlc", to: "LDL" });
      expect(db.renameLabMarker).toHaveBeenLastCalledWith(1, "ldlc", "LDL cholesterol");
    });
    it("folds a newly added result into a marker the user already has", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await caller.labs.add({ marker: "ferritin ", value: 50, unit: "ng/mL", drawnOn: "2026-01-02" });
      expect((db.addLabResults as any).mock.calls.at(-1)[1][0].marker).toBe("Ferritin");
    });
  });

  describe("profile photo and auth.me", () => {
    const jpegB64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]).toString("base64");
    const ctxWithSecrets = () => {
      const ctx = createAuthContext();
      ctx.user = { ...ctx.user!, password: "$2b$10$secret-hash", avatarUrl: "/api/media/avatars/1/old.jpg" } as any;
      return ctx;
    };

    it("auth.me never includes the password hash or other internal fields", async () => {
      const me = await appRouter.createCaller(ctxWithSecrets()).auth.me();
      expect(me).toEqual({ id: 1, email: "test@example.com", name: "Test User", role: "user", avatarUrl: "/api/media/avatars/1/old.jpg", sensitivities: [], termsAccepted: false, hasPassword: true, birthDate: null });
      expect(JSON.stringify(me)).not.toContain("secret-hash");
      expect(await appRouter.createCaller(createUnauthContext()).auth.me()).toBeNull();
    });

    it("stores a JPEG under the user's own folder, saves the url and deletes the old file", async () => {
      const storage = await import("./storage");
      vi.mocked(storage.storagePut).mockResolvedValueOnce({ url: "/api/media/avatars/1/new.jpg", key: "avatars/1/new.jpg" });
      const r = await appRouter.createCaller(ctxWithSecrets()).profile.setAvatar({ imageBase64: jpegB64 });
      expect(r.avatarUrl).toBe("/api/media/avatars/1/new.jpg");
      expect(vi.mocked(storage.storagePut).mock.calls.at(-1)![0]).toMatch(/^avatars\/1\/[A-Za-z0-9_-]+\.jpg$/);
      expect(db.setUserAvatar).toHaveBeenCalledWith(1, "/api/media/avatars/1/new.jpg");
      expect(storage.storageDelete).toHaveBeenCalledWith("avatars/1/old.jpg");
    });

    it("rejects anything that isn't a JPEG or is too big", async () => {
      const caller = appRouter.createCaller(ctxWithSecrets());
      await expect(caller.profile.setAvatar({ imageBase64: Buffer.from("<html>not an image</html>").toString("base64") })).rejects.toThrow(/couldn't be used/);
      const big = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(260_000)]).toString("base64");
      await expect(caller.profile.setAvatar({ imageBase64: big })).rejects.toThrow();
    });

    it("hides storage errors behind a friendly message", async () => {
      const storage = await import("./storage");
      vi.mocked(storage.storagePut).mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND bucket.internal"));
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      await expect(appRouter.createCaller(ctxWithSecrets()).profile.setAvatar({ imageBase64: jpegB64 })).rejects.toThrow(/Try again in a moment/);
      spy.mockRestore();
    });

    it("removes the photo and its file", async () => {
      const storage = await import("./storage");
      await appRouter.createCaller(ctxWithSecrets()).profile.removeAvatar();
      expect(db.setUserAvatar).toHaveBeenLastCalledWith(1, null);
      expect(storage.storageDelete).toHaveBeenLastCalledWith("avatars/1/old.jpg");
    });

    it("needs a login", async () => {
      await expect(appRouter.createCaller(createUnauthContext()).profile.removeAvatar()).rejects.toThrow();
    });
  });

  describe("supplement checklist", () => {
    it("lists items with what was taken on the given dates", async () => {
      vi.mocked(db.getSupplements).mockResolvedValue([{ id: 1, userId: 1, name: "Magnesium", dose: "400 mg", archived: false, createdAt: new Date() }] as any);
      vi.mocked(db.getSupplementLogs).mockResolvedValue([{ id: 1, userId: 1, supplementId: 1, dateKey: "2026-10-15", loggedAt: 1 }] as any);
      const caller = appRouter.createCaller(createAuthContext());
      const r = await caller.supplement.list({ dateKeys: ["2026-10-15"] });
      expect(r.items).toEqual([{ id: 1, name: "Magnesium", dose: "400 mg" }]);
      expect(r.taken).toEqual([{ supplementId: 1, dateKey: "2026-10-15" }]);
    });

    it("refuses duplicates and bad dates", async () => {
      vi.mocked(db.getSupplements).mockResolvedValue([{ id: 1, userId: 1, name: "Magnesium", archived: false, createdAt: new Date() }] as any);
      const caller = appRouter.createCaller(createAuthContext());
      await expect(caller.supplement.add({ name: "magnesium" })).rejects.toThrow(/already/);
      await expect(caller.supplement.toggle({ id: 1, dateKey: "tomorrow", taken: true })).rejects.toThrow();
    });

    it("sets and clears an optional dose, passing the day so a ticked day follows", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await caller.supplement.setDose({ id: 1, dose: " 2000 IU ", dateKey: "2026-10-15" });
      expect(db.setSupplementDose).toHaveBeenCalledWith(1, 1, "2000 IU", "2026-10-15");
      await caller.supplement.setDose({ id: 1, dose: "" });
      expect(db.setSupplementDose).toHaveBeenLastCalledWith(1, 1, null, undefined);
    });

    it("checks an item off for a day", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await caller.supplement.toggle({ id: 1, dateKey: "2026-10-15", taken: true });
      expect(db.setSupplementTaken).toHaveBeenCalledWith(1, 1, "2026-10-15", true);
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
      vi.mocked(db.getEntitlement).mockResolvedValue(ent("free"));
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

    it("returns premium status with the 50 a day limit", async () => {
      vi.mocked(db.getSubscription).mockResolvedValue({
        id: 1, userId: 1, tier: "premium", rcCustomerId: "rc_123",
        productId: "gutsync_premium_monthly", platform: "ios",
        expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        activatedAt: Date.now(), createdAt: new Date(), updatedAt: new Date(),
      } as any);
      vi.mocked(db.getEntitlement).mockResolvedValue(ent("premium"));
      vi.mocked(db.getTodayScanCount).mockResolvedValue(10);

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const result = await caller.subscription.status();

      expect(result.tier).toBe("premium");
      expect(result.isPremium).toBe(true);
      expect(result.dailyLimit).toBe(50);
      expect(result.scansRemaining).toBe(40);
    });

    it("returns founder status with the 20 a day limit", async () => {
      vi.mocked(db.getSubscription).mockResolvedValue(null);
      vi.mocked(db.getEntitlement).mockResolvedValue(ent("founder"));
      vi.mocked(db.getTodayScanCount).mockResolvedValue(5);
      const result = await appRouter.createCaller(createAuthContext()).subscription.status();
      expect(result.plan).toBe("founder");
      expect(result.isFounder).toBe(true);
      expect(result.isPremium).toBe(false);
      expect(result.scansRemaining).toBe(15);
    });
  });

  describe("subscription.redeemFounder", () => {
    const withCode = (code: string, limit = 30) => { ENV.founderCode = code; ENV.founderLimit = limit; };
    afterEach(() => { ENV.founderCode = ""; ENV.founderLimit = 30; });

    it("rejects a wrong code and an unset code", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      withCode("early-bird");
      await expect(caller.subscription.redeemFounder({ code: "nope" })).rejects.toThrow(/valid/);
      withCode("");
      await expect(caller.subscription.redeemFounder({ code: "anything" })).rejects.toThrow(/valid/);
      expect(db.claimFounder).not.toHaveBeenCalledWith(1, expect.anything());
    });

    it("grants founder on the right code, ignoring case", async () => {
      withCode("Early-Bird", 30);
      vi.mocked(db.claimFounder).mockResolvedValue("ok");
      const r = await appRouter.createCaller(createAuthContext()).subscription.redeemFounder({ code: " early-bird " });
      expect(r).toEqual({ founder: true, alreadyFounder: false });
      expect(db.claimFounder).toHaveBeenCalledWith(1, 30);
    });

    it("says so when the founding spots are gone", async () => {
      withCode("early-bird");
      vi.mocked(db.claimFounder).mockResolvedValue("full");
      await expect(appRouter.createCaller(createAuthContext()).subscription.redeemFounder({ code: "early-bird" })).rejects.toThrow(/taken/);
    });
  });

  describe("plan limits and the paywall", () => {
    afterEach(() => { ENV.paywallEnabled = false; });

    it("stops a founder at 20 with a plain message, not the upgrade prompt", async () => {
      vi.mocked(db.getEntitlement).mockResolvedValue(ent("founder"));
      vi.mocked(db.getTodayScanCount).mockResolvedValue(20);
      const b64 = Buffer.from("x").toString("base64");
      const p = appRouter.createCaller(createAuthContext()).meals.analyzePhoto({ imageBase64: b64, mimeType: "image/jpeg" });
      await expect(p).rejects.toThrow(/20 scans/);
    });

    it("locks labs for free users only when the paywall is on", async () => {
      vi.mocked(db.getEntitlement).mockResolvedValue(ent("free"));
      const row = { rows: [{ marker: "LDL", value: 100, unit: "mg/dL", drawnOn: "2026-10-01" }] } as any;
      ENV.paywallEnabled = true;
      await expect(appRouter.createCaller(createAuthContext()).labs.addMany(row)).rejects.toThrow(/PREMIUM_REQUIRED:labs/);
      vi.mocked(db.getEntitlement).mockResolvedValue(ent("founder"));
      await expect(appRouter.createCaller(createAuthContext()).labs.addMany(row)).resolves.toBeDefined();
    });

    it("locks the protocol for free users when the paywall is on", async () => {
      vi.mocked(db.getEntitlement).mockResolvedValue(ent("free"));
      ENV.paywallEnabled = true;
      await expect(appRouter.createCaller(createAuthContext()).reintro.start({ foodGroup: "lactose" as any, testFood: "milk", doses: ["a", "b", "c"] })).rejects.toThrow(/PREMIUM_REQUIRED:protocol/);
    });
  });

  describe("terms acceptance and account deletion", () => {
    const withPassword = async () => {
      const ctx = createAuthContext();
      ctx.user = { ...ctx.user!, password: await bcrypt.hash("right-password", 4) } as any;
      return ctx;
    };

    it("auth.me reports whether the current terms were accepted with a birth date", async () => {
      const ctx = createAuthContext();
      expect((await appRouter.createCaller(ctx).auth.me())!.termsAccepted).toBe(false);
      ctx.user = { ...ctx.user!, termsVersion: LEGAL_VERSION } as any;
      expect((await appRouter.createCaller(ctx).auth.me())!.termsAccepted).toBe(false); // no birth date yet
      ctx.user = { ...ctx.user!, termsVersion: LEGAL_VERSION, birthDate: "1990-05-05" } as any;
      expect((await appRouter.createCaller(ctx).auth.me())!.termsAccepted).toBe(true);
      ctx.user = { ...ctx.user!, termsVersion: "2020-01-01" } as any;
      expect((await appRouter.createCaller(ctx).auth.me())!.termsAccepted).toBe(false);
    });

    it("records acceptance with the birth date for an adult, and needs the box ticked", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await expect(caller.profile.acceptTerms({ birthDate: "1990-05-05", agreed: false } as any)).rejects.toThrow();
      await expect(caller.profile.acceptTerms({ birthDate: "not a date", agreed: true })).rejects.toThrow(/valid date/);
      await expect(caller.profile.acceptTerms({ birthDate: "2999-01-01", agreed: true })).rejects.toThrow(/valid date/);
      expect(db.deleteUserAccount).not.toHaveBeenCalled();
      await caller.profile.acceptTerms({ birthDate: "1990-05-05", agreed: true });
      expect(db.recordTermsAcceptance).toHaveBeenCalledWith(1, LEGAL_VERSION, "1990-05-05");
    });

    it("deletes the account and keeps nothing when the birth date is under 18", async () => {
      const ctx = createAuthContext();
      const young = new Date(Date.now() - 15 * 365 * 86_400_000).toISOString().slice(0, 10);
      await expect(appRouter.createCaller(ctx).profile.acceptTerms({ birthDate: young, agreed: true })).rejects.toThrow(/UNDER_18/);
      expect(db.deleteUserAccount).toHaveBeenCalledWith(1);
      expect(db.recordTermsAcceptance).not.toHaveBeenCalled();
      expect((ctx.res as any).clearCookie).toHaveBeenCalled();
    });

    it("lets an adult change their birth date but not to under 18", async () => {
      const caller = appRouter.createCaller(createAuthContext());
      await caller.profile.setBirthDate({ birthDate: "1985-01-01" });
      expect(db.setBirthDate).toHaveBeenCalledWith(1, "1985-01-01");
      const young = new Date(Date.now() - 10 * 365 * 86_400_000).toISOString().slice(0, 10);
      await expect(caller.profile.setBirthDate({ birthDate: young })).rejects.toThrow(/18/);
      expect(db.deleteUserAccount).not.toHaveBeenCalled();
    });

    it("refuses to delete without the word DELETE", async () => {
      await expect(appRouter.createCaller(createAuthContext()).profile.deleteAccount({ confirm: "nope" })).rejects.toThrow(/DELETE/);
      expect(db.deleteUserAccount).not.toHaveBeenCalled();
    });

    it("needs the right password for email accounts", async () => {
      const caller = appRouter.createCaller(await withPassword());
      await expect(caller.profile.deleteAccount({ confirm: "DELETE" })).rejects.toThrow(/password/);
      await expect(caller.profile.deleteAccount({ confirm: "DELETE", password: "wrong" })).rejects.toThrow(/password/);
      expect(db.deleteUserAccount).not.toHaveBeenCalled();
    });

    it("will not delete while a paid subscription is active", async () => {
      vi.mocked(db.getSubscription).mockResolvedValue({ tier: "premium", expiresAt: Date.now() + 86_400_000 } as any);
      await expect(appRouter.createCaller(createAuthContext()).profile.deleteAccount({ confirm: "DELETE" })).rejects.toThrow(/Cancel your subscription/);
      expect(db.deleteUserAccount).not.toHaveBeenCalled();
      vi.mocked(db.getSubscription).mockResolvedValue(null);
    });

    it("deletes the account, removes its stored photos and clears the session", async () => {
      vi.mocked(db.getSubscription).mockResolvedValue(null);
      const storage = await import("./storage");
      const ctx = await withPassword();
      const r = await appRouter.createCaller(ctx).profile.deleteAccount({ confirm: " delete ", password: "right-password" });
      expect(r.success).toBe(true);
      expect(db.deleteUserAccount).toHaveBeenCalledWith(1);
      expect(storage.storageDelete).toHaveBeenCalledWith("meals/1/a.jpg");
      expect(storage.storageDelete).toHaveBeenCalledWith("avatars/1/b.jpg");
      expect((ctx.res as any).clearCookie).toHaveBeenCalled();
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
      vi.mocked(db.getEntitlement).mockResolvedValue(ent("free"));
      vi.mocked(db.getTodayScanCount).mockResolvedValue(10); // at limit

      const ctx = createAuthContext();
      const caller = appRouter.createCaller(ctx);
      const fakeBase64 = Buffer.from("fake-image-data").toString("base64");

      await expect(
        caller.meals.analyzePhoto({ imageBase64: fakeBase64, mimeType: "image/jpeg" })
      ).rejects.toThrow(/FREE_LIMIT_REACHED/);
    });

    it("does not count scans for unlimited accounts", async () => {
      vi.mocked(db.getEntitlement).mockResolvedValue(ent("premium", true));
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
      vi.mocked(db.getEntitlement).mockResolvedValue(ent("free"));
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
