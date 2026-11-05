// Reconstitution arithmetic: vial strength + water added -> concentration -> volume and syringe units for a dose.
// This is unit conversion only. It never suggests a dose, a vial size or an amount of water for any compound:
// every number comes from the person (their prescriber's or pharmacist's instructions, or the vial label).
// Assumes U-100 syringes, where 100 units = 1 mL (the standard insulin syringe in the US).

export const UNITS_PER_ML = 100;
export const SYRINGES = [
  { ml: 0.3, units: 30, label: "0.3 mL (30 units)" },
  { ml: 0.5, units: 50, label: "0.5 mL (50 units)" },
  { ml: 1, units: 100, label: "1 mL (100 units)" },
] as const;
export type SyringeUnits = (typeof SYRINGES)[number]["units"];

export interface ReconInput {
  /** Total peptide in the vial, in micrograms (5 mg = 5000). */
  vialMcg: number;
  /** Bacteriostatic water added, in mL. */
  waterMl: number;
  /** Dose wanted, in micrograms. */
  doseMcg: number;
  /** Syringe capacity in units. */
  syringeUnits: SyringeUnits;
}

export type ReconWarning =
  | { kind: "dose_exceeds_vial"; message: string }
  | { kind: "over_syringe"; message: string }
  | { kind: "tiny_volume"; message: string };

export interface ReconResult {
  mcgPerMl: number;
  mgPerMl: number;
  mlPerDose: number;
  /** Exact units to draw, to 2 decimals. */
  units: number;
  /** Whole doses in the vial before it runs out (ignores any loss in the needle or vial). */
  dosesPerVial: number;
  /** What a draw to the nearest whole unit actually delivers. */
  roundedUnits: number;
  roundedDoseMcg: number;
  roundingErrorPct: number;
  warnings: ReconWarning[];
  /** The working, one line per step, so the person can check it by hand. */
  steps: string[];
}

const r = (n: number, d: number) => Math.round(n * 10 ** d) / 10 ** d;
const fmt = (n: number, d = 2) => String(r(n, d));
const mcgLabel = (mcg: number) => (mcg >= 1000 ? `${fmt(mcg / 1000, 3)} mg` : `${fmt(mcg, 1)} mcg`);

export function validateRecon(i: Partial<ReconInput>): string | null {
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
  if (!ok(i.vialMcg)) return "Enter how much is in the vial.";
  if (!ok(i.waterMl)) return "Enter how much water was added.";
  if (!ok(i.doseMcg)) return "Enter the dose you want.";
  if (i.vialMcg > 1_000_000_000) return "That vial amount looks too large. Check the unit.";
  if (i.waterMl > 100) return "More than 100 mL of water is not realistic for one vial. Check the number.";
  return null;
}

export function reconstitute(i: ReconInput): ReconResult {
  const mcgPerMl = i.vialMcg / i.waterMl;
  const mlPerDose = i.doseMcg / mcgPerMl;
  const units = mlPerDose * UNITS_PER_ML;
  const roundedUnits = Math.round(units);
  const roundedDoseMcg = (roundedUnits / UNITS_PER_ML) * mcgPerMl;
  const warnings: ReconWarning[] = [];

  if (i.doseMcg > i.vialMcg) {
    warnings.push({ kind: "dose_exceeds_vial", message: `The dose (${mcgLabel(i.doseMcg)}) is more than the whole vial (${mcgLabel(i.vialMcg)}). Check the units.` });
  }
  if (units > i.syringeUnits) {
    warnings.push({ kind: "over_syringe", message: `${fmt(units, 1)} units is more than a ${i.syringeUnits}-unit syringe holds. Use a larger syringe, or ask whoever gave you the instructions whether a different amount of water is intended.` });
  }
  if (units < 5 && units > 0) {
    warnings.push({ kind: "tiny_volume", message: `${fmt(units, 1)} units is a very small volume and hard to draw accurately: a half-unit slip is a large share of the dose. More water makes each dose a bigger, easier draw.` });
  }

  const steps = [
    `Concentration: ${mcgLabel(i.vialMcg)} ÷ ${fmt(i.waterMl, 3)} mL = ${fmt(mcgPerMl, 1)} mcg per mL (${fmt(mcgPerMl / 1000, 3)} mg/mL)`,
    `Volume for the dose: ${mcgLabel(i.doseMcg)} ÷ ${fmt(mcgPerMl, 1)} mcg/mL = ${fmt(mlPerDose, 3)} mL`,
    `Syringe units: ${fmt(mlPerDose, 3)} mL × 100 = ${fmt(units)} units`,
  ];

  return {
    mcgPerMl: r(mcgPerMl, 3), mgPerMl: r(mcgPerMl / 1000, 4), mlPerDose: r(mlPerDose, 4), units: r(units, 2),
    dosesPerVial: Math.floor(i.vialMcg / i.doseMcg + 1e-9),
    roundedUnits, roundedDoseMcg: r(roundedDoseMcg, 2),
    roundingErrorPct: i.doseMcg > 0 ? r(((roundedDoseMcg - i.doseMcg) / i.doseMcg) * 100, 1) : 0,
    warnings, steps,
  };
}

/** The dose delivered by drawing `units` from this vial mix. */
export function doseForUnits(vialMcg: number, waterMl: number, units: number): number {
  return r(((units / UNITS_PER_ML) * vialMcg) / waterMl, 2);
}

/** Water (mL) that makes `doseMcg` come out at `targetUnits` on the syringe: a way to pick an easy draw. */
export function waterForUnits(vialMcg: number, doseMcg: number, targetUnits: number): number {
  return r((vialMcg * (targetUnits / UNITS_PER_ML)) / doseMcg, 3);
}
