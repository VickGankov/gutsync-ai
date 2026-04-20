import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const isNullableString = (value: unknown): value is string | null | undefined =>
  value === undefined || value === null || typeof value === "string";

export type SessionPayload = {
  userId: number;
  email?: string | null;
  name?: string | null;
};

class SDKServer {
  private parseCookies(cookieHeader: string | undefined) {
    if (!cookieHeader) {
      return new Map<string, string>();
    }

    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  private normalizeUserId(value: unknown): number | null {
    if (typeof value === "number" && Number.isInteger(value) && value > 0) {
      return value;
    }

    if (typeof value === "string" && /^\d+$/.test(value)) {
      const parsed = Number.parseInt(value, 10);
      return parsed > 0 ? parsed : null;
    }

    return null;
  }

  async createSessionToken(
    userId: number | string,
    options: { expiresInMs?: number; name?: string | null; email?: string | null } = {}
  ): Promise<string> {
    const normalizedUserId = this.normalizeUserId(userId);

    if (!normalizedUserId) {
      throw new Error("A valid user ID is required to create a session token");
    }

    return this.signSession(
      {
        userId: normalizedUserId,
        email: options.email ?? null,
        name: options.name ?? null,
      },
      options
    );
  }

  async signSession(
    payload: SessionPayload,
    options: { expiresInMs?: number } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({
      userId: payload.userId,
      email: payload.email ?? null,
      name: payload.name ?? null,
      authType: "email",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(
    cookieValue: string | undefined | null
  ): Promise<SessionPayload | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { userId, email, name } = payload as Record<string, unknown>;
      const normalizedUserId = this.normalizeUserId(userId);

      if (!normalizedUserId || !isNullableString(email) || !isNullableString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return {
        userId: normalizedUserId,
        email: email ?? null,
        name: name ?? null,
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    const user = await db.getUserById(session.userId);

    if (!user) {
      throw ForbiddenError("User not found");
    }

    return user;
  }
}

export const sdk = new SDKServer();
