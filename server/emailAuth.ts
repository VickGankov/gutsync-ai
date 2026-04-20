import bcrypt from "bcrypt";
import crypto from "crypto";
import { eq } from "drizzle-orm";
import type { User } from "../drizzle/schema";
import { users } from "../drizzle/schema";
import { getDb } from "./db";

const PASSWORD_HASH_ROUNDS = 10;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export type AuthUser = Omit<
  User,
  "password" | "passwordResetToken" | "passwordResetExpiresAt" | "emailVerificationToken" | "emailVerificationExpiresAt"
> & {
  emailVerified: boolean;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function buildPasswordResetPath(token: string) {
  return `/auth?mode=reset&token=${encodeURIComponent(token)}`;
}

function buildVerificationPath(token: string) {
  return `/auth?verify=${encodeURIComponent(token)}`;
}

function isExpired(expiresAt: Date | null) {
  return !expiresAt || expiresAt.getTime() < Date.now();
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db;
}

async function findUserByEmail(email: string) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizeEmail(email)))
    .limit(1);

  return result[0];
}

export function sanitizeAuthUser(user: User): AuthUser {
  const {
    password: _password,
    passwordResetToken: _passwordResetToken,
    passwordResetExpiresAt: _passwordResetExpiresAt,
    emailVerificationToken: _emailVerificationToken,
    emailVerificationExpiresAt: _emailVerificationExpiresAt,
    ...safeUser
  } = user;

  return {
    ...safeUser,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
}

async function storeEmailVerificationToken(userId: number, email: string) {
  const db = await requireDb();
  const token = createToken();
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  await db
    .update(users)
    .set({
      emailVerificationToken: hashedToken,
      emailVerificationExpiresAt: expiresAt,
    })
    .where(eq(users.id, userId));

  console.log(`[Auth] Verification email for ${email}: ${buildVerificationPath(token)}`);
}

async function storePasswordResetToken(userId: number, email: string) {
  const db = await requireDb();
  const token = createToken();
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  await db
    .update(users)
    .set({
      passwordResetToken: hashedToken,
      passwordResetExpiresAt: expiresAt,
    })
    .where(eq(users.id, userId));

  console.log(`[Auth] Password reset email for ${email}: ${buildPasswordResetPath(token)}`);
}

export async function registerEmail(email: string, password: string, name?: string) {
  const db = await requireDb();
  const normalizedEmail = normalizeEmail(email);

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) throw new Error("Email already registered");

  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);
  const verificationToken = createToken();
  const verificationTokenHash = hashToken(verificationToken);
  const verificationExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  const result = await db.insert(users).values({
    email: normalizedEmail,
    password: passwordHash,
    name: name?.trim() || null,
    loginMethod: "email",
    emailVerifiedAt: null,
    emailVerificationToken: verificationTokenHash,
    emailVerificationExpiresAt: verificationExpiresAt,
    lastSignedIn: new Date(),
  });

  const userId = result[0].insertId as number;
  const createdUser = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  const user = createdUser[0];

  if (!user) {
    throw new Error("Failed to load created user");
  }

  console.log(`[Auth] Verification email for ${normalizedEmail}: ${buildVerificationPath(verificationToken)}`);

  return sanitizeAuthUser(user);
}

export async function loginEmail(email: string, password: string) {
  const db = await requireDb();
  const user = await findUserByEmail(email);

  if (!user || !user.password) throw new Error("Invalid credentials");

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error("Invalid credentials");

  await db
    .update(users)
    .set({ lastSignedIn: new Date() })
    .where(eq(users.id, user.id));

  if (!user.emailVerifiedAt && (isExpired(user.emailVerificationExpiresAt) || !user.emailVerificationToken)) {
    await storeEmailVerificationToken(user.id, user.email || normalizeEmail(email));
  }

  const refreshedUser = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  return sanitizeAuthUser(refreshedUser[0] ?? user);
}

export async function requestPasswordReset(email: string) {
  const user = await findUserByEmail(email).catch(() => undefined);

  if (user?.email) {
    await storePasswordResetToken(user.id, user.email);
  }

  return { success: true } as const;
}

export async function resetPassword(token: string, password: string) {
  const db = await requireDb();
  const hashedToken = hashToken(token.trim());
  const result = await db
    .select()
    .from(users)
    .where(eq(users.passwordResetToken, hashedToken))
    .limit(1);

  const user = result[0];
  if (!user || isExpired(user.passwordResetExpiresAt)) {
    throw new Error("Invalid or expired password reset token");
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_HASH_ROUNDS);

  await db
    .update(users)
    .set({
      password: passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      lastSignedIn: new Date(),
    })
    .where(eq(users.id, user.id));

  const refreshedUser = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
  return sanitizeAuthUser(refreshedUser[0] ?? user);
}

export async function requestEmailVerification(email: string) {
  const user = await findUserByEmail(email).catch(() => undefined);

  if (user?.email && !user.emailVerifiedAt) {
    await storeEmailVerificationToken(user.id, user.email);
  }

  return { success: true } as const;
}

export async function verifyEmail(token: string) {
  const db = await requireDb();
  const hashedToken = hashToken(token.trim());
  const result = await db
    .select()
    .from(users)
    .where(eq(users.emailVerificationToken, hashedToken))
    .limit(1);

  const user = result[0];
  if (!user || isExpired(user.emailVerificationExpiresAt)) {
    throw new Error("Invalid or expired email verification token");
  }

  await db
    .update(users)
    .set({
      emailVerifiedAt: new Date(),
      emailVerificationToken: null,
      emailVerificationExpiresAt: null,
    })
    .where(eq(users.id, user.id));

  const refreshedUser = await db.select().from(users).where(eq(users.id, user.id)).limit(1);

  return {
    success: true as const,
    user: sanitizeAuthUser(refreshedUser[0] ?? user),
  };
}
