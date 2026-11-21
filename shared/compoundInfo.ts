// Short, hand-written reference notes for the compounds people log, plus blend handling.
// Static on purpose: never generated at runtime, never sent to the AI, shown only inside the signed-in app.
// It describes what has been studied and what people commonly report. It gives no dosing and makes no promises.
// Every entry needs a source and a review date; re-check status and wording before changing anything here.

export type EvidenceLevel = "approved" | "late-trials" | "early-trials" | "animal-only";

export const EVIDENCE_LABEL: Record<EvidenceLevel, string> = {
  approved: "Approved for a specific use",
  "late-trials": "Late-stage trials, not yet approved",
  "early-trials": "Early human studies only",
  "animal-only": "Animal studies, little human data",
};

export interface CompoundInfo {
  key: string;            // normalised name, see infoKey()
  name: string;
  evidence: EvidenceLevel;
  status: string;         // one plain sentence on regulatory / evidence status
  studied: string[];      // what it has been studied for (not a promise)
  reported: string[];     // effects commonly reported in studies or by users
  seekCare: string[];     // things to take to a doctor
  track: string[];        // symptom types worth logging (keys of the symptoms enum)
  source: string;
  reviewed: string;       // yyyy-mm
}

export const COMPOUND_INFO: CompoundInfo[] = [
  {
    key: "retatrutide", name: "Retatrutide", evidence: "late-trials",
    status: "Investigational triple agonist (GIP, GLP-1, glucagon). Phase 3 results are positive and the maker plans an FDA filing in early 2027.",
    studied: ["Weight loss in obesity", "Blood sugar in type 2 diabetes", "Knee osteoarthritis pain and sleep apnea"],
    reported: ["Nausea", "Diarrhea", "Constipation", "Vomiting", "Lower appetite", "Injection site reactions", "Faster heart rate"],
    seekCare: ["Severe or lasting vomiting or belly pain", "Signs of dehydration", "Chest pain or a heart rate that stays high"],
    track: ["less_food_noise", "fewer_cravings", "low_appetite", "nausea", "diarrhea", "constipation", "racing_heart", "injection_site_reaction"],
    source: "Eli Lilly TRIUMPH-2/3 announcement, Jul 2026; Jastreboff et al., NEJM 2023",
    reviewed: "2026-11",
  },
  {
    key: "bpc157", name: "BPC-157", evidence: "animal-only",
    status: "Studied mostly in animals. Very little human safety data. Not approved anywhere, and banned in competitive sport.",
    studied: ["Tendon, muscle and gut healing in animal models"],
    reported: ["Often little is noticed", "Injection site irritation", "Nausea or dizziness (user reports)"],
    seekCare: ["Spreading redness, swelling or warmth at an injection site", "Allergic-type reactions"],
    track: ["better_recovery", "joint_pain", "better_digestion", "injection_site_reaction", "nausea", "dizziness"],
    source: "Sikiric et al., animal literature; WADA prohibited list",
    reviewed: "2026-11",
  },
  {
    key: "tb500", name: "TB-500", evidence: "animal-only",
    status: "A lab-made fragment of thymosin beta-4. Animal data only, with no completed human trials of this fragment. Not approved, and banned in competitive sport.",
    studied: ["Wound and tissue repair in animal models"],
    reported: ["Injection site irritation", "Tiredness or head rush (user reports)"],
    seekCare: ["Spreading redness or swelling at an injection site", "Allergic-type reactions"],
    track: ["better_recovery", "joint_pain", "fatigue", "headache", "injection_site_reaction"],
    source: "Thymosin beta-4 literature; WADA prohibited list",
    reviewed: "2026-11",
  },
  {
    key: "ipamorelin", name: "Ipamorelin", evidence: "early-trials",
    status: "A growth hormone secretagogue. Human studies were small and development for its original use stopped. Not approved.",
    studied: ["Growth hormone release", "Recovery of gut movement after surgery (not completed)"],
    reported: ["Headache", "Flushing", "Dizziness", "Water retention", "Increased hunger", "Injection site reactions"],
    seekCare: ["Numbness or tingling in the hands", "Swelling that keeps building", "Persistent high blood sugar symptoms such as thirst and frequent urination"],
    track: ["better_sleep", "better_recovery", "energy_boost", "headache", "flushing", "water_retention", "dizziness", "injection_site_reaction"],
    source: "Raun et al., Eur J Endocrinol 1998; Beck et al., 2014 (postoperative ileus)",
    reviewed: "2026-11",
  },
  {
    key: "cjc1295", name: "CJC-1295", evidence: "early-trials",
    status: "A growth hormone releasing hormone analog. Early human studies only. Not approved. 'With DAC' and 'no DAC' versions behave differently.",
    studied: ["Raising growth hormone and IGF-1 levels"],
    reported: ["Flushing", "Injection site reactions", "Headache", "Water retention", "Tingling"],
    seekCare: ["Swelling that keeps building", "Numbness or tingling in the hands", "Allergic-type reactions"],
    track: ["better_sleep", "better_recovery", "energy_boost", "flushing", "headache", "water_retention", "injection_site_reaction"],
    source: "Teichman et al., J Clin Endocrinol Metab 2006",
    reviewed: "2026-11",
  },
  {
    key: "ghkcu", name: "GHK-Cu", evidence: "early-trials",
    status: "A copper peptide. Most human data is for skin and hair products used on the surface. Evidence for injecting it is thin. Not approved as an injection.",
    studied: ["Skin appearance and wound healing (topical)", "Hair"],
    reported: ["Injection site irritation", "Skin reactions"],
    seekCare: ["Allergic-type reactions", "Spreading redness or swelling at an injection site"],
    track: ["clearer_skin", "better_recovery", "injection_site_reaction"],
    source: "Pickart & Margolina, Int J Mol Sci 2018 (review)",
    reviewed: "2026-11",
  },
  {
    key: "motsc", name: "MOTS-c", evidence: "animal-only",
    status: "A peptide made by mitochondria. Mostly animal and cell studies, with a few early human studies. Not approved.",
    studied: ["Metabolism and insulin sensitivity", "Exercise capacity"],
    reported: ["Little is known", "Injection site irritation"],
    seekCare: ["Allergic-type reactions", "Spreading redness or swelling at an injection site"],
    track: ["energy_boost", "better_recovery", "fatigue", "injection_site_reaction"],
    source: "Lee et al., Cell Metab 2015; early human data are limited",
    reviewed: "2026-11",
  },
  {
    key: "tesamorelin", name: "Tesamorelin", evidence: "approved",
    status: "FDA-approved (Egrifta) to reduce extra belly fat in adults with HIV-related lipodystrophy. Any other use is off-label.",
    studied: ["Visceral belly fat in HIV lipodystrophy", "Growth hormone and IGF-1 levels"],
    reported: ["Injection site reactions", "Joint pain", "Muscle aches", "Swelling in the limbs", "Headache", "Higher blood sugar"],
    seekCare: ["Signs of high blood sugar: thirst, frequent urination", "Swelling that keeps building", "Allergic-type reactions"],
    track: ["better_recovery", "joint_pain", "water_retention", "headache", "injection_site_reaction"],
    source: "Egrifta prescribing information (FDA)",
    reviewed: "2026-11",
  },
];

