// Short, hand-written reference notes for the compounds people log, plus blend handling.
// Static on purpose: never generated at runtime, never sent to the AI, shown only inside the signed-in app.
// Benefits and side effects here are mostly what users report, plus mechanisms proposed from animal or early
// studies. They are not proven effects. No dosing, no timing or injection instructions, no promises.
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
  aliases?: string[];     // other names that mean the same thing (normalised)
  evidence: EvidenceLevel;
  status: string;         // plain statement of regulatory / evidence status
  benefits: string[];     // reported by users, or proposed from early studies
  sideEffects: string[];  // reported by users or in studies
  debated?: string[];     // open safety questions, stated as open
  seekCare: string[];     // things to take to a doctor
  track: string[];        // symptom types worth logging (keys of the symptoms enum)
  source: string;
  reviewed: string;       // yyyy-mm
}

/** Notes for a specific combination, shown above the notes for each part. */
export interface BlendInfo {
  keys: string[];         // component keys, any order
  name: string;
  benefits: string[];
  sideEffects: string[];
  debated?: string[];
  track: string[];
  source: string;
  reviewed: string;
}

export const COMPOUND_INFO: CompoundInfo[] = [
  {
    key: "retatrutide", name: "Retatrutide", evidence: "late-trials",
    status: "Investigational triple agonist (GIP, GLP-1, glucagon). Phase 3 results are positive and the maker plans an FDA filing in early 2027.",
    benefits: ["Strong appetite suppression, often described as quieter 'food noise'", "Rapid early weight loss", "Muscle may be easier to keep with high protein and resistance training (user reports)"],
    sideEffects: ["Nausea", "Cramping, with diarrhea and constipation alternating", "Fatigue", "Higher resting heart rate", "Skin hypersensitivity (allodynia) that feels like sunburn or a deep cold ache, reported by some users at higher doses"],
    seekCare: ["Severe or lasting vomiting or belly pain", "Signs of dehydration", "Chest pain or a heart rate that stays high"],
    track: ["less_food_noise", "fewer_cravings", "low_appetite", "nausea", "diarrhea", "constipation", "fatigue", "racing_heart", "skin_sensitivity", "injection_site_reaction"],
    source: "Eli Lilly TRIUMPH-2/3 announcement, Jul 2026; Jastreboff et al., NEJM 2023; user reports",
    reviewed: "2026-11",
  },
  {
    key: "bpc157", name: "BPC-157", evidence: "animal-only",
    status: "Studied mostly in animals. Very little human safety data. Not approved anywhere, and banned in competitive sport.",
    benefits: ["Users report less pain and better range of motion in chronic tendon, joint and shoulder injuries", "Proposed to grow new blood vessels (angiogenesis) in poorly supplied tendons and ligaments, from animal studies"],
    sideEffects: ["Generally reported as well tolerated", "Injection site irritation", "Nausea or dizziness (rare user reports)"],
    debated: ["Because it may stimulate blood vessel growth, some people worry it could feed an undiagnosed tumor. Evidence is conflicting and there is no human data to settle it."],
    seekCare: ["Any history of cancer or an unexplained lump, before using", "Spreading redness, swelling or warmth at an injection site", "Allergic-type reactions"],
    track: ["better_recovery", "joint_pain", "better_digestion", "injection_site_reaction", "nausea", "dizziness"],
    source: "Sikiric et al., animal literature; WADA prohibited list; user reports",
    reviewed: "2026-11",
  },
  {
    key: "tb500", name: "TB-500", evidence: "animal-only",
    status: "A lab-made fragment of thymosin beta-4. Animal data only, with no completed human trials of this fragment. Not approved, and banned in competitive sport.",
    benefits: ["Users report faster recovery of strained or torn muscle", "Proposed to help cells migrate to injured tissue, from animal and cell studies"],
    sideEffects: ["Generally reported as well tolerated", "Injection site irritation", "Tiredness or head rush (user reports)"],
    seekCare: ["Spreading redness or swelling at an injection site", "Allergic-type reactions"],
    track: ["better_recovery", "joint_pain", "fatigue", "headache", "injection_site_reaction"],
    source: "Thymosin beta-4 literature; WADA prohibited list; user reports",
    reviewed: "2026-11",
  },
  {
    key: "ipamorelin", name: "Ipamorelin", evidence: "early-trials",
    status: "A growth hormone secretagogue. Human studies were small and development for its original use stopped. Not approved.",
    benefits: ["Raises growth hormone (studied)", "Users report deeper sleep and quicker recovery"],
    sideEffects: ["Headache", "Flushing", "Dizziness", "Water retention", "Increased hunger", "Injection site reactions"],
    seekCare: ["Numbness or tingling in the hands", "Swelling that keeps building", "High blood sugar signs such as thirst and frequent urination"],
    track: ["better_sleep", "better_recovery", "energy_boost", "headache", "flushing", "water_retention", "dizziness", "injection_site_reaction"],
    source: "Raun et al., Eur J Endocrinol 1998; Beck et al., 2014; user reports",
    reviewed: "2026-11",
  },
  {
    key: "cjc1295", name: "CJC-1295", evidence: "early-trials",
    status: "A growth hormone releasing hormone analog. Not approved. 'With DAC' and 'no DAC' versions behave differently.",
    benefits: ["Raises growth hormone and IGF-1 (studied)", "Users report better sleep and recovery"],
    sideEffects: ["Flushing", "Injection site reactions", "Headache", "Water retention", "Tingling"],
    seekCare: ["Swelling that keeps building", "Numbness or tingling in the hands", "Allergic-type reactions"],
    track: ["better_sleep", "better_recovery", "energy_boost", "flushing", "headache", "water_retention", "injection_site_reaction"],
    source: "Teichman et al., J Clin Endocrinol Metab 2006; user reports",
    reviewed: "2026-11",
  },
  {
    key: "ghkcu", name: "GHK-Cu", evidence: "early-trials",
    status: "A copper peptide. Most human data is for skin and hair products used on the surface. Evidence for injecting it is thin. Not approved as an injection.",
    benefits: ["Studied for skin appearance and wound healing (topical)"],
    sideEffects: ["Injection site irritation", "Skin reactions"],
    seekCare: ["Allergic-type reactions", "Spreading redness or swelling at an injection site"],
    track: ["clearer_skin", "better_recovery", "injection_site_reaction"],
    source: "Pickart & Margolina, Int J Mol Sci 2018 (review)",
    reviewed: "2026-11",
  },
  {
    key: "motsc", name: "MOTS-c", evidence: "animal-only",
    status: "A peptide made by mitochondria. Mostly animal and cell studies, with a few early human studies. Not approved.",
    benefits: ["Proposed to promote new mitochondria and improve insulin sensitivity, from animal and early studies", "Some users call it 'exercise in a bottle' and report better endurance and fat loss"],
    sideEffects: ["Jitteriness or feeling overstimulated", "Trouble sleeping when taken late in the day (user reports)", "Injection site irritation"],
    seekCare: ["Allergic-type reactions", "Spreading redness or swelling at an injection site"],
    track: ["energy_boost", "better_recovery", "jitteriness", "poor_sleep", "injection_site_reaction"],
    source: "Lee et al., Cell Metab 2015; user reports",
    reviewed: "2026-11",
  },
  {
    key: "tesamorelin", name: "Tesamorelin", evidence: "approved",
    status: "FDA-approved (Egrifta) to reduce extra belly fat in adults with HIV-related lipodystrophy. Any other use is off-label.",
    benefits: ["Reduces visceral belly fat in HIV lipodystrophy (the approved use)", "Raises growth hormone and IGF-1 (studied)"],
    sideEffects: ["Injection site reactions", "Joint pain", "Muscle aches", "Swelling in the limbs", "Headache", "Higher blood sugar"],
    seekCare: ["High blood sugar signs: thirst, frequent urination", "Swelling that keeps building", "Allergic-type reactions"],
    track: ["better_recovery", "joint_pain", "water_retention", "headache", "injection_site_reaction"],
    source: "Egrifta prescribing information (FDA)",
    reviewed: "2026-11",
  },
  {
    key: "nad", name: "NAD+", evidence: "early-trials",
    status: "A coenzyme used in cell energy production. Injectable forms are sold mainly through clinics and online, and human evidence for injected NAD+ is limited. Not approved as a drug.",
    benefits: ["Users report less brain fog and steadier daytime energy", "Users report quicker recovery from hard training or illness"],
    sideEffects: ["The 'NAD flush': a sudden wave of heat, chest tightness, racing heart and nausea lasting a few minutes, reported more with high doses or fast injections", "Stinging at the injection site"],
    seekCare: ["Chest pain that does not pass quickly", "Trouble breathing or fainting", "Allergic-type reactions"],
    track: ["reduced_brain_fog", "energy_boost", "better_recovery", "flushing", "racing_heart", "nausea", "injection_site_reaction"],
    source: "User reports; limited human data on injected NAD+",
    reviewed: "2026-11",
  },
  {
    key: "ss31", name: "SS-31 (elamipretide)", aliases: ["elamipretide"], evidence: "approved",
    status: "Elamipretide (Forzinity) got FDA accelerated approval in Sept 2025 to improve muscle strength in Barth syndrome, a rare mitochondrial disease. Use for anything else is unstudied.",
    benefits: ["Proposed to repair cardiolipin in the inner mitochondrial membrane and ease cellular oxidative stress"],
    sideEffects: ["Injection site reactions are the most common, usually redness or itching", "Serious allergic reactions have been reported"],
    seekCare: ["Rash, hives, itching that spreads, cough or trouble breathing after an injection", "Injection site reactions that keep getting worse"],
    track: ["injection_site_reaction", "energy_boost", "better_recovery", "fatigue"],
    source: "FDA Forzinity approval and prescribing information, 2025",
    reviewed: "2026-11",
  },
  {
    key: "5amino1mq", name: "5-amino-1MQ", evidence: "animal-only",
    status: "A small molecule that blocks NNMT, an enzyme linked to fat storage. Evidence is mostly from cell and animal studies. Not approved.",
    benefits: ["Proposed to reduce fat build-up and raise metabolic rate, from animal studies", "Users report it helps break through weight-loss plateaus"],
    sideEffects: ["Restlessness", "Trouble sleeping when taken late in the day (user reports)", "Mild stomach upset, since it is often taken as capsules"],
    seekCare: ["Palpitations or chest discomfort", "Allergic-type reactions"],
    track: ["jitteriness", "poor_sleep", "nausea"],
    source: "NNMT inhibitor animal studies; user reports",
    reviewed: "2026-11",
  },
];

