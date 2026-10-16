// Rename a marker, or merge it into another one you already track (e.g. "LDL" and "LDLC" from two labs).

import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

const inputCls = "bg-background border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/30";

export default function LabMergeSheet({ marker, others, onClose, onDone }: {
  marker: string; others: string[]; onClose: () => void; onDone: (name: string) => void;
}) {
  const utils = trpc.useUtils();
  const rename = trpc.labs.renameMarker.useMutation();
  const [target, setTarget] = useState("");
  const name = target.trim();
  const merging = others.some(o => o.toLowerCase() === name.toLowerCase());

  const save = () => rename.mutate({ from: marker, to: name }, {
    onSuccess: res => {
      utils.labs.list.invalidate();
      toast.success(merging ? "Merged" : "Renamed");
      onDone(("marker" in res && res.marker) || name);
    },
    onError: e => toast.error(e.message || "Couldn't save"),
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-t-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-5 pb-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-semibold">Merge or rename</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Move every <span className="font-medium text-foreground">{marker}</span> result under another name. Pick a marker you already have to combine them into one chart, or type a new name.
        </p>

        {others.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {others.map(o => (
              <button key={o} type="button" onClick={() => setTarget(o)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border ${name.toLowerCase() === o.toLowerCase() ? "bg-primary text-primary-foreground border-primary" : "bg-muted/60 text-muted-foreground border-transparent"}`}>
                {o}
              </button>
            ))}
          </div>
        )}
        <label className="block text-xs text-muted-foreground">New name
          <input className={`${inputCls} mt-1`} value={target} maxLength={60} placeholder="e.g. LDL cholesterol" onChange={e => setTarget(e.target.value)} />
        </label>
        {merging && <p className="text-[11px] text-muted-foreground mt-2">Results from both will share one chart. If they use different units, the chart shows the newest unit and says how many it left out.</p>}

        <div className="flex gap-2 mt-5">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save} disabled={!name || name === marker || rename.isPending}>
            {rename.isPending ? "Saving..." : merging ? "Merge" : "Rename"}
          </Button>
        </div>
      </div>
    </div>
  );
}
