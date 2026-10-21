// Shown once to anyone who has not confirmed they are 18+ and agreed to the Terms and Privacy Policy
// (new sign-ups by email or Google, and anyone when the terms change materially).

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

export default function TermsGate() {
  const utils = trpc.useUtils();
  const { logout } = useAuth();
  const [adult, setAdult] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const accept = trpc.profile.acceptTerms.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
    onError: e => toast.error(e.message || "Couldn't save. Try again."),
  });

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
        <h1 className="text-2xl tracking-tight">One quick step</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Triggerplate stores health information you choose to log. Please confirm the following to continue.
        </p>

        <label className="mt-5 flex items-start gap-3 text-sm leading-6">
          <input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} className="mt-1.5 h-4 w-4" />
          <span>I am 18 or older.</span>
        </label>
        <label className="mt-3 flex items-start gap-3 text-sm leading-6">
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} className="mt-1.5 h-4 w-4" />
          <span>
            I agree to the <a href="/terms" target="_blank" rel="noreferrer" className="underline">Terms of Service</a> and{" "}
            <a href="/privacy" target="_blank" rel="noreferrer" className="underline">Privacy Policy</a>, and I consent to
            Triggerplate collecting and processing the health information I enter, as described in the{" "}
            <a href="/health-data-privacy" target="_blank" rel="noreferrer" className="underline">Health Data Policy</a>.
          </span>
        </label>

        <button
          type="button"
          disabled={!adult || !agreed || accept.isPending}
          onClick={() => accept.mutate({ adult: true, agreed: true })}
          className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {accept.isPending ? "Saving…" : "Continue"}
        </button>
        <button type="button" onClick={() => logout().then(() => { window.location.href = "/"; })} className="mt-3 w-full text-xs text-muted-foreground underline">
          Sign out instead
        </button>
      </div>
    </main>
  );
}
