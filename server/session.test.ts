import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-for-session-tests-1234567890";
});

describe("session tokens", () => {
  it("accepts a session for an email sign-up with no name", async () => {
    const { sdk } = await import("./_core/sdk");
    const token = await sdk.createSessionToken("42", { name: "" });
    const session = await sdk.verifySession(token);
    expect(session?.openId).toBe("42");
  });

  it("rejects a tampered or missing token", async () => {
    const { sdk } = await import("./_core/sdk");
    const token = await sdk.createSessionToken("42", { name: "Vick" });
    expect(await sdk.verifySession(token.slice(0, -2) + "xx")).toBeNull();
    expect(await sdk.verifySession(undefined)).toBeNull();
  });
});
