// Redeems an invite link's code once the person is signed in and past the terms gate. Renders nothing.

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { clearPendingInvite, getPendingInvite } from "@/lib/invite";

export default function InviteRedeemer() {
  const utils = trpc.useUtils();
  const started = useRef(false);
  const redeem = trpc.subscription.redeemInvite.useMutation({
    onSuccess: async r => {
      clearPendingInvite();
      await utils.subscription.status.invalidate();
      if (!r.already) toast.success(r.plan === "founder" ? "Welcome, founding member. Everything is unlocked." : "Welcome, beta tester. Everything is unlocked.");
    },
    onError: e => { clearPendingInvite(); toast.error(e.message || "Couldn't use that invite."); },
  });

  useEffect(() => {
    const code = getPendingInvite();
    if (!code || started.current) return;
    started.current = true;
    redeem.mutate({ code });
  }, [redeem]);

  return null;
}
