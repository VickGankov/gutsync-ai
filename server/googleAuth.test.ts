import { describe, it, expect } from "vitest";
import { checkGoogleClaims, decodeJwtPayload, safeNext } from "../shared/googleAuth";

const CLIENT = "client-123.apps.googleusercontent.com";
const jwt = (payload: object) => `h.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.s`;
const good = { iss: "https://accounts.google.com", aud: CLIENT, exp: Math.floor(Date.now() / 1000) + 3600, sub: "1234567890", email: "Vick@Gmail.com", email_verified: true, name: "Vick G" };

describe("safeNext", () => {
  it("allows same-site paths only", () => {
    expect(safeNext("/log?tab=food")).toBe("/log?tab=food");
    expect(safeNext("/")).toBe("/");
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil", "javascript:alert(1)", "/api/trpc/x", undefined, 5, "/a\nb", "x".repeat(400)]) {
      expect(safeNext(bad as any)).toBe("/");
    }
  });
});

describe("decodeJwtPayload", () => {
  it("reads a payload and rejects junk", () => {
    expect(decodeJwtPayload(jwt({ a: 1 }))).toEqual({ a: 1 });
    expect(decodeJwtPayload("nope")).toBeNull();
    expect(decodeJwtPayload("a.b.c")).toBeNull();
  });
});

describe("checkGoogleClaims", () => {
  it("accepts a good token and lowercases the email", () => {
    const r = checkGoogleClaims(good, CLIENT);
    expect(r).toEqual({ ok: true, claims: { sub: "1234567890", email: "vick@gmail.com", name: "Vick G" } });
  });
  it("accepts the bare issuer form and a string email_verified", () => {
    expect(checkGoogleClaims({ ...good, iss: "accounts.google.com", email_verified: "true" }, CLIENT).ok).toBe(true);
  });
  it("rejects tokens for another app, another issuer, expired, or without a verified email", () => {
    expect(checkGoogleClaims({ ...good, aud: "someone-else" }, CLIENT)).toMatchObject({ ok: false, reason: "wrong audience" });
    expect(checkGoogleClaims({ ...good, iss: "https://evil.example" }, CLIENT)).toMatchObject({ ok: false, reason: "wrong issuer" });
    expect(checkGoogleClaims({ ...good, exp: 1 }, CLIENT)).toMatchObject({ ok: false, reason: "expired" });
    expect(checkGoogleClaims({ ...good, email_verified: false }, CLIENT)).toMatchObject({ ok: false, reason: "email not verified" });
    expect(checkGoogleClaims({ ...good, email: undefined }, CLIENT)).toMatchObject({ ok: false, reason: "no email" });
    expect(checkGoogleClaims({ ...good, sub: "" }, CLIENT)).toMatchObject({ ok: false, reason: "no subject" });
    expect(checkGoogleClaims(null, CLIENT)).toMatchObject({ ok: false });
  });
});
