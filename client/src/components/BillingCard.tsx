// Upgrade and billing on the profile page. Hidden until payments are switched on server-side.

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import Paywall from "@/components/Paywall";

export default function BillingCard() {
  const utils = trpc.useUtils();
  const status = trpc.subscription.status.useQuery(undefined, { retry: false });
  const [open, setOpen] = useState(false);
  const portal = trpc.subscription.portal.useMutation({
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: e => toast.error(e.message),
  });

  // Back from Stripe: the webhook may land a moment after the redirect, so check a few times.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("upgraded") !== "1") return;
    window.history.replaceState(null, "", window.location.pathname);
    toast.success("Thanks! Activating Premium…");
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      await utils.subscription.status.invalidate();
      if (tries >= 6) clearInterval(t);
    }, 2500);
    return () => clearInterval(t);
  }, [utils]);

  const d = status.data;
  if (!d || !d.billingEnabled) return null;

  if (d.isPremium) {
    return (
      <div className="bg-card border border-border/50 rounded-2xl p-5 mb-5 flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Premium</p>
          <p className="text-xs text-muted-foreground">Labs, protocol and extra scans.</p>
        </div>
        {d.canManageBilling && (
          <button onClick={() => portal.mutate()} disabled={portal.isPending} className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
            Manage
          </button>
        )}
      </div>
    );
  }
  return (
    <>
      <div className="bg-card border border-border/50 rounded-2xl p-5 mb-5 flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Go Premium</p>
          <p className="text-xs text-muted-foreground">$10/month or $99/year. Labs, protocol, 50 scans a day.</p>
        </div>
        <button onClick={() => setOpen(true)} className="text-xs font-semibold text-primary-foreground bg-primary px-3 py-1.5 rounded-full">
          Upgrade
        </button>
      </div>
      <Paywall isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
