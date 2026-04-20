import { beforeEach, describe, expect, it, vi } from "vitest";

type MockUser = {
  id: number;
  openId: string | null;
  email: string | null;
  password: string | null;
  name: string | null;
  loginMethod: string | null;
  role: "user" | "admin";
  emailVerifiedAt: Date | null;
  emailVerificationToken: string | null;
  emailVerificationExpiresAt: Date | null;
  passwordResetToken: string | null;
  passwordResetExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastSignedIn: Date;
};

const state = {
  nextId: 1,
  users: [] as MockUser[],
};

function resetState() {
  state.nextId = 1;
  state.users = [];
}

function matches(user: MockUser, condition: { fieldName: string; value: unknown }) {
  return (user as Record<string, unknown>)[condition.fieldName] === condition.value;
}

const mockDb = {
  select: () => ({
    from: () => ({
      where: (condition: { fieldName: string; value: unknown }) => ({
        limit: async (count: number) => state.users.filter(user => matches(user, condition)).slice(0, count),
      }),
    }),
  }),
  insert: () => ({
    values: async (value: Partial<MockUser>) => {
      const user: MockUser = {
        id: state.nextId++,
        openId: value.openId ?? null,
        email: value.email ?? null,
        password: value.password ?? null,
        name: value.name ?? null,
        loginMethod: value.loginMethod ?? null,
        role: value.role ?? "user",
        emailVerifiedAt: value.emailVerifiedAt ?? null,
        emailVerificationToken: value.emailVerificationToken ?? null,
        emailVerificationExpiresAt: value.emailVerificationExpiresAt ?? null,
        passwordResetToken: value.passwordResetToken ?? null,
        passwordResetExpiresAt: value.passwordResetExpiresAt ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: value.lastSignedIn ?? new Date(),
      };

      state.users.push(user);
      return [{ insertId: user.id }];
    },
  }),
  update: () => ({
    set: (values: Partial<MockUser>) => ({
      where: async (condition: { fieldName: string; value: unknown }) => {
        const user = state.users.find(entry => matches(entry, condition));
        if (user) {
          Object.assign(user, values, { updatedAt: new Date() });
        }
        return [];
      },
    }),
  }),
};

vi.mock("drizzle-orm", () => ({
  eq: (field: { name: string }, value: unknown) => ({ fieldName: field.name, value }),
}));

vi.mock("./db", () => ({
  getDb: vi.fn(async () => mockDb),
}));

import {
  loginEmail,
  registerEmail,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  verifyEmail,
} from "./emailAuth";

describe("Email Auth", () => {
  const testEmail = "test@example.com";
  const testPassword = "TestPassword123!";

  beforeEach(() => {
    resetState();
    vi.restoreAllMocks();
  });

  it("should register new user", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const user = await registerEmail(testEmail, testPassword, "Test User");

    expect(user.id).toBeGreaterThan(0);
    expect(user.email).toBe(testEmail);
    expect(user.name).toBe("Test User");
    expect(user.emailVerified).toBe(false);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it("should reject duplicate email", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await registerEmail(testEmail, testPassword, "Test User");

    await expect(registerEmail(testEmail, "AnotherPassword123!", "Another")).rejects.toThrow(
      "already registered"
    );
  });

  it("should login with correct password", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await registerEmail(testEmail, testPassword, "Test User");

    const user = await loginEmail(testEmail, testPassword);
    expect(user.id).toBeGreaterThan(0);
    expect(user.email).toBe(testEmail);
  });

  it("should reject wrong password", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await registerEmail(testEmail, testPassword, "Test User");

    await expect(loginEmail(testEmail, "WrongPassword")).rejects.toThrow("Invalid credentials");
  });

  it("should reject non-existent email", async () => {
    await expect(loginEmail("nonexistent@example.com", testPassword)).rejects.toThrow(
      "Invalid credentials"
    );
  });

  it("should issue password reset tokens and accept valid resets", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await registerEmail(testEmail, testPassword, "Test User");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await requestPasswordReset(testEmail);

    const loggedMessage = logSpy.mock.calls.at(-1)?.[0];
    const token = typeof loggedMessage === "string" ? /token=([^&\s]+)/.exec(loggedMessage)?.[1] : undefined;

    expect(token).toBeTruthy();

    const user = await resetPassword(token!, "NewPassword123!");
    expect(user.email).toBe(testEmail);

    const loggedInUser = await loginEmail(testEmail, "NewPassword123!");
    expect(loggedInUser.email).toBe(testEmail);
  });

  it("should issue verification tokens and verify email addresses", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await registerEmail(testEmail, testPassword, "Test User");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await requestEmailVerification(testEmail);

    const loggedMessage = logSpy.mock.calls.at(-1)?.[0];
    const token = typeof loggedMessage === "string" ? /verify=([^&\s]+)/.exec(loggedMessage)?.[1] : undefined;

    expect(token).toBeTruthy();

    const result = await verifyEmail(token!);
    expect(result.success).toBe(true);
    expect(result.user.emailVerified).toBe(true);
  });
});
