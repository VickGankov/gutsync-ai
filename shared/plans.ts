// Plans: what each tier can do. Free stays free forever; founders get everything plus a higher
// scan limit; premium is the paid tier. Gated features only lock when the paywall is switched on.

export type Plan = "free" | "tester" | "founder" | "premium";
export type GatedFeature = "labs" | "protocol";

export const SCAN_LIMITS: Record<Plan, number> = { free: 10, tester: 10, founder: 20, premium: 50 };
export const GATED_FEATURES: GatedFeature[] = ["labs", "protocol"];
export const MAX_FOUNDERS_DEFAULT = 30;

export function scanLimitFor(plan: Plan): number {
  return SCAN_LIMITS[plan];
}

/** Free users lose gated features only once the paywall is on. Testers, founders and premium always have them. */
export function hasFeature(plan: Plan, _feature: GatedFeature, paywallOn: boolean): boolean {
  return !paywallOn || plan !== "free";
}

/** A paid subscription wins over the founder grant; no grant and no subscription is free. */
export function resolvePlan(opts: { premium: boolean; founder: boolean; tester?: boolean }): Plan {
  if (opts.premium) return "premium";
  if (opts.founder) return "founder";
  if (opts.tester) return "tester";
  return "free";
}

export function featureLabel(f: GatedFeature): string {
  return f === "labs" ? "Lab results" : "The reintroduction protocol";
}

/** Case-insensitive, whitespace-tolerant compare of a typed code against the configured one. */
export function founderCodeMatches(typed: string, configured: string): boolean {
  const a = typed.trim().toLowerCase();
  const b = configured.trim().toLowerCase();
  if (!b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Turns a server error message into something a person can read (PREMIUM_REQUIRED:labs → a sentence). */
export function friendlyPlanError(message: string): string {
  const m = /^PREMIUM_REQUIRED:(labs|protocol)/.exec(message);
  if (!m) return message;
  return `${featureLabel(m[1] as GatedFeature)} ${m[1] === "labs" ? "are" : "is"} part of the paid plan.`;
}
