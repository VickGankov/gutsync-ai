/**
 * Triggerplate — Paywall Component
 * Shows premium upgrade options when the free scan limit is reached.
 * Integrates with RevenueCat Capacitor SDK for native purchases.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Zap, Shield, TrendingUp, Check, Loader2, RotateCcw } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

// ─── RevenueCat types (loaded dynamically for web compat) ─────────────────────
type RCOffering = {
  availablePackages: RCPackage[];
};
type RCPackage = {
  identifier: string;
  packageType: string;
  product: {
    identifier: string;
    title: string;
    description: string;
    priceString: string;
    price: number;
    currencyCode: string;
    introPrice?: { priceString: string; periodNumberOfUnits: number; periodUnit: string } | null;
  };
};

interface PaywallProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** How many free scans were used today */
  scansUsed?: number;
  dailyLimit?: number;
}

const PREMIUM_FEATURES = [
  { icon: Zap, label: "Unlimited food scans" },
  { icon: TrendingUp, label: "Advanced trigger pattern analysis" },
  { icon: Shield, label: "48-hour correlation engine" },
  { icon: Sparkles, label: "Priority processing" },
];

export default function Paywall({ isOpen, onClose, onSuccess, scansUsed = 10, dailyLimit = 10 }: PaywallProps) {
  const [offerings, setOfferings] = useState<RCOffering | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<RCPackage | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [rcReady, setRcReady] = useState(false);

  const activateMutation = trpc.subscription.activate.useMutation();
  const restoreMutation = trpc.subscription.restore.useMutation();
  const utils = trpc.useUtils();

  // Initialize RevenueCat on mount
  useEffect(() => {
    if (!isOpen) return;
    initRevenueCat();
  }, [isOpen]);

  async function initRevenueCat() {
    try {
      // Dynamic import so it doesn't break in browser/web context
      const { Purchases } = await import("@revenuecat/purchases-capacitor");
      const apiKey = import.meta.env.VITE_REVENUECAT_PUBLIC_KEY;

      if (!apiKey) {
        console.warn("[RevenueCat] No public key configured — showing mock pricing");
        setRcReady(false);
        return;
      }

      await Purchases.configure({ apiKey });
      setRcReady(true);

      const { current } = await Purchases.getOfferings();
      if (current) {
        setOfferings(current as unknown as RCOffering);
        // Default to first package (usually monthly)
        const firstPkg = (current as unknown as RCOffering).availablePackages[0];
        if (firstPkg) setSelectedPackage(firstPkg);
      }
    } catch (err) {
      console.warn("[RevenueCat] Init failed:", err);
      setRcReady(false);
    }
  }

  async function handlePurchase() {
    if (isPurchasing) return;
    setIsPurchasing(true);

    try {
      if (rcReady && selectedPackage) {
        // Native purchase via RevenueCat
        const { Purchases } = await import("@revenuecat/purchases-capacitor");
        const result = await Purchases.purchasePackage({ aPackage: selectedPackage as never });
        const customerInfo = (result as { customerInfo: { originalAppUserId: string; entitlements: { active: Record<string, unknown> } } }).customerInfo;

        if (customerInfo.entitlements.active['premium']) {
          await activateMutation.mutateAsync({
            rcCustomerId: customerInfo.originalAppUserId,
            productId: selectedPackage.product.identifier,
            platform: /android/i.test(navigator.userAgent) ? 'android' : 'ios',
          });
          await utils.subscription.status.invalidate();
          toast.success("Welcome to Triggerplate Premium! 🎉");
          onSuccess();
        }
      } else {
        // Web/dev mode — simulate purchase
        await activateMutation.mutateAsync({
          rcCustomerId: `web_user_${Date.now()}`,
          productId: "gutsync_premium_monthly",
          platform: "web",
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        });
        await utils.subscription.status.invalidate();
        toast.success("Welcome to Triggerplate Premium! 🎉");
        onSuccess();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("userCancelled") || msg.includes("1")) {
        // User cancelled — no toast needed
      } else {
        toast.error("Purchase failed. Please try again.");
        console.error("[Purchase]", err);
      }
    } finally {
      setIsPurchasing(false);
    }
  }

  async function handleRestore() {
    if (isRestoring) return;
    setIsRestoring(true);
    try {
      if (rcReady) {
        const { Purchases } = await import("@revenuecat/purchases-capacitor");
        const { customerInfo } = await Purchases.restorePurchases() as { customerInfo: { originalAppUserId: string } };
        const result = await restoreMutation.mutateAsync({ rcCustomerId: customerInfo.originalAppUserId });
        if (result.restored) {
          await utils.subscription.status.invalidate();
          toast.success("Premium restored successfully!");
          onSuccess();
        } else {
          toast.info("No previous purchases found.");
        }
      } else {
        toast.info("Restore is only available on iOS and Android.");
      }
    } catch {
      toast.error("Could not restore purchases. Please try again.");
    } finally {
      setIsRestoring(false);
    }
  }

  // Derive display pricing from RC offerings or use fallback
  const monthlyPkg = offerings?.availablePackages.find(p => p.packageType === "MONTHLY") ?? offerings?.availablePackages[0];
  const annualPkg = offerings?.availablePackages.find(p => p.packageType === "ANNUAL");

  const displayPrices = rcReady && offerings
    ? {
        monthly: monthlyPkg?.product.priceString ?? "$4.99/mo",
        annual: annualPkg?.product.priceString ?? "$39.99/yr",
        annualMonthly: annualPkg ? `$${(annualPkg.product.price / 12).toFixed(2)}/mo` : "$3.33/mo",
      }
    : {
        monthly: "$4.99/mo",
        annual: "$39.99/yr",
        annualMonthly: "$3.33/mo",
      };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="w-full max-w-lg bg-background rounded-t-3xl overflow-hidden shadow-2xl"
          >
            {/* Header */}
            <div className="relative px-6 pt-6 pb-4 text-center"
              style={{ background: "linear-gradient(135deg, oklch(0.55 0.1 155 / 0.12), oklch(0.7 0.12 25 / 0.08))" }}
            >
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-muted/60 flex items-center justify-center hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>

              <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Upgrade to Premium</h2>
              <p className="text-sm text-muted-foreground mt-1">
                You've used {scansUsed}/{dailyLimit} free scans today. Unlock unlimited access.
              </p>
            </div>

            <div className="px-6 pb-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Feature list */}
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

              {/* Pricing cards */}
              <div className="space-y-2.5">
                {/* Annual (best value) */}
                <button
                  onClick={() => setSelectedPackage(annualPkg ?? selectedPackage)}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition-all relative ${
                    selectedPackage?.packageType === "ANNUAL" || (!rcReady && selectedPackage === null)
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="absolute -top-2.5 left-4">
                    <span className="bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                      Best Value · Save 33%
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div>
                      <p className="font-semibold text-foreground">Annual Plan</p>
                      <p className="text-xs text-muted-foreground">{displayPrices.annualMonthly} billed annually</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{displayPrices.annual}</p>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ml-auto mt-1 ${
                        selectedPackage?.packageType === "ANNUAL" ? "border-primary bg-primary" : "border-muted-foreground"
                      }`}>
                        {selectedPackage?.packageType === "ANNUAL" && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Monthly */}
                <button
                  onClick={() => setSelectedPackage(monthlyPkg ?? selectedPackage)}
                  className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${
                    selectedPackage?.packageType === "MONTHLY" || (!rcReady && selectedPackage !== null)
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-foreground">Monthly Plan</p>
                      <p className="text-xs text-muted-foreground">Cancel anytime</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-foreground">{displayPrices.monthly}</p>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ml-auto mt-1 ${
                        selectedPackage?.packageType === "MONTHLY" ? "border-primary bg-primary" : "border-muted-foreground"
                      }`}>
                        {selectedPackage?.packageType === "MONTHLY" && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              {/* CTA */}
              <button
                onClick={handlePurchase}
                disabled={isPurchasing}
                className="w-full h-14 rounded-2xl bg-primary text-primary-foreground font-semibold text-base flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {isPurchasing ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Processing…</>
                ) : (
                  <><Sparkles className="w-5 h-5" /> Start Premium</>
                )}
              </button>

              {/* Restore & legal */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <button
                  onClick={handleRestore}
                  disabled={isRestoring}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                >
                  {isRestoring ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  Restore Purchases
                </button>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs text-muted-foreground">Subscription auto-renews. Cancel anytime.</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
