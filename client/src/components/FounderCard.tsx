// Founding members: redeem an invite code for every feature and a higher daily scan limit.

import { useState } from "react";
import { Crown } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { SCAN_LIMITS } from "@shared/plans";

export default function FounderCard() {
  const utils = trpc.useUtils();
  const status = trpc.subscription.status.useQuery(undefined, { retry: false });
  const [code, setCode] = useState("");
  const redeem = trpc.subscription.redeemFounder.useMutation({
    onSuccess: async () => {
      setCode("");
      await utils.subscription.status.invalidate();
      toast.success("Welcome, founding member. Everything is unlocked.");
    },
    onError: e => toast.error(e.message || "Couldn't redeem that code."),
  });

  if (status.isLoading || !status.data) return null;

  if (status.data.isFounder) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-5 flex items-center gap-3">
        <Crown className="w-5 h-5 text-amber-500 shrink-0" />
        <div>
          <p className="text-sm font-semibold">Founding member</p>
          <p className="text-xs text-muted-foreground">All features unlocked · {SCAN_LIMITS.founder} scans a day. Thank you for testing early.</p>
        </div>
      </div>
    );
  }
  if (status.data.isPremium) return null;

  return (
    <form
      className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5"
      onSubmit={e => { e.preventDefault(); if (code.trim()) redeem.mutate({ code }); }}
    >
      <p className="text-sm font-semibold mb-1">Have a founder code?</p>
      <p className="text-xs text-muted-foreground mb-3">Founding members get every feature and {SCAN_LIMITS.founder} scans a day.</p>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="Enter code"
          autoCapitalize="off"
          autoCorrect="off"
          className="flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm"
        />
        <button type="submit" disabled={redeem.isPending || !code.trim()} className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50">
          {redeem.isPending ? "…" : "Redeem"}
        </button>
      </div>
    </form>
  );
}
