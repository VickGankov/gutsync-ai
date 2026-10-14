/** True if the email is in a comma-separated allowlist (case-insensitive). */
export function isEmailInList(email: string | null | undefined, list: string): boolean {
  if (!email) return false;
  const target = email.trim().toLowerCase();
  return list.split(",").map(s => s.trim().toLowerCase()).filter(Boolean).includes(target);
}