/** "CJC-1295 (no DAC)" and "cjc 1295" both become "cjc1295". */
export const infoKey = (name: string) => name.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");

/** A blend is stored as one name with parts joined by " / ", e.g. "CJC-1295 / Ipamorelin". */
export const BLEND_SEP = " / ";
export const splitBlend = (name: string): string[] =>
  name.split(/\s*(?:\/|\+|&|\bwith\b)\s*/i).map(s => s.trim()).filter(Boolean);
export const joinBlend = (parts: string[]) => parts.join(BLEND_SEP);

export interface InfoFor { parts: string[]; known: CompoundInfo[]; unknown: string[] }

/** Notes for each part of a (possibly blended) compound name. Unknown parts are listed, never guessed. */
export function infoFor(name: string): InfoFor {
  const parts = splitBlend(name);
  const known: CompoundInfo[] = [];
  const unknown: string[] = [];
  for (const p of parts) {
    const k = infoKey(p);
    const hit = k ? COMPOUND_INFO.find(i => k === i.key || k.startsWith(i.key)) : undefined;
    if (hit) { if (!known.includes(hit)) known.push(hit); } else unknown.push(p);
  }
  return { parts, known, unknown };
}

/** Symptom types worth tracking across all parts, without repeats. */
export const trackFor = (known: CompoundInfo[]): string[] => Array.from(new Set(known.flatMap(i => i.track)));
