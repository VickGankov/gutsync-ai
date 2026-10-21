// Date of birth checks and fitness target suggestions.

export type BirthCheck = "ok" | "invalid" | "future" | "under18" | "implausible";


export function parseBirthDate(s: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return { y, m: mo, d };
}

/** Whole years old on `now` (compared by calendar date), or null for an invalid date. */
export function ageOn(birthDate: string, now: Date): number | null {
  const b = parseBirthDate(birthDate);
  if (!b) return null;
  let age = now.getUTCFullYear() - b.y;
  const before = now.getUTCMonth() + 1 < b.m || (now.getUTCMonth() + 1 === b.m && now.getUTCDate() < b.d);
  if (before) age -= 1;
  return age;
}

export function checkBirthDate(birthDate: string, now: Date = new Date()): BirthCheck {
  const b = parseBirthDate(birthDate);
  if (!b) return "invalid";
  const age = ageOn(birthDate, now)!;
  if (age < 0) return "future";
  if (age < 18) return "under18";
  if (age > 120) return "implausible";
  return "ok";
}
