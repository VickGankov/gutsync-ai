import LegalLayout, { SUPPORT_EMAIL, type LegalSection } from "@/legal/LegalLayout";

const sections: LegalSection[] = [
  { title: "Not medical advice", body: [
    "Triggerplate is a personal log and pattern finder. It does not diagnose, treat, cure, or prevent any condition, and it does not replace a doctor, dietitian, or other qualified professional. Nothing in the app is medical advice.",
  ]},
  { title: "Estimates can be wrong", body: [
    "Meal analysis, FODMAP and ingredient flags, protein and fiber figures, and food-symptom patterns are estimates built from AI and food data. Photos can be misread, products change, and a pattern in your logs is a hint, not proof that a food causes a symptom. Check labels yourself, especially if you have an allergy or celiac disease.",
  ]},
  { title: "Before you change your diet", body: [
    "Elimination and reintroduction diets can affect nutrition and are best done with a clinician, particularly if you have inflammatory bowel disease, celiac disease, diabetes, a history of disordered eating, are pregnant or nursing, take medication, or are under 18. The reintroduction protocol in Triggerplate is a tracking tool, not a treatment plan.",
  ]},
  { title: "Lab results, supplements, and doses", body: [
    "Lab results, supplement logs, and medication or peptide dose logs are records you enter or import for your own reference. Triggerplate does not interpret them as a diagnosis and does not recommend doses. Discuss results and any supplement or medication decisions with your clinician.",
  ]},
  { title: "When to get care", body: [
    "Seek medical care promptly for blood in your stool, black or tarry stools, unexplained weight loss, severe or worsening pain, fever, persistent vomiting, trouble swallowing, or symptoms that wake you at night. Do not wait for a pattern to appear in the app. In an emergency, call 911.",
  ]},
  { title: "Contact", body: [`Questions: ${SUPPORT_EMAIL}.`] },
];

export default function Disclaimer() {
  return <LegalLayout label="Medical Disclaimer" title="Medical Disclaimer" intro="What Triggerplate is and is not." sections={sections} />;
}
