// Inline editor for one logged dose: compound, amount, date and time, site and note. Also deletes it.
// Streaks, next-due dates and site rotation are all derived from the log, so they update after a save.

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { SITES, SITE_LABEL, mgToMcg, type Site } from "@shared/dose";

export interface EditableDose { id: number; compound: string; doseMcg: number; site: string | null; notes: string | null; loggedAt: number }

const inputCls =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
const toLocalInput = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const chip = (on: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border/60"}`;

export default function DoseEditor({ dose, onClose }: { dose: EditableDose; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [compound, setCompound] = useState(dose.compound);
  const [unit, setUnit] = useState<"mg" | "mcg">(dose.doseMcg >= 1000 ? "mg" : "mcg");
  const [amount, setAmount] = useState(String(dose.doseMcg >= 1000 ? Number((dose.doseMcg / 1000).toFixed(3)) : dose.doseMcg));
  const [when, setWhen] = useState(toLocalInput(dose.loggedAt));
  const [site, setSite] = useState<Site | null>((SITES as readonly string[]).includes(dose.site ?? "") ? (dose.site as Site) : null);
  const [notes, setNotes] = useState(dose.notes ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const done = () => { utils.dose.list.invalidate(); onClose(); };
  const update = trpc.dose.update.useMutation({ onSuccess: () => { toast.success("Dose updated"); done(); }, onError: e => toast.error(e.message) });
  const remove = trpc.dose.delete.useMutation({ onSuccess: () => { toast.success("Dose deleted"); done(); }, onError: e => toast.error(e.message) });

  const save = () => {
    const n = Number(amount);
    const at = new Date(when).getTime();
    if (!compound.trim()) return toast.error("Enter the compound name");
    if (!Number.isFinite(n) || n <= 0) return toast.error(`Enter the dose in ${unit}`);
    if (!Number.isFinite(at)) return toast.error("Enter a valid date and time");
    update.mutate({ id: dose.id, compound: compound.trim(), doseMcg: unit === "mg" ? mgToMcg(n) : Math.round(n), site, notes: notes.trim() || null, loggedAt: at });
  };

  return (
    <div className="rounded-xl bg-muted/50 p-3 my-1.5 space-y-2.5">
      <input className={inputCls} value={compound} maxLength={80} onChange={e => setCompound(e.target.value)} placeholder="Compound" aria-label="Compound" />
      <div className="space-y-2.5">
        <label className="block text-[11px] text-muted-foreground">
          <span className="flex items-center justify-between">Dose
            <span className="flex gap-1">
              {(["mg", "mcg"] as const).map(u => (
                <button key={u} type="button" onClick={() => setUnit(u)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${unit === u ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground"}`}>{u}</button>
              ))}
            </span>
          </span>
          <input className={`${inputCls} mt-1`} type="number" inputMode="decimal" min="0" step={unit === "mg" ? "0.05" : "1"} value={amount} onChange={e => setAmount(e.target.value)} />
        </label>
        <label className="block text-[11px] text-muted-foreground">Date and time
          <input className={`${inputCls} mt-1`} type="datetime-local" max={toLocalInput(Date.now())} value={when} onChange={e => setWhen(e.target.value)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {SITES.map(s => <button key={s} type="button" className={chip(site === s)} onClick={() => setSite(site === s ? null : s)}>{SITE_LABEL[s]}</button>)}
      </div>
      <input className={inputCls} value={notes} maxLength={500} onChange={e => setNotes(e.target.value)} placeholder="Note (optional)" aria-label="Note" />
      <div className="flex items-center gap-2">
        <Button size="sm" className="h-9 rounded-xl" onClick={save} disabled={update.isPending}>
          {update.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}Save
        </Button>
        <Button size="sm" variant="outline" className="h-9 rounded-xl" onClick={onClose}>Cancel</Button>
        <span className="flex-1" />
        {confirmDelete ? (
          <Button size="sm" variant="destructive" className="h-9 rounded-xl" onClick={() => remove.mutate({ id: dose.id })} disabled={remove.isPending}>Delete for good</Button>
        ) : (
          <button type="button" className="text-xs text-muted-foreground underline underline-offset-2" onClick={() => setConfirmDelete(true)}>Delete</button>
        )}
      </div>
    </div>
  );
}
