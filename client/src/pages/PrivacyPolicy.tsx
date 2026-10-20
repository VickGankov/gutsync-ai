import { Bell, Brain, Camera, CreditCard, Database, FlaskConical, Mail, Shield } from "lucide-react";

const updatedAt = "October 20, 2026";

const sections = [
  {
    icon: Database,
    title: "Information We Collect",
    body: "GutSync collects the account details you provide (or, if you choose Continue with Google, the name and verified email address Google shares with us; we never see your Google password), meal photos you choose to upload, food logs, symptom entries, generated insights, subscription status, and basic technical data needed to keep the app secure and working. If you use the optional tracking features, it also stores the body and health information you enter, such as weight, waist, strength lifts, protein and water intake, supplements, medication or peptide dose logs, and blood work results. This is sensitive health information; you choose what to log, and you can leave any of it blank.",
  },
  {
    icon: Brain,
    title: "How We Use Information",
    body: "We use your data to analyze meals, save your logs, estimate food-symptom patterns, enforce scan limits, process password resets, manage subscriptions, and improve reliability. GutSync is not a medical device and does not provide medical diagnosis or treatment.",
  },
  {
    icon: Camera,
    title: "Meal Photos",
    body: "Meal photos are uploaded only when you choose to scan or save them. They may be processed by AI and storage providers so the app can identify foods and preserve your meal history.",
  },
  {
    icon: FlaskConical,
    title: "Blood Work",
    body: "Blood work you add by hand or import is stored in your account and shown only to you in the app. When you import a report, the photo or the text of the PDF is sent to our AI provider so the values can be read, and GutSync does not keep the file. Only the results you review and confirm are saved. You can delete any result in the app at any time. This is sensitive health information; you choose what to add.",
  },
  {
    icon: Bell,
    title: "Reminders",
    body: "If you turn on reminders, GutSync stores your reminder settings and a push address for each device you allow, and sends notifications through your device's push service (such as Google or Apple). Notifications never include what you ate or any health detail. You can turn reminders off in Profile at any time. You can also download a copy of everything you have logged from Profile (Export My Data).",
  },
  {
    icon: CreditCard,
    title: "Payments",
    body: "Purchases and subscription status are handled through RevenueCat and the applicable app store. GutSync does not store full payment card numbers.",
  },
  {
    icon: Shield,
    title: "Sharing and Retention",
    body: "We do not sell your personal health information. We share data with service providers only as needed to operate the app, including hosting, database, storage, AI analysis, email delivery, and subscription verification. We retain data while your account is active or as needed for legal and operational reasons.",
  },
  {
    icon: Mail,
    title: "Your Choices",
    body: "You can choose what meals and symptoms to log. To request access, correction, export, or deletion of your data, contact support through the app store listing or the support channel provided for GutSync.",
  },
];

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <a href="/profile" className="text-sm font-medium text-primary">
          Back to Profile
        </a>

        <section className="mt-6 rounded-3xl border border-border/60 bg-card p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Privacy Policy</p>
          <h1 className="mt-3 text-3xl tracking-tight">GutSync Privacy Policy</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Last updated: {updatedAt}. This policy explains what GutSync collects, how it is used, and the choices you
            have when using the app.
          </p>
        </section>

        <div className="mt-5 space-y-4">
          {sections.map(({ icon: Icon, title, body }) => (
            <section key={title} className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <h2 className="text-base font-semibold">{title}</h2>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
