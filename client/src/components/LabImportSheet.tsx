// Review what was read from a lab report. Nothing is saved until you confirm, and you can fix any value first.

import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { friendlyPlanError } from "@shared/plans";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { dateKeyOf } from "@shared/weekly";

export interface DraftRow { marker: string; value: string; unit: string; refLow: string; refHigh: string }
export interface Draft { collectedOn: string | null; skipped: number; rows: DraftRow[] }

const inputCls = "bg-background border border-border rounded-lg px-2 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/30";
const todayKey = () => dateKeyOf(Date.now(), new Date().getTimezoneOffset());
const optNum = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export default function LabImportSheet({ draft, onClose }: { draft: Draft | null; onClose: () => void }) {
  const utils = trpc.useUtils();
  const addMany = trpc.labs.addMany.useMutation();
  const [rows, setRows] = useState<DraftRow[]>(draft?.rows ?? []);
  const [drawnOn, setDrawnOn] = useState(draft?.collectedOn ?? "");
  if (!draft) return null;

  const patch = (i: number, p: Partial<DraftRow>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const valid = rows.filter(r => r.marker.trim() && r.unit.trim() && r.value.trim() !== "" && Number.isFinite(Number(r.value)));
  const canSave = valid.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(drawnOn);

  const save = () => addMany.mutate(
    { rows: valid.map(r => ({ marker: r.marker.trim(), value: Number(r.value), unit: r.unit.trim(), refLow: optNum(r.refLow), refHigh: optNum(r.refHigh), drawnOn })) },
    {
      onSuccess: res => { toast.success(`${res.saved} result${res.saved === 1 ? "" : "s"} saved`); utils.labs.list.invalidate(); onClose(); },
      onError: e => toast.error(friendlyPlanError(e.message) || "Couldn't save"),
    },
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-t-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-5 pb-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-semibold">Check what was read</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Compare each row with your report. Reading can get a digit or unit wrong, so fix anything off, and remove rows you don't want. Nothing is saved until you tap Save. Your report was read by an AI service and the file isn't kept. Only what you confirm here is saved, to your account.
        </p>
        {draft.skipped > 0 && (
          <p className="text-xs rounded-lg bg-amber-100/70 text-amber-800 px-3 py-2 mb-3">
            {draft.skipped} result{draft.skipped === 1 ? " was" : "s were"} left out (not a plain number, like "&lt;0.5", or missing a unit). Add those by hand if you need them.
          </p>
        )}

        <label className="block text-xs text-muted-foreground mb-3">
          Date blood was drawn {draft.collectedOn ? "" : "(not found on the report, please set it)"}
          <input type="date" className={`${inputCls} mt-1`} value={drawnOn} max={todayKey()} onChange={e => setDrawnOn(e.target.value)} />
        </label>

        <div className="space-y-2.5">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl bg-muted/50 p-2.5">
              <div className="flex gap-2 items-center">
                <input className={inputCls} value={r.marker} maxLength={60} onChange={e => patch(i, { marker: e.target.value })} aria-label="Marker" />
                <button onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} aria-label="Remove row" className="p-1.5 text-muted-foreground"><Trash2 className="w-4 h-4" /></button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <label className="text-[10px] text-muted-foreground">Value
                  <input className={`${inputCls} mt-0.5`} inputMode="decimal" value={r.value} onChange={e => patch(i, { value: e.target.value })} />
                </label>
                <label className="text-[10px] text-muted-foreground">Unit
                  <input className={`${inputCls} mt-0.5`} value={r.unit} maxLength={24} onChange={e => patch(i, { unit: e.target.value })} />
                </label>
                <label className="text-[10px] text-muted-foreground">Range low (optional)
                  <input className={`${inputCls} mt-0.5`} inputMode="decimal" value={r.refLow} onChange={e => patch(i, { refLow: e.target.value })} />
                </label>
                <label className="text-[10px] text-muted-foreground">Range high (optional)
                  <input className={`${inputCls} mt-0.5`} inputMode="decimal" value={r.refHigh} onChange={e => patch(i, { refHigh: e.target.value })} />
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mt-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save} disabled={!canSave || addMany.isPending}>
            {addMany.isPending ? "Saving..." : `Save ${valid.length} result${valid.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
