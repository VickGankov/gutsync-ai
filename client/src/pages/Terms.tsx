import LegalLayout, { SUPPORT_EMAIL, type LegalSection } from "@/legal/LegalLayout";

const sections: LegalSection[] = [
  { title: "1. About these terms", body: [
    "These terms are an agreement between you and Triggerplate, operated by Vick Gankov in Washington State, USA (\"we\", \"us\"). By creating an account or using Triggerplate you agree to them and to our Privacy Policy.",
    "Triggerplate is intended for adults in the United States. You must be at least 18 to use it, and you confirm this with your date of birth when you sign up.",
  ]},
  { title: "2. What Triggerplate is", body: [
    "Triggerplate is a personal log and pattern finder for food, symptoms, and related health information you choose to record. It does not diagnose, treat, or prevent any condition and is not medical advice. Please read the Medical Disclaimer, which is part of these terms.",
    "Food analysis, FODMAP ratings, protein and fiber figures, and pattern insights are estimates produced with the help of AI and public food data. They can be wrong. Use your own judgment and talk to a qualified clinician before making decisions about your health or diet.",
  ]},
  { title: "3. Your account", body: [
    "Give accurate information and keep your sign-in details private. You are responsible for activity on your account. If you use Continue with Google, your Google account's security applies too. Tell us promptly if you think someone else has accessed your account.",
  ]},
  { title: "4. Your content", body: [
    "You keep ownership of what you add: meal photos, logs, symptoms, lab results, and notes. You give us permission to store, process, and display it as needed to run the service for you, including sending it to the providers listed in the Privacy Policy so photos and reports can be analyzed.",
    "Only upload things you have the right to use. Do not upload other people's health information without their permission.",
  ]},
  { title: "5. Plans", body: [
    "Free: a free plan with core logging and a daily limit on AI scans. We may adjust free-plan limits as the service develops, and we will give notice before any material reduction.",
    "Founding member: a limited group of early testers who redeemed an invite code get all features and a higher daily scan limit for as long as Triggerplate offers those features and their account is in good standing. Founding access has no cash value, cannot be transferred, and may be ended if it is abused or if the account is unused for 12 months.",
    "Premium: a paid plan that adds lab results, the reintroduction protocol, and a higher daily scan limit. Features and limits for each plan are described in the app and may change; if we change a paid plan in a way that materially reduces what you pay for, we will tell you first.",
  ]},
  { title: "6. Paid plans, billing, and cancellation", body: [
    "Premium is a subscription that renews automatically each billing period (currently monthly) until you cancel. The price and period shown at checkout apply to your purchase. Payments are processed by Stripe; we do not store full card numbers. Prices exclude any taxes that apply.",
    "You can cancel at any time from your account's billing page. Cancellation stops the next renewal, and you keep Premium until the end of the period you already paid for. If we raise the price, we will notify you at least 30 days before it takes effect, and you can cancel before then.",
    "See Refunds & Cancellation for how refunds work.",
  ]},
  { title: "7. Acceptable use", body: [
    "Do not misuse Triggerplate: no attempting to break or overload it, scrape it, reverse-engineer it, bypass scan limits or paywalls, share a paid account, or use it to harm others or break the law. We may limit or suspend accounts that do.",
  ]},
  { title: "8. Availability and changes", body: [
    "We work to keep Triggerplate running but do not promise it will always be available or error-free. We may change, add, or remove features. You can export your data from Profile at any time, and you can stop using the service whenever you like.",
  ]},
  { title: "9. Ending your account", body: [
    "You may stop using Triggerplate at any time. We may suspend or end accounts that break these terms or put the service or others at risk. You can delete your account and data yourself in Profile (Delete Account); if you cannot, contact us at " + SUPPORT_EMAIL + ". Cancel any paid plan first so you are not billed again.",
  ]},
  { title: "10. Disclaimers and limits of liability", body: [
    "Triggerplate is provided \"as is\" and \"as available\". To the fullest extent the law allows, we do not make warranties of any kind, including about accuracy of food or health information, and we are not liable for indirect, incidental, special, or consequential damages, or for decisions you make based on the app. Our total liability for any claim is limited to the amount you paid us in the 12 months before the claim, or $50 if you paid nothing.",
    "Some places do not allow certain limits, so parts of this section may not apply to you. Nothing here limits rights you cannot waive by law.",
  ]},
  { title: "11. Governing law", body: [
    "These terms are governed by the laws of the State of Washington, USA, without regard to conflict-of-law rules. Disputes will be handled in the state or federal courts located in King County, Washington, unless the law gives you the right to bring them elsewhere.",
  ]},
  { title: "12. Changes to these terms", body: [
    "We may update these terms. If a change is material we will tell you in the app or by email before it takes effect. Continuing to use Triggerplate after that means you accept the updated terms.",
  ]},
  { title: "13. Contact", body: [`Questions about these terms: ${SUPPORT_EMAIL}.`] },
];

export default function Terms() {
  return <LegalLayout label="Terms of Service" title="Triggerplate Terms of Service" intro="Please read these before using Triggerplate." sections={sections} />;
}
