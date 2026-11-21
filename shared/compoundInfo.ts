// Short, hand-written reference notes for the compounds people log, plus blend handling.
// Static on purpose: never generated at runtime, never sent to the AI, shown only inside the signed-in app.
// Benefits and side effects for NAD+, SS-31, MOTS-c, 5-amino-1MQ, Retatrutide and the three blends are the owner's own wording, kept verbatim.
// "members" notes come from Project Biohacked member reports (anecdotal; several top posters are tied to vendors).
// Dose figures appear only inside these member notes, worded as what members report, never as advice.
// Every entry keeps a source and a review date for maintenance (not shown). Re-check wording before changing anything here.

export interface CompoundInfo {
  key: string;            // normalised name, see infoKey()
  name: string;
  aliases?: string[];     // other names that mean the same thing (normalised)
  benefits: string[];     // reported by users, or proposed from early studies
  sideEffects: string[];  // reported by users or in studies
  owner?: boolean;        // benefits/side effects are the owner's own text
  members?: string[];     // extra notes from Project Biohacked member reports (anecdotal)
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
  members?: string[];
  track: string[];
  source: string;
  reviewed: string;
}

export const COMPOUND_INFO: CompoundInfo[] = [
  {
    key: "retatrutide", owner: true, name: "Retatrutide",
    benefits: ["Extreme appetite suppression (often described as completely silencing \"food noise\"), rapid initial weight loss, and potential lean muscle preservation when combined with high protein intake and resistance training."],
    sideEffects: ["Nausea, GI distress (cramping and alternating bouts of diarrhea and constipation), profound fatigue, and an elevated resting heart rate. A highly specific side effect heavily documented on Reddit is allodynia—a bizarre skin hypersensitivity that feels like a sunburn or intense cold radiating deep into the bones, typically emerging at doses above 3mg."],
    members: ["Many report big weight loss (one person lost 43 lb in about 3 months) and better appetite control", "Several mention less inflammation and gut or autoimmune relief", "Most common side effects are GI problems like stomach pain, diarrhea and nausea, then fatigue, with a few reports of heart-rate spikes", "Most start at 250–500 mcg and titrate slowly", "Some members worry supply could tighten"],
    track: ["less_food_noise", "fewer_cravings", "low_appetite", "nausea", "diarrhea", "constipation", "fatigue", "racing_heart", "skin_sensitivity", "injection_site_reaction"],
    source: "Eli Lilly TRIUMPH-2/3 announcement, Jul 2026; Jastreboff et al., NEJM 2023; user reports",
    reviewed: "2026-11",
  },
  {
    key: "bpc157", name: "BPC-157",
    benefits: ["Users report less pain and better range of motion in chronic tendon, joint and shoulder injuries", "Proposed to grow new blood vessels (angiogenesis) in poorly supplied tendons and ligaments, from animal studies"],
    sideEffects: ["Generally reported as well tolerated", "Injection site irritation", "Nausea or dizziness (rare user reports)"],
    members: ["Many report tendon, joint and injury relief, sometimes within a week or two, and gut and IBS relief", "Side effects are rare: one person had headaches and irritability at a high dose", "Open question: cancer risk for people with a cancer history. The advice given was to ask an oncologist"],
    track: ["better_recovery", "joint_pain", "better_digestion", "injection_site_reaction", "nausea", "dizziness"],
    source: "Sikiric et al., animal literature; WADA prohibited list; user reports",
    reviewed: "2026-11",
  },
  {
    key: "tb500", name: "TB-500",
    benefits: ["Users report faster recovery of strained or torn muscle", "Proposed to help cells migrate to injured tissue, from animal and cell studies"],
    sideEffects: ["Generally reported as well tolerated", "Injection site irritation", "Tiredness or head rush (user reports)"],
    track: ["better_recovery", "joint_pain", "fatigue", "headache", "injection_site_reaction"],
    source: "Thymosin beta-4 literature; WADA prohibited list; user reports",
    reviewed: "2026-11",
  },
  {
    key: "ipamorelin", name: "Ipamorelin",
    benefits: ["Raises growth hormone (studied)", "Users report deeper sleep and quicker recovery"],
    sideEffects: ["Headache", "Flushing", "Dizziness", "Water retention", "Increased hunger", "Injection site reactions"],
    track: ["better_sleep", "better_recovery", "energy_boost", "headache", "flushing", "water_retention", "dizziness", "injection_site_reaction"],
    source: "Raun et al., Eur J Endocrinol 1998; Beck et al., 2014; user reports",
    reviewed: "2026-11",
  },
  {
    key: "cjc1295", name: "CJC-1295",
    benefits: ["Raises growth hormone and IGF-1 (studied)", "Users report better sleep and recovery"],
    sideEffects: ["Flushing", "Injection site reactions", "Headache", "Water retention", "Tingling"],
    members: ["A 10 to 20 minute flush, warmth or racing heart right after injecting is common, and is blamed on the CJC", "Most prefer CJC without DAC"],
    track: ["better_sleep", "better_recovery", "energy_boost", "flushing", "headache", "water_retention", "injection_site_reaction"],
    source: "Teichman et al., J Clin Endocrinol Metab 2006; user reports",
    reviewed: "2026-11",
  },
  {
    key: "ghkcu", name: "GHK-Cu",
    benefits: ["Studied for skin appearance and wound healing (topical)"],
    sideEffects: ["Injection site irritation", "Skin reactions"],
    track: ["clearer_skin", "better_recovery", "injection_site_reaction"],
    source: "Pickart & Margolina, Int J Mol Sci 2018 (review)",
    reviewed: "2026-11",
  },
  {
    key: "motsc", owner: true, name: "MOTS-c",
    benefits: ["Drives mitochondrial biogenesis (creating brand-new mitochondria) and aggressively spikes insulin sensitivity. It is widely referred to on Reddit as \"exercise in a bottle\" because of how dramatically it improves cardiovascular endurance and accelerates fat loss."],
    sideEffects: ["Because it ramps up cellular energy and mimics the metabolic effects of exercise, injecting MOTS-c too late in the afternoon is a fast track to severe insomnia. Some users also report feeling uncomfortably jittery or overstimulated."],
    members: ["Energy and workout reports are less concrete than for SS-31 or NAD+", "The top complaint by far is injection-site stinging, welts or itchy lumps, and members suggest diluting more and injecting slowly", "Some also mention fatigue, flushing and cloudy vials"],
    track: ["energy_boost", "better_recovery", "jitteriness", "poor_sleep", "injection_site_reaction"],
    source: "Lee et al., Cell Metab 2015; user reports",
    reviewed: "2026-11",
  },
  {
    key: "tesamorelin", name: "Tesamorelin",
    benefits: ["Reduces visceral belly fat in HIV lipodystrophy (the approved use)", "Raises growth hormone and IGF-1 (studied)"],
    sideEffects: ["Injection site reactions", "Joint pain", "Muscle aches", "Swelling in the limbs", "Headache", "Higher blood sugar"],
    track: ["better_recovery", "joint_pain", "water_retention", "headache", "injection_site_reaction"],
    source: "Egrifta prescribing information (FDA)",
    reviewed: "2026-11",
  },
  {
    key: "nad", owner: true, name: "NAD+",
    benefits: ["Provides the raw fuel for cellular energy production. Users frequently report massive reductions in brain fog, sharp increases in sustained daytime energy, and accelerated recovery from intense training or illness."],
    sideEffects: ["The highly documented \"NAD flush.\" If you inject a high dose or push the plunger too fast, you will likely experience a sudden, intense wave of heat, chest tightness, a racing heart, and nausea that lasts for 3 to 5 minutes. Subcutaneous injections of pure NAD+ are also notorious for stinging at the injection site."],
    members: ["Many report strong energy and focus, often within a week", "Side effects include fatigue (linked to methylation), a short flush or jittery feeling, and stinging at the injection site", "One serious event stands out: a long-time user nearly fainted after a 200 mg intramuscular shot, and about four others said the same had happened to them", "Most people test a low dose first and settle at 40–100 mg"],
    track: ["reduced_brain_fog", "energy_boost", "better_recovery", "flushing", "racing_heart", "nausea", "injection_site_reaction"],
    source: "User reports; limited human data on injected NAD+",
    reviewed: "2026-11",
  },
  {
    key: "ss31", owner: true, name: "SS-31 (elamipretide)", aliases: ["elamipretide"],
    benefits: ["Members describe a non-stimulant kind of energy and clarity", "Members say workouts feel easier"],
    sideEffects: ["Exhaustion at higher doses (2.5–5 mg), which eased when people lowered the dose"],
    members: ["Many vendors have stopped carrying it"],
    track: ["energy_boost", "fatigue", "injection_site_reaction"],
    source: "Project Biohacked member reports",
    reviewed: "2026-11",
  },
  {
    key: "5amino1mq", owner: true, name: "5-amino-1MQ",
    benefits: ["Blocks the NNMT enzyme, which prevents fat accumulation and forces the body to burn existing fat stores, effectively raising your basal metabolic rate. It is heavily praised for breaking through stubborn weight loss plateaus."],
    sideEffects: ["Like MOTS-c, the most common complaints are restlessness and sleep disruption if taken late in the day. Because it is often taken orally in capsules, it can occasionally cause mild GI upset."],
    track: ["jitteriness", "poor_sleep", "nausea"],
    source: "NNMT inhibitor animal studies; user reports",
    reviewed: "2026-11",
  },
];

