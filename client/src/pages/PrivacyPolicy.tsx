import LegalLayout, { SUPPORT_EMAIL, type LegalSection } from "@/legal/LegalLayout";

const sections: LegalSection[] = [
  { title: "Who we are", body: [
    "Triggerplate is operated by Vick Gankov in Washington State, USA. This policy explains what we collect, how we use it, who we share it with, and the choices you have. Health information is covered in more detail in our Consumer Health Data Privacy Policy.",
  ]},
  { title: "What we collect", body: [
    "Account details: your name, email address, and date of birth (used to confirm you are 18 or older and to fit messages and insights to your age), a password if you sign up with email (stored only as a hash), or the name and verified email Google shares if you choose Continue with Google. We never see your Google password.",
    "What you log: meal photos and descriptions, food logs, symptoms, supplements, medication or peptide dose logs, and, if you use the optional tracking features, body and fitness figures (such as weight, waist, strength lifts, protein and water) and blood work results. Much of this is sensitive health information. You choose what to log and can leave anything blank.",
    "Settings: reminder times, your dietary profile (foods you suspect), and a push address for each device you allow notifications on.",
    "Plan and usage: your plan (free, founding member, or paid), daily scan counts, and basic technical data needed to keep the service secure and working.",
  ]},
  { title: "How we use it", body: [
    "To analyze meals, save your logs, estimate food-symptom patterns, run reminders, enforce scan limits, send password-reset and account emails, process subscriptions, keep the service secure, and fix bugs. We do not sell your personal information and we do not use your health information for advertising.",
  ]},
  { title: "Meal photos and blood work", body: [
    "Photos are uploaded only when you choose to scan or save them. They are sent to our AI provider so foods can be identified and are stored so your meal history stays available.",
    "When you import a lab report, the photo or the text of the PDF is sent to our AI provider so values can be read. We do not keep the file itself. Only the results you review and confirm are saved to your account. You can delete any result in the app.",
  ]},
  { title: "Reminders", body: [
    "If you turn on reminders we store your reminder settings and a push address for each device you allow, and send notifications through your device's push service (such as Google or Apple). Notifications never include what you ate or any health detail. Turn reminders off in Profile at any time.",
  ]},
  { title: "Payments", body: [
    "Paid plans are processed by Stripe. Stripe collects and holds your card details; we do not store full card numbers and only receive your plan status and a customer reference.",
  ]},
  { title: "Who we share data with", body: [
    "We share data only with service providers that help us run Triggerplate, and only as needed: Render (hosting), TiDB Cloud (database), Cloudflare (photo storage), Google (AI analysis and, if you choose it, sign-in), Resend (email delivery), and Stripe (payments). They process it on our behalf to provide those services.",
    "We may disclose information if the law requires it or to protect people's safety or the service. If the business changes hands, your data may transfer to the new owner, who must honor this policy.",
  ]},
  { title: "Retention and deletion", body: [
    "We keep your data while your account is active. You can download a copy anytime in Profile (Export My Data), delete individual entries in the app, and delete your whole account in Profile (Delete Account). Deleting your account permanently removes your logs, photos, labs, settings, and account details right away. Backups kept by our hosting providers may take a short time to age out, and we may keep limited records we must retain for legal, tax, or fraud-prevention reasons. If you cannot use the app, email " + SUPPORT_EMAIL + " and we will delete your data within 45 days.",
  ]},
  { title: "Your choices and rights", body: [
    "You can access, correct, export, or delete your data, withdraw consent for optional processing such as reminders, and ask questions about this policy by contacting " + SUPPORT_EMAIL + ". Washington residents have additional rights over consumer health data, described in the Consumer Health Data Privacy Policy.",
  ]},
  { title: "Security", body: [
    "Data is encrypted in transit, and access to our systems is restricted. No service is perfectly secure, so please use a strong, unique password and tell us if you suspect a problem.",
  ]},
  { title: "Children", body: [
    "Triggerplate is for adults 18 and over. We do not knowingly collect information from anyone under 18. If a date of birth shows someone is under 18, we delete the account and keep nothing. If you believe a child has an account, contact us and we will delete it.",
  ]},
  { title: "Changes", body: [
    "If we change this policy in a meaningful way we will tell you in the app or by email before it takes effect. The date at the top shows the latest version.",
  ]},
  { title: "Contact", body: [`Privacy questions or requests: ${SUPPORT_EMAIL}.`] },
];

export default function PrivacyPolicy() {
  return <LegalLayout label="Privacy Policy" title="Triggerplate Privacy Policy" intro="This explains what Triggerplate collects, how it is used, and the choices you have." sections={sections} />;
}
