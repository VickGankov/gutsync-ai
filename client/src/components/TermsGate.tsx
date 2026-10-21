// Shown once to anyone who has not given a date of birth (18+) and agreed to the Terms and Privacy Policy
// (new sign-ups by email or Google, and anyone when the terms change materially).

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { checkBirthDate } from "@shared/profileStats";
import BirthDateSelect from "@/components/BirthDateSelect";

export default function TermsGate() {
  const utils = trpc.useUtils();
  const { logout } = useAuth();
  const [birthDate, setBirthDate] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const check = birthDate ? checkBirthDate(birthDate) : null;
  const accept = trpc.profile.acceptTerms.useMutation({
    onSuccess: () => utils.auth.me.invalidate(),
    onError: e => {
      if (e.message === "UNDER_18") { setBlocked(true); return; }
      toast.error(e.message || "Couldn't save. Try again.");
    },
  });

  if (blocked) {
    return (
      <main className="min-h-screen bg-background px-4 py-10">
        <div className="mx-auto max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
          <h1 className="text-2xl tracking-tight">Triggerplate is for adults</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            You need to be 18 or older to use Triggerplate. We have not kept any of your information, and the account was removed.
          </p>
          <button type="button" onClick={() => { window.location.href = "/"; }} className="mt-6 w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">OK</button>
        </div>
      </main>
    );
  }

  const problem = check === "invalid" ? "Enter a valid date." : check === "future" || check === "implausible" ? "That date doesn't look right." : null;

  return (
    <main className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
        <h1 className="text-2xl tracking-tight">One quick step</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Triggerplate is for adults and stores health information you choose to log. Your date of birth is used to confirm you are 18 or older
          and to make messages and insights fit your age.
        </p>

        <p className="mt-5 text-sm font-medium" id="dob-label">Date of birth</p>
        <BirthDateSelect value={birthDate} onChange={setBirthDate} />
        {problem && <p className="mt-1 text-xs text-coral">{problem}</p>}

        <label className="mt-4 flex items-start gap-3 text-sm leading-6">
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
          disabled={!birthDate || !!problem || !agreed || accept.isPending}
          onClick={() => accept.mutate({ birthDate, agreed: true })}
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
