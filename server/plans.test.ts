import { describe, it, expect } from "vitest";
import { SCAN_LIMITS, resolvePlan, hasFeature, founderCodeMatches, scanLimitFor } from "@shared/plans";

describe("plans", () => {
  it("resolves paid over founder over free", () => {
    expect(resolvePlan({ premium: true, founder: true })).toBe("premium");
    expect(resolvePlan({ premium: false, founder: true })).toBe("founder");
    expect(resolvePlan({ premium: false, founder: false })).toBe("free");
  });
  it("testers get every feature at the free scan limit, below founders", () => {
    expect(resolvePlan({ premium: false, founder: false, tester: true })).toBe("tester");
    expect(resolvePlan({ premium: false, founder: true, tester: true })).toBe("founder");
    expect(scanLimitFor("tester")).toBe(SCAN_LIMITS.free);
    expect(hasFeature("tester", "labs", true)).toBe(true);
  });
  it("uses the agreed scan limits", () => {
    expect([scanLimitFor("free"), scanLimitFor("founder"), scanLimitFor("premium")]).toEqual([10, 20, 50]);
    expect(SCAN_LIMITS.free).toBeLessThan(SCAN_LIMITS.founder);
  });
  it("only locks gated features for free users once the paywall is on", () => {
    expect(hasFeature("free", "labs", false)).toBe(true);
    expect(hasFeature("free", "labs", true)).toBe(false);
    expect(hasFeature("free", "protocol", true)).toBe(false);
    expect(hasFeature("founder", "labs", true)).toBe(true);
    expect(hasFeature("premium", "protocol", true)).toBe(true);
  });
  it("matches founder codes loosely on case and spaces, never an empty code", () => {
    expect(founderCodeMatches("  Early-Bird ", "early-bird")).toBe(true);
    expect(founderCodeMatches("early-birdX", "early-bird")).toBe(false);
    expect(founderCodeMatches("", "")).toBe(false);
    expect(founderCodeMatches("anything", "")).toBe(false);
  });
});

import { friendlyPlanError } from "@shared/plans";
describe("friendlyPlanError", () => {
  it("rewrites paywall errors and leaves other messages alone", () => {
    expect(friendlyPlanError("PREMIUM_REQUIRED:labs")).toBe("Lab results are part of the paid plan.");
    expect(friendlyPlanError("PREMIUM_REQUIRED:protocol")).toBe("The reintroduction protocol is part of the paid plan.");
    expect(friendlyPlanError("Something else")).toBe("Something else");
  });
});
