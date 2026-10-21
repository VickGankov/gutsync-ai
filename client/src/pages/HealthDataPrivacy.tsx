import LegalLayout, { SUPPORT_EMAIL, type LegalSection } from "@/legal/LegalLayout";

// Consumer health data notice for Washington's My Health My Data Act and similar laws.
const sections: LegalSection[] = [
  { title: "Who this covers", body: [
    "This policy applies to consumer health data that Triggerplate collects, and it is meant for Washington residents and anyone else whose state law gives similar rights. It adds to the main Privacy Policy.",
  ]},
  { title: "Health data we collect", body: [
    "Only what you choose to enter or import: meals and foods, symptoms and their severity, dietary sensitivities you suspect, supplements and medication or peptide dose logs, body and fitness measurements, and blood work results. We also hold related settings such as reminder times.",
  ]},
  { title: "Where it comes from", body: [
    "Directly from you. Lab values can also come from a report you choose to upload, which is read by an AI provider on our behalf.",
  ]},
  { title: "Why we collect and use it", body: [
    "Only to provide the service you asked for: saving your logs, analyzing meals, finding patterns, running reminders, and showing your results back to you. We do not use it for advertising or sell it.",
  ]},
  { title: "Who we share it with", body: [
    "Service providers that process it for us so the app works: Render (hosting), TiDB Cloud (database), Cloudflare (photo storage), and Google (AI analysis). Payment and email providers do not receive your health data. We do not sell consumer health data and we do not share it with third parties for their own purposes.",
  ]},
  { title: "Your rights", body: [
    "You can confirm whether we are collecting your consumer health data and get access to it, including a list of who it is shared with. You can withdraw consent to our collection or use, ask us to delete your data, and appeal a decision about a request.",
    `Most of this you can do in the app: export your data, delete entries, or delete your whole account in Profile. For anything else, email ${SUPPORT_EMAIL}. We respond within 45 days. If you disagree with our answer, reply and ask for an appeal; we will review it and reply within 45 days.`,
  ]},
  { title: "Consent", body: [
    "We collect this data only because you enter it, and share it only as described here to run the service. You can withdraw consent at any time by stopping use, deleting your data, or contacting us.",
  ]},
  { title: "Contact", body: [`Consumer health data requests: ${SUPPORT_EMAIL}.`] },
];

export default function HealthDataPrivacy() {
  return <LegalLayout label="Consumer Health Data" title="Consumer Health Data Privacy Policy" intro="How we handle the health information you put into Triggerplate." sections={sections} />;
}
