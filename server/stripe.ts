// Web payments. Stripe Checkout takes the payment; this file turns Stripe's subscription state into our plan state.
// Premium is granted only from Stripe-signed webhooks, never from anything the browser says.

import type { Express, Request, Response } from "express";
import express from "express";
import Stripe from "stripe";
import { ENV } from "./_core/env";
import { cancelSubscription, getSubscriptionByStripeCustomer, upsertSubscription } from "./db";

export type BillingInterval = "month" | "year";

export function billingConfigured(): boolean {
  return !!(ENV.stripeSecretKey && ENV.stripeWebhookSecret && ENV.stripePriceMonthly && ENV.stripePriceAnnual);
}

let client: Stripe | null = null;
export function stripe(): Stripe {
  if (!ENV.stripeSecretKey) throw new Error("Stripe is not configured");
  return (client ??= new Stripe(ENV.stripeSecretKey));
}

export function priceFor(interval: BillingInterval): string {
  return interval === "year" ? ENV.stripePriceAnnual : ENV.stripePriceMonthly;
}

type SubLike = {
  status: string;
  current_period_end?: number | null;
  items?: { data?: Array<{ current_period_end?: number | null }> };
};

/** Whether this Stripe subscription should give premium, and until when (ms). */
export function premiumWindow(sub: SubLike): { active: boolean; expiresAt: number | null } {
  const active = sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
  const end = sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end ?? null;
  return { active, expiresAt: end ? end * 1000 : null };
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? null);

/** Writes a Stripe subscription's state to our subscriptions row. Safe to run more than once. */
export async function applyStripeSubscription(sub: Stripe.Subscription): Promise<void> {
  const customerId = idOf(sub.customer);
  let userId = Number(sub.metadata?.userId) || 0;
  if (!userId && customerId) userId = (await getSubscriptionByStripeCustomer(customerId))?.userId ?? 0;
  if (!userId) { console.warn("[stripe] subscription without a known user:", sub.id); return; }

  const { active, expiresAt } = premiumWindow(sub as unknown as SubLike);
  if (!active) { await cancelSubscription(userId); return; }
  const price = sub.items?.data?.[0]?.price;
  await upsertSubscription({
    userId,
    tier: "premium",
    platform: "web",
    productId: price?.id ?? null,
    expiresAt: expiresAt ?? undefined,
    activatedAt: Date.now(),
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
  });
}

export function registerStripeRoutes(app: Express) {
  // Must be registered before express.json(): Stripe signs the raw body.
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req: Request, res: Response) => {
    if (!billingConfigured()) { res.status(503).end(); return; }
    let event: Stripe.Event;
    try {
      event = stripe().webhooks.constructEvent(req.body, req.headers["stripe-signature"] as string, ENV.stripeWebhookSecret);
    } catch {
      res.status(400).send("Bad signature");
      return;
    }
    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId = idOf(session.subscription as string | { id: string } | null);
        if (subId) await applyStripeSubscription(await stripe().subscriptions.retrieve(subId));
      } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
        await applyStripeSubscription(event.data.object as Stripe.Subscription);
      }
      res.json({ received: true });
    } catch (err) {
      console.error("[stripe] webhook handling failed:", err instanceof Error ? err.message : err);
      res.status(500).end(); // Stripe retries
    }
  });
}
