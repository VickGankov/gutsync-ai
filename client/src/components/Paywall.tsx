/**
 * Triggerplate: upgrade dialog. Sends the person to Stripe Checkout; the plan changes when Stripe confirms payment.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Zap, FlaskConical, Route, Check, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface PaywallProps {
  isOpen: boolean;
  onClose: () => void;
  /** Kept for callers; payment completes on Stripe's page and the plan updates when you come back. */
  onSuccess?: () => void;
  scansUsed?: number;
  dailyLimit?: number;
}

const PREMIUM_FEATURES = [
  { icon: Zap, label: "50 food scans a day" },
  { icon: FlaskConical, label: "Lab results tracking" },
  { icon: Route, label: "Reintroduction protocol" },
  { icon: Sparkles, label: "Everything else, as it ships" },
];

const PRICES = {
  year: { label: "Annual", price: "$99", note: "$8.25/mo, billed yearly", badge: "Best value · save 17%" },
  month: { label: "Monthly", price: "$10", note: "Cancel anytime", badge: null },
} as const;

export default function Paywall({ isOpen, onClose, scansUsed, dailyLimit }: PaywallProps) {
  const [interval, setInterval] = useState<"month" | "year">("year");
  const status = trpc.subscription.status.useQuery(undefined, { enabled: isOpen });
  const checkout = trpc.subscription.checkout.useMutation({
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: (e) => toast.error(e.message),
  });
  const billingOn = status.data?.billingEnabled ?? false;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="w-full max-w-lg bg-background rounded-t-3xl overflow-hidden shadow-2xl"
          >
            <div className="relative px-6 pt-6 pb-4 text-center"
              style={{ background: "linear-gradient(135deg, oklch(0.55 0.1 155 / 0.12), oklch(0.7 0.12 25 / 0.08))" }}>
              <button onClick={onClose} aria-label="Close"
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
              <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Upgrade to Premium</h2>
              {scansUsed != null && dailyLimit != null && (
                <p className="text-sm text-muted-foreground mt-1">You've used {scansUsed} of {dailyLimit} scans today. Manual logging always works.</p>
              )}
            </div>

            <div className="px-6 pb-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2 py-2">
                {PREMIUM_FEATURES.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm">
                    <div className="w-6 h-6 rounded-full bg-sage-light/60 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-sage-dark" />
                    </div>
                    <span className="text-foreground/80 leading-tight">{label}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-2.5">
                {(["year", "month"] as const).map((k) => {
                  const p = PRICES[k];
                  const on = interval === k;
                  return (
                    <button key={k} onClick={() => setInterval(k)}
                      className={`w-full rounded-2xl border-2 p-4 text-left transition-all relative ${on ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
                      {p.badge && (
                        <div className="absolute -top-2.5 left-4">
                          <span className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">{p.badge}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-foreground">{p.label}</p>
                          <p className="text-xs text-muted-foreground">{p.note}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">{p.price}</p>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ml-auto mt-1 ${on ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                            {on && <Check className="w-3 h-3 text-primary-foreground" />}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => checkout.mutate({ interval })}
                disabled={!billingOn || checkout.isPending}
                className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {checkout.isPending ? <><Loader2 className="w-5 h-5 animate-spin" /> Opening checkout…</> : <><Sparkles className="w-5 h-5" /> {billingOn ? "Continue to checkout" : "Payments coming soon"}</>}
              </button>
              <p className="text-xs text-center text-muted-foreground">Secure checkout by Stripe. Renews automatically. Cancel anytime from your profile.</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
