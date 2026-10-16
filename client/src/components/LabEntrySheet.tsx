// Add one blood work value by hand.

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { COMMON_MARKERS } from "@shared/labs";
import { dateKeyOf } from "@shared/weekly";

const inputCls = "bg-background border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/30";
const todayKey = () => dateKeyOf(Date.now(), new Date().getTimezoneOffset());
const optNum = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export default function LabEntrySheet({ open, onClose, knownMarkers, lastUnitFor, presetMarker }: {
  open: boolean; onClose: () => void; knownMarkers: string[]; lastUnitFor: (marker: string) => string | null; presetMarker?: string | null;
}) {
  const utils = trpc.useUtils();
  const add = trpc.labs.add.useMutation();
  const [marker, setMarker] = useState(presetMarker ?? "");
  const [value, setValue] = useState("");
  const [unit, setUnit] = useState("");
  const [drawnOn, setDrawnOn] = useState(todayKey());
  const [low, setLow] = useState("");
  const [high, setHigh] = useState("");
  if (!open) return null;

  const names = Array.from(new Set([...knownMarkers, ...COMMON_MARKERS.map(m => m.name)]));
  const onMarker = (m: string) => {
    setMarker(m);
    // Fill the unit from your last entry for this marker, else the usual US unit.
    const u = lastUnitFor(m) ?? COMMON_MARKERS.find(c => c.name.toLowerCase() === m.trim().toLowerCase())?.unit;
    if (u && !unit) setUnit(u);
  };
  const v = Number(value);
  const valid = marker.trim() && unit.trim() && value.trim() !== "" && Number.isFinite(v) && /^\d{4}-\d{2}-\d{2}$/.test(drawnOn);

  const save = () => add.mutate(
    { marker: marker.trim(), value: v, unit: unit.trim(), refLow: optNum(low), refHigh: optNum(high), drawnOn },
    {
      onSuccess: () => { toast.success("Result saved"); utils.labs.list.invalidate(); setValue(""); setLow(""); setHigh(""); onClose(); },
      onError: e => toast.error(e.message || "Couldn't save"),
    },
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-t-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-5 pb-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-semibold">Add a lab result</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Copy the value, unit and range as printed on your report.</p>

        <div className="space-y-3">
          <label className="block text-xs text-muted-foreground">Marker
            <input className={`${inputCls} mt-1`} list="lab-markers" placeholder="e.g. Vitamin D (25-OH)" value={marker} maxLength={60}
              onChange={e => onMarker(e.target.value)} />
            <datalist id="lab-markers">{names.map(n => <option key={n} value={n} />)}</datalist>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted-foreground">Value
              <input className={`${inputCls} mt-1`} type="number" inputMode="decimal" step="any" value={value} onChange={e => setValue(e.target.value)} />
            </label>
            <label className="block text-xs text-muted-foreground">Unit
              <input className={`${inputCls} mt-1`} value={unit} maxLength={24} placeholder="ng/mL" onChange={e => setUnit(e.target.value)} />
            </label>
          </div>
          <label className="block text-xs text-muted-foreground">Date blood was drawn
            <input className={`${inputCls} mt-1`} type="date" value={drawnOn} max={todayKey()} onChange={e => setDrawnOn(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs text-muted-foreground">Lab range, low (optional)
              <input className={`${inputCls} mt-1`} type="number" inputMode="decimal" step="any" value={low} onChange={e => setLow(e.target.value)} />
            </label>
            <label className="block text-xs text-muted-foreground">Lab range, high (optional)
              <input className={`${inputCls} mt-1`} type="number" inputMode="decimal" step="any" value={high} onChange={e => setHigh(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save} disabled={!valid || add.isPending}>{add.isPending ? "Saving..." : "Save"}</Button>
        </div>
      </div>
    </div>
  );
}