export const BLEND_INFO: BlendInfo[] = [
  {
    keys: ["cjc1295", "ipamorelin"], name: "CJC-1295 / Ipamorelin",
    benefits: ["Deeper sleep", "Faster muscle recovery", "Easier to keep or add muscle while eating in a calorie deficit (user reports)"],
    sideEffects: ["The 'peptide flush': sudden heat in the face and a fast heartbeat right after the injection", "Daytime lethargy or a 'hangover' feeling when a night dose disrupts sleep", "Water retention, with swollen hands or feet", "Dizzy spells", "Head pressure"],
    track: ["better_sleep", "better_recovery", "flushing", "racing_heart", "fatigue", "water_retention", "dizziness", "headache"],
    source: "User reports", reviewed: "2026-11",
  },
  {
    keys: ["bpc157", "tb500"], name: "BPC-157 / TB-500 (the 'Wolverine' stack)",
    benefits: ["Users report large drops in pain and restored range of motion in chronic joint, meniscus and shoulder injuries", "BPC-157 is proposed to grow blood vessels in poorly supplied tendons, and TB-500 to help cells move to injured muscle. Both ideas come from animal and cell work"],
    sideEffects: ["Generally reported as well tolerated", "Injection site irritation"],
    debated: ["Whether BPC-157's effect on blood vessels could feed an undiagnosed tumor is argued both ways. There is no human evidence to settle it."],
    track: ["better_recovery", "joint_pain", "injection_site_reaction"],
    source: "User reports; animal literature", reviewed: "2026-11",
  },
  {
    keys: ["nad", "motsc", "5amino1mq"], name: "NAD+ / MOTS-c / 5-amino-1MQ",
    benefits: ["The aim is metabolic: MOTS-c for mitochondria and insulin sensitivity, 5-amino-1MQ for fat storage and metabolic rate, NAD+ as cell fuel", "This combination has not been studied as a blend"],
    sideEffects: ["The NAD flush: heat, redness, chest tightness and a racing heart, reported more with high doses or fast injections", "Jitteriness, overstimulation or poor sleep, reported more when taken late in the day"],
    track: ["energy_boost", "flushing", "racing_heart", "jitteriness", "poor_sleep"],
    source: "User reports", reviewed: "2026-11",
  },
];

