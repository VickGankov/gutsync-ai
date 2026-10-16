// Add a meal by hand: no photo, no AI, no scan used. Items, FODMAP level and ingredients are whatever you enter.

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { invalidateToday } from "@/lib/invalidateToday";

type MealType = "breakfast" | "lunch" | "dinner" | "snack";
type Level = "low" | "moderate" | "high";
interface Row { name: string; level: Level; contains: string; protein: string; fiber: string; open: boolean }

const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: "breakfast", label: "Breakfast" }, { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" }, { id: "snack", label: "Snack" },
];
const LEVELS: { id: Level; label: string }[] = [
  { id: "low", label: "Low" }, { id: "moderate", label: "Moderate" }, { id: "high", label: "High" },
];

const emptyRow = (): Row => ({ name: "", level: "low", contains: "", protein: "", fiber: "", open: false });

function toLocalInput(ms: number) {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 16);
}
function defaultMealType(): MealType {
  const h = new Date().getHours();
  return h < 11 ? "breakfast" : h < 15 ? "lunch" : h < 21 ? "dinner" : "snack";
}
const chip = (on: boolean) =>
  `px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
    on ? "bg-primary text-primary-foreground border-primary" : "bg-muted/60 text-muted-foreground border-transparent"
  }`;
const inputCls = "bg-background border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/30";

function num(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default function ManualMealSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: () => void }) {
  const utils = trpc.useUtils();
  const logManual = trpc.meals.logManual.useMutation();
  const [mealType, setMealType] = useState<MealType>(() => defaultMealType());
  const [eatenAt, setEatenAt] = useState<string | null>(null); // null = now
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [notes, setNotes] = useState("");

  if (!open) return null;

  const patch = (i: number, p: Partial<Row>) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const reset = () => { setRows([emptyRow()]); setNotes(""); setEatenAt(null); setMealType(defaultMealType()); };

  const save = () => {
    const filled = rows.filter(r => r.name.trim());
    if (filled.length === 0) return toast.error("Add at least one food");
    const ms = eatenAt ? Math.min(new Date(eatenAt).getTime(), Date.now()) : undefined;
    logManual.mutate(
      {
        mealType,
        foods: filled.map(r => ({
          name: r.name.trim().slice(0, 100),
          category: "other" as const,
          fodmap: r.level,
          hiddenIngredients: r.contains.split(",").map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 20),
          ...(num(r.protein) !== undefined ? { proteinGrams: Math.min(500, num(r.protein)!) } : {}),
          ...(num(r.fiber) !== undefined ? { fiberGrams: Math.min(200, num(r.fiber)!) } : {}),
        })),
        notes: notes.trim() || undefined,
        ...(ms ? { loggedAt: ms } : {}),
      },
      {
        onSuccess: () => {
          toast.success("Meal logged", { description: `${filled.length} item${filled.length > 1 ? "s" : ""} saved` });
          invalidateToday(utils);
          reset();
          onSaved?.();
          onClose();
        },
        onError: e => toast.error(e.message || "Failed to save meal"),
      },
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="bg-card rounded-t-3xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-5 pb-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-semibold">Add a meal</h2>
          <button onClick={onClose} aria-label="Close" className="p-1 text-muted-foreground"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Entered by hand, nothing is analyzed. FODMAP level and ingredients are your call.</p>

        <div className="flex gap-2 mb-4 flex-wrap">
          {MEAL_TYPES.map(m => <button key={m.id} onClick={() => setMealType(m.id)} className={chip(mealType === m.id)}>{m.label}</button>)}
        </div>

        <label className="block text-xs text-muted-foreground mb-4">
          When you ate
          <input
            type="datetime-local" className={`${inputCls} mt-1`}
            value={eatenAt ?? toLocalInput(Date.now())}
            max={toLocalInput(Date.now())} min={toLocalInput(Date.now() - 30 * 86_400_000)}
            onChange={e => setEatenAt(e.target.value || null)}
          />
        </label>

        <div className="space-y-3">
          {rows.map((r, i) => (
            <div key={i} className="rounded-xl bg-muted/50 p-3">
              <div className="flex gap-2">
                <input className={inputCls} placeholder="Food (e.g. Greek yogurt)" value={r.name} maxLength={100}
                  onChange={e => patch(i, { name: e.target.value })} />
                {rows.length > 1 && (
                  <button onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} aria-label="Remove item" className="p-2 text-muted-foreground">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                <span className="text-[11px] text-muted-foreground mr-1">FODMAP</span>
                {LEVELS.map(l => <button key={l.id} onClick={() => patch(i, { level: l.id })} className={chip(r.level === l.id)}>{l.label}</button>)}
              </div>
              <button onClick={() => patch(i, { open: !r.open })} className="text-xs text-primary font-medium mt-2.5">
                {r.open ? "Hide details" : "More details (ingredients, protein, fiber)"}
              </button>
              {r.open && (
                <div className="mt-2 space-y-2">
                  <input className={inputCls} placeholder="Contains, e.g. garlic, onion, lactose" value={r.contains}
                    onChange={e => patch(i, { contains: e.target.value })} />
                  <div className="grid grid-cols-2 gap-2">
                    <input className={inputCls} type="number" inputMode="decimal" min={0} placeholder="Protein (g)" value={r.protein}
                      onChange={e => patch(i, { protein: e.target.value })} />
                    <input className={inputCls} type="number" inputMode="decimal" min={0} placeholder="Fiber (g)" value={r.fiber}
                      onChange={e => patch(i, { fiber: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={() => setRows(rs => [...rs, emptyRow()])} disabled={rows.length >= 20}
          className="mt-3 w-full rounded-xl border border-dashed border-border py-2.5 text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Plus className="w-4 h-4" /> Add another item
        </button>

        <textarea className={`${inputCls} mt-3`} rows={2} placeholder="Notes (optional)" value={notes} maxLength={300}
          onChange={e => setNotes(e.target.value)} />

        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={save} disabled={logManual.isPending}>{logManual.isPending ? "Saving..." : "Save meal"}</Button>
        </div>
      </div>
    </div>
  );
}
