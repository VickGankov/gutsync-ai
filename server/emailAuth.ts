import bcrypt from 'bcrypt';
import { getDb } from './db';
import { users, passwordResetTokens } from '../drizzle/schema';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import crypto from 'crypto';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/**
 * Finds a user by email regardless of letter case. New accounts store the lowercase address, but older
 * accounts may hold whatever case the person typed, and TiDB compares text case-sensitively by default.
 */
async function findUserByEmail(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, email: string) {
  const normalized = normalizeEmail(email);
  const candidates = [normalized, email.trim()].filter((v, i, a) => a.indexOf(v) === i);
  for (const candidate of candidates) {
    const rows = await db.select().from(users).where(eq(users.email, candidate)).limit(1);
    if (rows.length > 0) return rows;
  }
  return db.select().from(users).where(sql`lower(${users.email}) = ${normalized}`).limit(1);
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashResetToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getAppBaseUrl(requestBaseUrl?: string) {
  return process.env.APP_BASE_URL || requestBaseUrl || process.env.VITE_APP_URL || 'http://localhost:3000';
}

/** True when SMTP settings (e.g. a Gmail app password) are present. Works on paid Render instances; free ones block SMTP. */
function smtpConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendPasswordResetEmail(email: string, resetUrl: string) {
  const subject = 'Reset your GutSync password';
  const html = `<p>You requested a password reset for GutSync.</p><p><a href="${resetUrl}">Reset your password</a></p><p>This link expires in 1 hour. If you didn't ask for this, you can ignore this email.</p>`;
  const text = `You requested a password reset for GutSync.\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour. If you didn't ask for this, you can ignore this email.`;

  if (smtpConfigured()) {
    const nodemailer = await import('nodemailer');
    const port = Number(process.env.SMTP_PORT || 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM || `GutSync <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      text,
      html,
    });
    return;
  }

  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!resendKey || !fromEmail) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[Auth] Password reset link for ${email}: ${resetUrl}`);
    }
    throw new Error("Password reset email is not configured: set SMTP_HOST/SMTP_USER/SMTP_PASS or RESEND_API_KEY/RESEND_FROM_EMAIL.");
  }

  const response = await fetch(process.env.RESEND_API_URL || 'https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromEmail, to: email, subject, html, text }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send reset email: ${errorText}`);
  }
}

export async function registerEmail(email: string, password: string, name?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  
  email = normalizeEmail(email);
  const existing = await findUserByEmail(db, email);
  if (existing.length > 0) throw new Error("Email already registered");
  
  const hash = await bcrypt.hash(password, 10);
  const result = await db.insert(users).values({
    email,
    password: hash,
    name: name || null,
    loginMethod: 'email',
    lastSignedIn: new Date(),
  });
  
  return { id: result[0].insertId as number, email, name: name || null };
}

export async function loginEmail(email: string, password: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  
  const result = await findUserByEmail(db, email);
  if (result.length === 0) throw new Error("Invalid credentials");
  
  const user = result[0];
  if (!user.password) {
    if (user.loginMethod === 'google') throw new Error("This account uses Google. Tap Continue with Google.");
    throw new Error("Invalid credentials");
  }
  
  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error("Invalid credentials");
  
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
  
  return { id: user.id, email: user.email || '', name: user.name, role: user.role };
}

export async function requestPasswordReset(email: string, requestBaseUrl?: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Password reset is temporarily unavailable. Please try again later.");

  const result = await findUserByEmail(db, email);
  if (result.length === 0) {
    return;
  }

  try {
    const user = result[0];
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = Date.now() + RESET_TOKEN_TTL_MS;

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    const resetUrl = `${getAppBaseUrl(requestBaseUrl)}/reset-password?token=${encodeURIComponent(rawToken)}`;
    await sendPasswordResetEmail(user.email || email, resetUrl);
  } catch (error) {
    console.error("[Auth] Password reset request failed:", error);
    throw new Error("We couldn't send a reset link right now. Please try again in a few minutes.");
  }
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Password reset is temporarily unavailable. Please try again later.");

  const tokenHash = hashResetToken(token);
  const now = Date.now();

  try {
    const matchingToken = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          gt(passwordResetTokens.expiresAt, now),
          isNull(passwordResetTokens.usedAt)
        )
      )
      .limit(1);

    if (matchingToken.length === 0) {
      throw new Error("Invalid or expired reset link");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.update(users).set({ password: passwordHash }).where(eq(users.id, matchingToken[0].userId));
    await db
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, matchingToken[0].id));
  } catch (error) {
    if (error instanceof Error && error.message === "Invalid or expired reset link") {
      throw error;
    }
    console.error("[Auth] Password reset failed:", error);
    throw new Error("We couldn't reset your password right now. Please request a new link and try again.");
  }
}
