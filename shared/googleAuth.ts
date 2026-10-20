// Pure helpers for "Continue with Google": claim checks and safe redirect targets.

export interface GoogleClaims { sub: string; email: string; name: string | null }

/** Only same-site paths: must start with a single "/" so a crafted link can't send people elsewhere. */
export function safeNext(next: unknown): string {
  if (typeof next !== "string" || next.length > 300) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\r\n]/.test(next)) return "/";
  if (next.startsWith("/api/")) return "/";
  return next;
}

/** Read the payload of a JWT without checking its signature. Only use for a token received directly from Google over TLS. */
export function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const json = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const obj = JSON.parse(json);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

export type ClaimCheck = { ok: true; claims: GoogleClaims } | { ok: false; reason: string };

/** The id_token must be for our client, from Google, unexpired, with a verified email. */
export function checkGoogleClaims(payload: Record<string, unknown> | null, clientId: string, nowMs: number = Date.now()): ClaimCheck {
  if (!payload) return { ok: false, reason: "unreadable token" };
  const iss = payload.iss;
  if (iss !== "https://accounts.google.com" && iss !== "accounts.google.com") return { ok: false, reason: "wrong issuer" };
  const aud = payload.aud;
  if (aud !== clientId && !(Array.isArray(aud) && aud.includes(clientId))) return { ok: false, reason: "wrong audience" };
  if (typeof payload.exp !== "number" || payload.exp * 1000 <= nowMs) return { ok: false, reason: "expired" };
  if (typeof payload.sub !== "string" || !payload.sub || payload.sub.length > 40) return { ok: false, reason: "no subject" };
  if (typeof payload.email !== "string" || !payload.email.includes("@")) return { ok: false, reason: "no email" };
  if (payload.email_verified !== true && payload.email_verified !== "true") return { ok: false, reason: "email not verified" };
  return {
    ok: true,
    claims: { sub: payload.sub, email: payload.email.trim().toLowerCase(), name: typeof payload.name === "string" && payload.name.trim() ? payload.name.trim().slice(0, 100) : null },
  };
}
