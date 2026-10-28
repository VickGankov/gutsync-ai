-- Web payments via Stripe: keep the customer and subscription ids next to the plan state.
ALTER TABLE `subscriptions` ADD COLUMN `stripeCustomerId` varchar(64);
ALTER TABLE `subscriptions` ADD COLUMN `stripeSubscriptionId` varchar(64);
CREATE INDEX `subscriptions_stripeCustomerId_idx` ON `subscriptions` (`stripeCustomerId`);
