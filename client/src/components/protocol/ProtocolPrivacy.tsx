// Plain statements about protocol data. Each line is true of the current code; keep it that way
// (doses are never part of any AI request, reminders never name a compound, there is no ad tracking).

import { useState } from "react";
import { Lock } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function ProtocolPrivacy({ hasData, expanded }: { hasData: boolean; expanded: boolean }) {
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(expanded);
  const [confirm, setConfirm] = useState(false);
  const wipe = trpc.dose.deleteAll.useMutation({
    onSuccess: () => { utils.dose.list.invalidate(); setConfirm(false); toast.success("Dose log and schedules deleted"); },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-card px-3 py-2.5">
      <button className="flex w-full items-center gap-1.5 text-xs font-semibold" onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <Lock className="w-3.5 h-3.5" /> Your protocol stays private
        <span className="ml-auto text-[11px] font-semibold text-[var(--action)] underline decoration-[var(--action)]/30 underline-offset-4">{open ? "Hide" : "Details"}</span>
      </button>
      {open && (
        <div className="mt-2 text-xs text-muted-foreground space-y-1.5">
          <ul className="list-disc pl-4 space-y-1">
            <li>Only your account can see your doses, compounds, sites and notes in the app.</li>
            <li>They are never sold, never used for ads, and never sent to the AI that reads meal photos and lab reports.</li>
            <li>Reminders and notifications never name a compound, so nothing shows on your lock screen.</li>
            <li>Stored with our hosting and database providers only, as listed in the <Link href="/health-data-privacy" className="underline">health data policy</Link>.</li>
            <li>You can export everything or delete your account from Profile, or wipe just this log below.</li>
          </ul>
          {hasData && (confirm ? (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-foreground">Delete every dose and schedule? This can't be undone.</span>
              <button className="font-semibold text-coral" disabled={wipe.isPending} onClick={() => wipe.mutate()}>Delete</button>
              <button onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          ) : (
            <button className="underline" onClick={() => setConfirm(true)}>Delete my dose log</button>
          ))}
        </div>
      )}
    </div>
  );
}
