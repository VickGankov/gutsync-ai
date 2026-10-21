import LegalLayout, { SUPPORT_EMAIL, type LegalSection } from "@/legal/LegalLayout";

const sections: LegalSection[] = [
  { title: "Cancel any time", body: [
    "You can cancel Premium whenever you like from your account's billing page. Cancelling stops the next renewal. You keep Premium until the end of the period you have already paid for, and then your account returns to the free plan. Your data stays in your account.",
  ]},
  { title: "Refunds", body: [
    `First payment: if you are not happy, email ${SUPPORT_EMAIL} within 7 days of your first charge and we will refund it in full.`,
    "Renewals and partial periods: we do not refund the unused part of a billing period after the 7-day window, but you will not be charged again once you cancel.",
    "Mistakes: if you were charged twice, charged after cancelling, or charged in error, tell us and we will correct it and refund the charge.",
  ]},
  { title: "How refunds are paid", body: [
    "Refunds go back to the original payment method through Stripe. Your bank may take several business days to show it.",
  ]},
  { title: "Founding members", body: [
    "Founding access is free, so there is nothing to refund. If you later choose a paid plan, the rules above apply to that payment.",
  ]},
  { title: "Contact", body: [`Billing questions or refund requests: ${SUPPORT_EMAIL}.`] },
];

export default function Refunds() {
  return <LegalLayout label="Refunds" title="Refunds & Cancellation" intro="How cancelling and refunds work for paid plans." sections={sections} />;
}
