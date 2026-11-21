// Plan, billing and the scan counter. The counter lists every scan that was counted today, so the
// number can be checked against what the person actually did.

import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, CalendarClock, CreditCard, ScanLine, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import Paywall from "@/components/Paywall";
import { trpc } from "@/lib/trpc";
import { PRICES, SCAN_LIMITS } from "@shared/plans";
import { TONE, tint } from "@/lib/tones";

const KIND: Record<string, string> = { photo: "Meal photo", text: "Typed meal", label: "Ingredient label", lab: "Lab report" };
const dateLong = (ms: number) => new Date(ms).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
const timeOf = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const dayShort = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" });

function untilText(ms: number) {
  const mins = Math.max(0, Math.round((ms - Date.now()) / 60_000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const PLAN_LABEL = { free: "Free", tester: "Tester", founder: "Founding member", premium: "Premium" } as const;

export default function Billing() {
  const status = trpc.subscription.status.useQuery(undefined, { retry: false });
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  useEffect(() => { const t = setInterval(() => force(n => n + 1), 60_000); return () => clearInterval(t); }, []);
  const portal = trpc.subscription.portal.useMutation({
    onSuccess: ({ url }) => { window.location.href = url; },
    onError: e => toast.error(e.message),
  });
  const d = status.data;

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground mb-4"><ArrowLeft className="w-4 h-4" />Profile</Link>
      <h1 className="text-2xl tracking-tight mb-1">Plan & billing</h1>
      <p className="text-sm text-muted-foreground mb-5">Your plan, what it costs, and how many scans you've used today.</p>

      {!d ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (<>
        {/* Plan */}
        <section className="tc tc-volt border rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Your plan</h2>
          </div>
          <p className="font-display text-3xl leading-none">{PLAN_LABEL[d.plan]}</p>

          {d.plan === "premium" && d.platform === "web" && (
            <>
              <p className="text-sm mt-2">
                {d.billingInterval === "year" ? `$${PRICES.year} a year` : d.billingInterval === "month" ? `$${PRICES.month} a month` : "Billed through Stripe"}
              </p>
              {d.expiresAt && (
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                  <CalendarClock className="w-4 h-4 shrink-0" />
                  {d.cancelAtPeriodEnd ? <>Cancelled. You keep Premium until <b className="text-foreground">{dateLong(d.expiresAt)}</b>, then it moves to Free.</> : <>Renews on <b className="text-foreground">{dateLong(d.expiresAt)}</b>. Cancel any time before then.</>}
                </p>
              )}
              {d.activatedAt && <p className="text-[11px] text-muted-foreground mt-1">Premium since {dateLong(d.activatedAt)}</p>}
            </>
          )}
          {d.plan === "premium" && d.platform !== "web" && <p className="text-sm text-muted-foreground mt-2">Billed through your app store. Manage it there.</p>}
          {(d.plan === "founder" || d.plan === "tester") && <p className="text-sm text-muted-foreground mt-2">Granted with an invite code. There is nothing to pay.</p>}
          {d.plan === "free" && <p className="text-sm text-muted-foreground mt-2">Free, no card on file.</p>}

          <div className="flex gap-2 mt-4">
            {d.canManageBilling && (
              <Button size="sm" variant="outline" onClick={() => portal.mutate()} disabled={portal.isPending}>
                <CreditCard className="w-4 h-4" />Manage billing
              </Button>
            )}
            {d.plan === "free" && d.billingEnabled && <Button size="sm" onClick={() => setOpen(true)}>Upgrade · from ${PRICES.month}/mo</Button>}
          </div>
          {d.canManageBilling && <p className="text-[11px] text-muted-foreground mt-2">Billing is handled by Stripe: update your card, download receipts or cancel there.</p>}
        </section>

        {/* Scan counter */}
        <section className="tc tc-volt border rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ScanLine className="w-4 h-4" style={{ color: TONE.meals.ink }} />
            <h2 className="text-sm font-semibold">Scans today</h2>
          </div>

          {d.dailyLimit === null ? (
            <p className="text-sm">No daily limit on your plan. {d.todayScans} scans today.</p>
          ) : (<>
            <div className="flex items-end justify-between">
              <p className="font-display text-4xl leading-none">{d.todayScans}<span className="text-lg font-sans text-muted-foreground"> / {d.dailyLimit}</span></p>
              <p className="text-xs text-muted-foreground text-right">Resets at midnight<br />in {untilText(d.scansResetAt)}</p>
            </div>
            <div className="h-2.5 rounded-full bg-muted mt-3 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, (d.todayScans / d.dailyLimit) * 100)}%`, background: d.todayScans >= d.dailyLimit ? TONE.symptoms.ink : TONE.meals.ink }} />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {d.scansRemaining === 0 ? "You've used them all. Logging by hand still works, and nothing else is locked." : `${d.scansRemaining} left today.`}
            </p>
          </>)}

          {/* Last 7 days */}
          <div className="mt-4">
            <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground mb-1.5">Last 7 days</p>
            <div className="flex items-end gap-1.5 h-14">
              {d.scanHistory.map(h => {
                const max = Math.max(d.dailyLimit ?? 1, ...d.scanHistory.map(x => x.count), 1);
                return (
                  <div key={h.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full rounded-t" title={`${h.count} scans`} style={{ height: `${Math.max(3, (h.count / max) * 40)}px`, background: h.count ? tint(TONE.meals.ink, 70) : "oklch(0.92 0.008 80)" }} />
                    <span className="text-[9px] text-muted-foreground">{dayShort(h.date)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* What was counted */}
          <div className="mt-4 border-t border-border/60 pt-3">
            <p className="text-[10px] uppercase tracking-wide font-medium text-muted-foreground mb-1.5">Counted today</p>
            {d.scanEventsToday.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="space-y-1">
                {d.scanEventsToday.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="flex justify-between text-xs"><span>{KIND[e.kind] ?? e.kind}</span><span className="text-muted-foreground">{timeOf(e.at)}</span></li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            A scan counts when the AI reads a meal photo, a typed meal, an ingredient label or a lab report and gives you a result. If it fails, it isn't counted. Adding foods by hand, and everything else in the app, never uses a scan.
          </p>
        </section>

        {/* Plans */}
        <section className="tc tc-volt border rounded-2xl p-4 mb-4">
          <h2 className="text-sm font-semibold mb-2">What each plan includes</h2>
          <table className="w-full text-xs">
            <thead><tr className="text-muted-foreground text-left"><th className="font-medium py-1" /><th className="font-medium py-1">Free</th><th className="font-medium py-1">Premium</th></tr></thead>
            <tbody className="divide-y divide-border/50">
              <tr><td className="py-1.5">Scans a day</td><td>{SCAN_LIMITS.free}</td><td>{SCAN_LIMITS.premium}</td></tr>
              <tr><td className="py-1.5">Meal and symptom log, trigger finder</td><td>Yes</td><td>Yes</td></tr>
              <tr><td className="py-1.5">Doctor report (PDF)</td><td>Yes</td><td>Yes</td></tr>
              <tr><td className="py-1.5">3-day reintroduction tests</td><td>{d.paywallEnabled ? "First one free" : "Yes"}</td><td>Yes</td></tr>
              <tr><td className="py-1.5">Lab results</td><td>{d.paywallEnabled ? "No" : "Yes"}</td><td>Yes</td></tr>
              <tr><td className="py-1.5">Price</td><td>$0</td><td>${PRICES.month}/mo or ${PRICES.year}/yr</td></tr>
            </tbody>
          </table>
        </section>

        <p className="text-xs text-muted-foreground">
          <Link href="/refunds" className="underline">Refunds</Link> · <Link href="/terms" className="underline">Terms</Link>
        </p>
        <Paywall isOpen={open} onClose={() => setOpen(false)} scansUsed={d.todayScans} dailyLimit={d.dailyLimit ?? undefined} />
      </>)}
    </div>
  );
}
