// A dropdown to choose which blood marker to look at: searchable, grouped by category or A-Z,
// with out-of-range markers pulled to the top. Each row shows the latest value so you can scan.

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { groupMarkers, type GroupMode } from "@shared/labGroups";
import type { RangeStatus } from "@shared/labs";

export interface MarkerOption { marker: string; status: RangeStatus | null; value: string; unit: string }

const KEY = "tp_marker_group";
const STATUS_DOT: Record<string, string> = { above: "oklch(0.7 0.15 25)", below: "oklch(0.7 0.15 25)", in: "oklch(0.58 0.14 125)" };
const readMode = (): GroupMode => { try { return localStorage.getItem(KEY) === "alpha" ? "alpha" : "category"; } catch { return "category"; } };

function Dot({ status }: { status: RangeStatus | null }) {
  return <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: status ? STATUS_DOT[status] : "transparent", border: status ? "none" : "1px solid oklch(0.75 0.01 80)" }} />;
}
const statusWord = (s: RangeStatus | null) => (s === "above" ? "above range" : s === "below" ? "below range" : s === "in" ? "in range" : "no range");

export default function MarkerPicker({ options, selected, onSelect }: { options: MarkerOption[]; selected: string | null; onSelect: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<GroupMode>(readMode);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const current = options.find(o => o.marker === selected) ?? null;
  const groups = useMemo(() => groupMarkers(options, mode, query), [options, mode, query]);
  const showSearch = options.length > 8;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    if (showSearch) searchRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, showSearch]);

  const chooseMode = (m: GroupMode) => { setMode(m); try { localStorage.setItem(KEY, m); } catch { /* private mode */ } };
  const close = () => { setOpen(false); setQuery(""); };

  return (
    <div className="relative mb-2">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-left">
        {current && <Dot status={current.status} />}
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{current?.marker ?? "Choose a marker"}</span>
        {current && <span className="shrink-0 text-xs text-muted-foreground">{current.value} {current.unit}</span>}
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} />
          <div role="listbox" aria-label="Blood markers" className="absolute left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
            <div className="flex items-center gap-2 border-b border-border/60 p-2">
              {showSearch && (
                <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5">
                  <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search" aria-label="Search markers"
                    className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none" />
                </label>
              )}
              <div className={`flex shrink-0 rounded-lg bg-muted p-0.5 text-[11px] font-medium ${showSearch ? "" : "ml-auto"}`} role="group" aria-label="Group by">
                {([["category", "Category"], ["alpha", "A–Z"]] as const).map(([m, label]) => (
                  <button key={m} type="button" aria-pressed={mode === m} onClick={() => chooseMode(m)}
                    className={`rounded-md px-2.5 py-1 ${mode === m ? "bg-card shadow-sm" : "text-muted-foreground"}`}>{label}</button>
                ))}
              </div>
            </div>

            <div className="max-h-[55vh] overflow-y-auto pb-1">
              {groups.length === 0 && <p className="px-3 py-4 text-xs text-muted-foreground">No marker matches "{query}".</p>}
              {groups.map(g => (
                <div key={g.title}>
                  <p className="sticky top-0 bg-card/95 px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                    {g.title}{g.title === "Needs attention" && <span className="font-normal normal-case tracking-normal"> · outside the range on your report</span>}
                  </p>
                  {g.items.map(o => (
                    <button key={o.marker} type="button" role="option" aria-selected={o.marker === selected} aria-label={`${o.marker}, ${o.value} ${o.unit}, ${statusWord(o.status)}`}
                      onClick={() => { onSelect(o.marker); close(); }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${o.marker === selected ? "bg-muted" : "hover:bg-muted/60"}`}>
                      <Dot status={o.status} />
                      <span className="min-w-0 flex-1 truncate">{o.marker}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{o.value} {o.unit}</span>
                      {o.marker === selected && <Check className="h-4 w-4 shrink-0" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
