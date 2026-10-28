import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./db", () => ({
  upsertSubscription: vi.fn().mockResolvedValue(undefined),
  cancelSubscription: vi.fn().mockResolvedValue(undefined),
  getSubscriptionByStripeCustomer: vi.fn().mockResolvedValue(null),
}));

import * as db from "./db";
import { premiumWindow, applyStripeSubscription } from "./stripe";

const sub = (over: any = {}) => ({
  id: "sub_1", status: "active", customer: "cus_1", metadata: { userId: "7" },
  items: { data: [{ current_period_end: 1_900_000_000, price: { id: "price_x" } }] },
  ...over,
}) as any;

beforeEach(() => vi.clearAllMocks());

describe("premiumWindow", () => {
  it("is active for active, trialing and past_due, not for cancelled states", () => {
    for (const status of ["active", "trialing", "past_due"]) expect(premiumWindow(sub({ status }) as any).active).toBe(true);
    for (const status of ["canceled", "unpaid", "incomplete", "incomplete_expired", "paused"]) expect(premiumWindow(sub({ status }) as any).active).toBe(false);
  });
  it("reads the period end from the item or the subscription, in ms", () => {
    expect(premiumWindow(sub() as any).expiresAt).toBe(1_900_000_000_000);
    expect(premiumWindow({ status: "active", current_period_end: 5 } as any).expiresAt).toBe(5000);
  });
});

describe("applyStripeSubscription", () => {
  it("grants premium until the period end", async () => {
    await applyStripeSubscription(sub());
    expect(db.upsertSubscription).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7, tier: "premium", platform: "web", expiresAt: 1_900_000_000_000, stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1",
    }));
  });
  it("drops back to free when the subscription ends", async () => {
    await applyStripeSubscription(sub({ status: "canceled" }));
    expect(db.cancelSubscription).toHaveBeenCalledWith(7);
    expect(db.upsertSubscription).not.toHaveBeenCalled();
  });
  it("finds the user by Stripe customer when metadata is missing", async () => {
    vi.mocked(db.getSubscriptionByStripeCustomer).mockResolvedValueOnce({ userId: 9 } as any);
    await applyStripeSubscription(sub({ metadata: {} }));
    expect(db.upsertSubscription).toHaveBeenCalledWith(expect.objectContaining({ userId: 9 }));
  });
  it("does nothing for an unknown user", async () => {
    await applyStripeSubscription(sub({ metadata: {} }));
    expect(db.upsertSubscription).not.toHaveBeenCalled();
    expect(db.cancelSubscription).not.toHaveBeenCalled();
  });
});