export const BLEND_INFO: BlendInfo[] = [
  {
    keys: ["cjc1295", "ipamorelin"], name: "CJC-1295 / Ipamorelin",
    benefits: ["Deepened sleep architecture, accelerated muscle recovery, and an improved ability to add or maintain muscle mass while in a caloric deficit."],
    sideEffects: ["The infamous \"peptide flush\" (a sudden rush of heat to the face and rapid heart rate immediately post-injection), severe daytime lethargy or a \"hangover\" feeling if the nighttime dose disrupts sleep, water retention leading to swollen hands or feet, dizzy spells, and head pressure."],
    members: ["Members report better sleep, recovery and body composition, plus some skin, mood and libido gains", "A 10 to 20 minute flush, warmth or racing heart right after injecting is common, and is blamed on the CJC", "One person's IGF-1 went too high, so people suggest checking labs", "Most prefer CJC without DAC"],
    track: ["better_sleep", "better_recovery", "flushing", "racing_heart", "fatigue", "water_retention", "dizziness", "headache"],
    source: "User reports", reviewed: "2026-11",
  },
  {
    keys: ["bpc157", "tb500"], name: "BPC-157 / TB-500 (the 'Wolverine' stack)",
    benefits: ["Unrivaled soft tissue repair. BPC-157 drives angiogenesis (new blood vessel growth) to tendons and ligaments that usually lack blood flow, while TB-500 upregulates cell migration to rebuild torn muscle. Users widely report massive pain reduction and restored range of motion in chronic joint, meniscus, and shoulder injuries."],
    sideEffects: ["Generally exceptionally well-tolerated. The most prominent debate on Reddit involves a theoretical risk: because BPC-157 stimulates new blood vessels, users frequently argue over whether it could inadvertently supply blood to pre-existing, undiagnosed tumors, though the clinical evidence remains heavily conflicting."],
    members: ["Many report tendon, joint and injury relief, sometimes within a week or two, and BPC also gets gut and IBS reports", "Side effects are rare: one person had headaches and irritability at a high dose", "Open question: cancer risk for people with a cancer history. The advice given was to ask an oncologist"],
    track: ["better_recovery", "joint_pain", "injection_site_reaction"],
    source: "User reports; animal literature", reviewed: "2026-11",
  },
  {
    keys: ["nad", "motsc", "5amino1mq"], name: "NAD+ / MOTS-c / 5-amino-1MQ",
    benefits: ["A massive metabolic overhaul. MOTS-c drives mitochondrial biogenesis and spikes insulin sensitivity, 5-amino-1MQ blocks the NNMT enzyme to prevent fat accumulation and boost the basal metabolic rate, and NAD+ provides the raw fuel for the newly repaired mitochondrial network."],
    sideEffects: ["NAD+ notoriously causes a harsh systemic \"flush\" (intense warmth, redness, chest tightness, and a racing heart) if injected too quickly or at high doses. The MOTS-c and 5-amino-1MQ additions can cause jitteriness, overstimulation, or severe sleep disruption if the blend is injected too late in the afternoon."],
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
