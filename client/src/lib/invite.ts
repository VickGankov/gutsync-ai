// Invite links look like triggerplate.com/?invite=CODE. The code is kept until the person has signed in and accepted
// the terms, then redeemed once (see InviteRedeemer).

const KEY = "tp_invite";

/** Remembers ?invite=CODE from the address bar and removes it from the URL. Safe to call anywhere. */
export function captureInviteFromUrl() {
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("invite")?.trim();
    if (!code) return;
    localStorage.setItem(KEY, code.slice(0, 64));
    url.searchParams.delete("invite");
    window.history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
  } catch { /* storage or history blocked: the person can type the code instead */ }
}

export function getPendingInvite(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function clearPendingInvite() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