/** "CJC-1295 (no DAC)" and "cjc 1295" both become "cjc1295". "NAD+" becomes "nad". */
export const infoKey = (name: string) => name.toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");

/** A blend is stored as one name with parts joined by " / ", e.g. "CJC-1295 / Ipamorelin". */
export const BLEND_SEP = " / ";
// "+" only splits when something follows it, so "NAD+" and "NAD+ / MOTS-c" keep the plus.
export const splitBlend = (name: string): string[] =>
  name.split(/\s*(?:\/|&|\bwith\b|\+(?=\s*[A-Za-z0-9]))\s*/i).map(s => s.trim()).filter(Boolean);
export const joinBlend = (parts: string[]) => parts.join(BLEND_SEP);

export interface InfoFor { parts: string[]; known: CompoundInfo[]; unknown: string[]; blend?: BlendInfo }

/** Notes for each part of a (possibly blended) compound name. Unknown parts are listed, never guessed. */
export function infoFor(name: string): InfoFor {
  const parts = splitBlend(name);
  const known: CompoundInfo[] = [];
  const unknown: string[] = [];
  for (const p of parts) {
    const k = infoKey(p);
    const hit = k ? COMPOUND_INFO.find(i => [i.key, ...(i.aliases ?? [])].some(a => k === a || k.startsWith(a))) : undefined;
    if (hit) { if (!known.includes(hit)) known.push(hit); } else unknown.push(p);
  }
  const keys = known.map(i => i.key).sort().join("|");
  const blend = known.length > 1 && unknown.length === 0 ? BLEND_INFO.find(b => [...b.keys].sort().join("|") === keys) : undefined;
  return { parts, known, unknown, blend };
}

/** Symptom types worth tracking across all parts (and a matching blend note), without repeats. */
export const trackFor = (known: CompoundInfo[], blend?: BlendInfo): string[] =>
  Array.from(new Set([...(blend?.track ?? []), ...known.flatMap(i => i.track)]));
