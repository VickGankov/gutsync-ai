// Reconstitution calculator: vial strength + water -> mg/mL -> syringe units. Arithmetic only.
// Every number is typed by the person. It never fills in or suggests a dose, vial size or amount of water.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Calculator, ChevronDown } from "lucide-react";
import { SYRINGES, reconstitute, validateRecon, waterForUnits, type SyringeUnits } from "@shared/reconstitution";

const KEY = "tp_recon_v1";
const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
const seg = (on: boolean) => `px-2 py-0.5 rounded-full text-[10px] font-medium ${on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`;

interface Saved { vial: string; vialUnit: "mg" | "mcg"; water: string; dose: string; doseUnit: "mg" | "mcg"; syringe: SyringeUnits }
const load = (): Partial<Saved> => { try { return JSON.parse(localStorage.getItem(KEY) ?? "{}"); } catch { return {}; } };

function UnitToggle({ value, onChange }: { value: "mg" | "mcg"; onChange: (u: "mg" | "mcg") => void }) {
  return <span className="flex gap-1">{(["mg", "mcg"] as const).map(u => <button key={u} type="button" onClick={() => onChange(u)} className={seg(value === u)}>{u}</button>)}</span>;
}

export default function ReconCalculator() {
  const [open, setOpen] = useState(false);
  const init = useMemo(load, []);
  const [vial, setVial] = useState(init.vial ?? "");
  const [vialUnit, setVialUnit] = useState<"mg" | "mcg">(init.vialUnit ?? "mg");
  const [water, setWater] = useState(init.water ?? "");
  const [dose, setDose] = useState(init.dose ?? "");
  const [doseUnit, setDoseUnit] = useState<"mg" | "mcg">(init.doseUnit ?? "mcg");
  const [syringe, setSyringe] = useState<SyringeUnits>(init.syringe ?? 100);
  const [target, setTarget] = useState("");

  // Remember the last numbers on this device only (never sent anywhere).
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ vial, vialUnit, water, dose, doseUnit, syringe })); } catch { /* private mode */ }
  }, [vial, vialUnit, water, dose, doseUnit, syringe]);

  const input = useMemo(() => ({
    vialMcg: Number(vial) * (vialUnit === "mg" ? 1000 : 1),
    waterMl: Number(water),
    doseMcg: Number(dose) * (doseUnit === "mg" ? 1000 : 1),
    syringeUnits: syringe,
  }), [vial, vialUnit, water, dose, doseUnit, syringe]);
  const empty = !vial || !water || !dose;
  const error = empty ? null : validateRecon(input);
  const result = !empty && !error ? reconstitute(input) : null;
  const tgt = Number(target);
  const suggestedWater = !empty && !error && tgt > 0 && tgt <= syringe ? waterForUnits(input.vialMcg, input.doseMcg, tgt) : null;

  return (
    <div className="mb-3">
      <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left shadow-sm transition-colors hover:bg-muted/40">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--primary)", color: "var(--volt)" }}>
          <Calculator className="h-4.5 w-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Reconstitution calculator</span>
          <span className="block text-xs text-muted-foreground">Turn a vial mix into syringe units</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-border/60 bg-card p-3 space-y-3">
          <p className="text-[11px] text-muted-foreground">Converts a vial mix to syringe units. Use the numbers from your prescriber, pharmacist or vial label. It never suggests a dose.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">
              <span className="flex items-center justify-between">In the vial <UnitToggle value={vialUnit} onChange={setVialUnit} /></span>
              <input className={`${inputCls} mt-1`} type="number" inputMode="decimal" min="0" step="any" value={vial} onChange={e => setVial(e.target.value)} placeholder={vialUnit === "mg" ? "e.g. 5" : "e.g. 5000"} />
            </label>
            <label className="text-xs text-muted-foreground">
              <span className="flex items-center justify-between">Water added <span className="text-[10px]">mL</span></span>
              <input className={`${inputCls} mt-1`} type="number" inputMode="decimal" min="0" step="any" value={water} onChange={e => setWater(e.target.value)} placeholder="e.g. 2" />
            </label>
            <label className="text-xs text-muted-foreground">
              <span className="flex items-center justify-between">Dose wanted <UnitToggle value={doseUnit} onChange={setDoseUnit} /></span>
              <input className={`${inputCls} mt-1`} type="number" inputMode="decimal" min="0" step="any" value={dose} onChange={e => setDose(e.target.value)} placeholder={doseUnit === "mg" ? "e.g. 0.25" : "e.g. 250"} />
            </label>
            <label className="text-xs text-muted-foreground">
              Syringe
              <select className={`${inputCls} mt-1`} value={syringe} onChange={e => setSyringe(Number(e.target.value) as SyringeUnits)}>
                {SYRINGES.map(s => <option key={s.units} value={s.units}>{s.label}</option>)}
              </select>
            </label>
          </div>

          {error && <p className="text-xs text-coral">{error}</p>}

          {result && (
            <div className="space-y-2">
              <div className="rounded-xl bg-muted px-3.5 py-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Draw to</p>
                <p className="font-display text-3xl leading-none mt-0.5">{result.units} <span className="text-base font-sans text-muted-foreground">units</span></p>
                <p className="text-xs text-muted-foreground mt-1">{result.mlPerDose} mL · mix is {result.mgPerMl} mg/mL ({result.mcgPerMl} mcg/mL)</p>
                <p className="text-xs text-muted-foreground">About {result.dosesPerVial} dose{result.dosesPerVial === 1 ? "" : "s"} per vial, before any waste.</p>
                {result.units !== result.roundedUnits && (
                  <p className="text-xs mt-1">Drawn to the nearest whole unit ({result.roundedUnits}) that's {result.roundedDoseMcg} mcg, {Math.abs(result.roundingErrorPct)}% {result.roundingErrorPct < 0 ? "under" : "over"}.</p>
                )}
              </div>
              {result.warnings.map(w => (
                <p key={w.kind} className="flex gap-1.5 text-xs rounded-lg px-2.5 py-2" style={{ background: "oklch(0.95 0.04 25)" }}>
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px text-coral" />{w.message}
                </p>
              ))}
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer">Show the working</summary>
                <ol className="mt-1 space-y-0.5 list-decimal pl-4">{result.steps.map(s => <li key={s}>{s}</li>)}</ol>
                <p className="mt-1">Check it once by hand: a 10× slip (mg vs mcg) is the usual mistake.</p>
              </details>
              <label className="text-xs text-muted-foreground block">
                Want an easier draw? Units you'd like for this dose
                <input className={`${inputCls} mt-1`} type="number" inputMode="decimal" min="0" step="any" value={target} onChange={e => setTarget(e.target.value)} placeholder="e.g. 20" />
              </label>
              {suggestedWater !== null && (
                <p className="text-xs">Mixing the same vial with <b>{suggestedWater} mL</b> of water makes this dose {tgt} units.</p>
              )}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground leading-snug">U-100 syringes (100 units = 1 mL). Arithmetic only: confirm the mix with whoever prescribed or supplied it.</p>
        </div>
      )}
    </div>
  );
}
