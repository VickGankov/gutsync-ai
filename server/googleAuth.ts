// "Continue with Google": a server-side OAuth code flow that ends with the same session cookie as email login.

import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { eq, sql } from "drizzle-orm";
import { COOKIE_NAME } from "@shared/const";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";
import { checkGoogleClaims, decodeJwtPayload, safeNext, type GoogleClaims } from "../shared/googleAuth";

const AUTH_URL = () => process.env.GOOGLE_AUTH_URL || "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = () => process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const STATE_COOKIE = "gs_oauth";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function isHttps(req: Request) {
  if (req.protocol === "https") return true;
  const fwd = req.headers["x-forwarded-proto"];
  return (Array.isArray(fwd) ? fwd.join(",") : fwd ?? "").split(",").some(p => p.trim().toLowerCase() === "https");
}

/** The address Google sends people back to. APP_BASE_URL wins so it matches what is registered with Google. */
export function redirectUri(req: Request): string {
  const base = process.env.APP_BASE_URL?.replace(/\/+$/, "") || `${isHttps(req) ? "https" : "http"}://${req.headers.host}`;
  return `${base}/api/auth/google/callback`;
}

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

const toAuthPage = (res: Response, error: string) => res.redirect(302, `/auth?error=${encodeURIComponent(error)}`);

export type GoogleSignIn = { user: { id: number; name: string | null }; linkedExisting: boolean };

/**
 * Find or create the account for a Google identity.
 * An existing email-and-password account with the same (Google-verified) address is linked, and its password is
 * removed: email signup never verified that address, so a stranger may have registered it first.
 */
export async function signInWithGoogle(c: GoogleClaims): Promise<GoogleSignIn> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const openId = `google:${c.sub}`;

  const [byGoogle] = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  if (byGoogle) {
    await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, byGoogle.id));
    return { user: { id: byGoogle.id, name: byGoogle.name }, linkedExisting: false };
  }

  // Older accounts may hold the address in whatever case it was typed.
  const [existing] = await db.select().from(users).where(sql`lower(${users.email}) = ${c.email}`).limit(1);
  if (existing) {
    if (existing.openId && existing.openId !== openId) throw new Error("account exists with another sign-in method");
    const hadPassword = !!existing.password;
    await db.update(users).set({ openId, password: null, loginMethod: "google", lastSignedIn: new Date(), name: existing.name || c.name }).where(eq(users.id, existing.id));
    return { user: { id: existing.id, name: existing.name || c.name }, linkedExisting: hadPassword };
  }

  const result = await db.insert(users).values({ openId, email: c.email, name: c.name, loginMethod: "google", lastSignedIn: new Date() });
  return { user: { id: result[0].insertId as number, name: c.name }, linkedExisting: false };
}

export function registerGoogleAuthRoutes(app: Express) {
  app.get("/api/auth/google", (req, res) => {
    if (!googleConfigured()) return toAuthPage(res, "google_unavailable");
    const state = crypto.randomBytes(24).toString("hex");
    const next = safeNext(req.query.next);
    res.cookie(STATE_COOKIE, `${state}.${Buffer.from(next).toString("base64url")}`, {
      httpOnly: true, sameSite: "lax", secure: isHttps(req), path: "/api/auth/google", maxAge: 10 * 60 * 1000,
    });
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: redirectUri(req),
      response_type: "code",
      scope: "openid email profile",
      state,
      prompt: "select_account",
    });
    res.redirect(302, `${AUTH_URL()}?${params}`);
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    if (!googleConfigured()) return toAuthPage(res, "google_unavailable");
    const cookie = readCookie(req, STATE_COOKIE);
    res.clearCookie(STATE_COOKIE, { path: "/api/auth/google" });
    if (req.query.error) return toAuthPage(res, "google_cancelled"); // e.g. the person pressed Cancel
    const [expected, nextB64] = (cookie ?? "").split(".");
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const code = typeof req.query.code === "string" ? req.query.code : "";
    if (!expected || !state || expected.length !== state.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(state)) || !code) {
      return toAuthPage(res, "google_failed");
    }
    const next = safeNext(nextB64 ? Buffer.from(nextB64, "base64url").toString("utf8") : "/");

    try {
      const tokenRes = await fetch(TOKEN_URL(), {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri(req), grant_type: "authorization_code",
        }),
      });
      if (!tokenRes.ok) throw new Error(`token exchange ${tokenRes.status}`);
      const tokens = (await tokenRes.json()) as { id_token?: string };
      const check = checkGoogleClaims(decodeJwtPayload(tokens.id_token ?? ""), process.env.GOOGLE_CLIENT_ID!);
      if (!check.ok) {
        console.error("[googleAuth] rejected token:", check.reason);
        return toAuthPage(res, check.reason === "email not verified" ? "google_unverified" : "google_failed");
      }

      const { user, linkedExisting } = await signInWithGoogle(check.claims);
      const { sdk } = await import("./_core/sdk");
      const token = await sdk.createSessionToken(user.id.toString(), { name: user.name || "" });
      res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.redirect(302, linkedExisting ? "/profile?notice=google-linked" : next);
    } catch (e: any) {
      console.error("[googleAuth] sign-in failed:", e?.message ?? e);
      toAuthPage(res, e?.message?.includes("another sign-in") ? "google_other_method" : "google_failed");
    }
  });
}
