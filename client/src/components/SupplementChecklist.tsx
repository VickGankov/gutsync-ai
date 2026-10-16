// The user's own supplement list. A checklist only: the app does not recommend or judge anything here.

import { useMemo, useState } from "react";
import { Pill, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { dateKeyOf } from "@shared/weekly";

const tz = () => new Date().getTimezoneOffset();
export const todayKey = () => dateKeyOf(Date.now(), tz());

/** Today's checklist state plus a toggle, shared by the Progress card and the Today card. */
export function useSupplements() {
  const utils = trpc.useUtils();
  const dateKey = useMemo(() => todayKey(), []);
  const query = trpc.supplement.list.useQuery({ dateKeys: [dateKey] });
  const toggle = trpc.supplement.toggle.useMutation({
    onMutate: async (vars) => {
      // Optimistic: a one-tap check should feel instant.
      await utils.supplement.list.cancel();
      const prev = utils.supplement.list.getData({ dateKeys: [dateKey] });
      utils.supplement.list.setData({ dateKeys: [dateKey] }, old => old && ({
        ...old,
        taken: vars.taken
          ? [...old.taken, { supplementId: vars.id, dateKey: vars.dateKey }]
          : old.taken.filter(t => !(t.supplementId === vars.id && t.dateKey === vars.dateKey)),
      }));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) utils.supplement.list.setData({ dateKeys: [dateKey] }, ctx.prev); toast.error("Couldn't save that. Try again."); },
    onSettled: () => utils.supplement.list.invalidate(),
  });
  const items = query.data?.items ?? [];
  const takenIds = new Set((query.data?.taken ?? []).filter(t => t.dateKey === dateKey).map(t => t.supplementId));
  return {
    items, takenIds, dateKey, isLoading: query.isLoading,
    toggle: (id: number) => toggle.mutate({ id, dateKey, taken: !takenIds.has(id) }),
  };
}

export default function SupplementChecklist() {
  const utils = trpc.useUtils();
  const { items, takenIds, toggle, dateKey } = useSupplements();
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draftDose, setDraftDose] = useState("");
  const add = trpc.supplement.add.useMutation({
    onSuccess: () => { setName(""); setDose(""); utils.supplement.list.invalidate(); },
    onError: e => toast.error(e.message),
  });
  const setDoseMut = trpc.supplement.setDose.useMutation({
    onSuccess: () => { setEditing(null); utils.supplement.list.invalidate(); },
    onError: () => toast.error("Couldn't save the dose."),
  });
  const remove = trpc.supplement.remove.useMutation({ onSuccess: () => utils.supplement.list.invalidate() });

  return (
    <section id="supplements" className="bg-card border border-border/60 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <Pill className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">Supplements</h2>
        {items.length > 0 && <span className="text-xs text-muted-foreground ml-auto">{takenIds.size} / {items.length} today</span>}
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">Your own list: tick what you took today. The optional dose is saved with each day, so dose changes show next to your blood work. No recommendations here.</p>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground mb-3">Add the things you take, like magnesium, electrolytes or creatine.</p>
      ) : (
        <div className="space-y-1.5 mb-3">
          {items.map(i => {
            const on = takenIds.has(i.id);
            return (
              <div key={i.id} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle(i.id)}
                  className={`flex-1 flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-left border transition-colors ${on ? "bg-primary/10 border-primary/30 text-foreground" : "bg-muted/40 border-transparent text-muted-foreground"}`}
                  aria-pressed={on}
                >
                  <span className={`w-5 h-5 rounded-md border flex items-center justify-center text-xs ${on ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>{on ? "✓" : ""}</span>
                  <span className="flex-1 min-w-0 truncate">{i.name}</span>
                </button>
                {editing === i.id ? (
                  <form className="flex gap-1" onSubmit={e => { e.preventDefault(); setDoseMut.mutate({ id: i.id, dose: draftDose, dateKey }); }}>
                    <input autoFocus value={draftDose} onChange={e => setDraftDose(e.target.value)} maxLength={40} placeholder="e.g. 2000 IU" aria-label={`Dose for ${i.name}`}
                      className="bg-background border border-border rounded-lg px-2 py-1.5 text-xs w-24 focus:outline-none focus:ring-2 focus:ring-primary/30" />
                    <button type="submit" className="px-2 rounded-lg bg-primary text-primary-foreground text-xs">Save</button>
                  </form>
                ) : (
                  <button type="button" onClick={() => { setEditing(i.id); setDraftDose(i.dose ?? ""); }}
                    className="text-[11px] text-muted-foreground px-2 py-1.5 rounded-lg bg-muted/50 max-w-[6.5rem] truncate" aria-label={`Set dose for ${i.name}`}>
                    {i.dose ?? "+ dose"}
                  </button>
                )}
                <button type="button" onClick={() => remove.mutate({ id: i.id })} className="p-2 text-muted-foreground" aria-label={`Remove ${i.name}`}><X className="w-4 h-4" /></button>
              </div>
            );
          })}
        </div>
      )}

      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (name.trim()) add.mutate({ name: name.trim(), dose: dose.trim() || undefined }); }}>
        <input
          value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder="Add a supplement"
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <input
          value={dose} onChange={e => setDose(e.target.value)} maxLength={40} placeholder="Dose (optional)" aria-label="Dose (optional)"
          className="bg-background border border-border rounded-lg px-3 py-2 text-sm w-32 shrink-0 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button type="submit" disabled={!name.trim() || add.isPending} className="px-3 rounded-lg bg-primary text-primary-foreground disabled:opacity-40" aria-label="Add"><Plus className="w-4 h-4" /></button>
      </form>
    </section>
  );
}
