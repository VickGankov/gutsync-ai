// Blood work: how a marker moves over time, next to when you were taking what.
// Shows timing only. It never says a supplement or dose caused a change.

import { useMemo, useRef, useState } from "react";
import { FlaskConical, Plus, Upload, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceArea, ReferenceLine } from "recharts";
import { trpc } from "@/lib/trpc";
import { prepareImageForUpload } from "@/lib/image";
import LabEntrySheet from "@/components/LabEntrySheet";
import LabImportSheet, { type Draft } from "@/components/LabImportSheet";
import { changeSincePrevious, daysBetween, pointsInLatestUnit, positionOf, rangeStatus, type Run } from "@shared/labs";
import { dateKeyOf } from "@shared/weekly";

const PRIMARY = "oklch(0.55 0.1 155)";
const MS_DAY = 86_400_000;
const keyToMs = (k: string) => Date.parse(`${k}T00:00:00Z`);
const msToKey = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const short = (k: string) => { const [y, m, d] = k.split("-"); return `${Number(m)}/${Number(d)}/${y.slice(2)}`; };
const fmt = (n: number) => (Math.abs(n) >= 100 ? Math.round(n) : Math.round(n * 100) / 100).toString();
const MAX_PDF_BYTES = 9 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve((r.result as string).split(",")[1] ?? "");
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function RunsStrip({ runs, fromKey, toKey, drawDates }: { runs: Run[]; fromKey: string; toKey: string; drawDates: string[] }) {
  // One row per supplement or compound; a dose change shows as a new segment.
  const rows = useMemo(() => {
    const m = new Map<string, Run[]>();
    runs.forEach(r => m.set(`${r.kind}:${r.label}`, [...(m.get(`${r.kind}:${r.label}`) ?? []), r]));
    return Array.from(m.entries()).map(([k, rs]) => ({ key: k, label: rs[0].label, kind: rs[0].kind, runs: rs }));
  }, [runs]);

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground mt-3">No supplements or doses logged in this period. Tick supplements on the Protocol tab, or log doses, to see them here.</p>;
  }
  return (
    <div className="mt-3">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5">What you were taking</p>
      <div className="space-y-2.5">
        {rows.map(row => (
          <div key={row.key}>
            <div className="flex items-baseline justify-between gap-2 text-xs mb-1">
              <span className="font-medium truncate">{row.label}</span>
              <span className="text-muted-foreground text-[10px] shrink-0">
                {row.runs.map(r => r.dose).filter((d, i, a) => d && a.indexOf(d) === i).join(" → ")}
              </span>
            </div>
            <div className="relative h-3 rounded-full bg-muted/60">
              {row.runs.map((r, i) => {
                const left = positionOf(r.startOn, fromKey, toKey) * 100;
                const right = positionOf(r.endOn, fromKey, toKey) * 100;
                return (
                  <div key={i} title={`${r.label}${r.dose ? ` · ${r.dose}` : ""}: ${short(r.startOn)} to ${short(r.endOn)}`}
                    className={`absolute top-0 h-3 rounded-full ${row.kind === "compound" ? "bg-coral/70" : "bg-primary/70"}`}
                    style={{ left: `${left}%`, width: `max(${right - left}%, 6px)`, opacity: i % 2 ? 0.55 : 1 }} />
                );
              })}
              {drawDates.map(d => (
                <div key={d} className="absolute top-[-3px] bottom-[-3px] w-px bg-foreground/30" style={{ left: `${positionOf(d, fromKey, toKey) * 100}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">Thin vertical lines are blood draws. Lighter segments mark a dose change or a break.</p>
    </div>
  );
}

export default function LabsPanel() {
  const utils = trpc.useUtils();
  const labs = trpc.labs.list.useQuery();
  const extract = trpc.labs.extract.useMutation();
  const del = trpc.labs.delete.useMutation({ onSuccess: () => utils.labs.list.invalidate() });
  const fileRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const tz = useMemo(() => new Date().getTimezoneOffset(), []);

  const rows = labs.data ?? [];
  const markers = useMemo(() => {
    const latest = new Map<string, string>();
    rows.forEach(r => { if (!latest.has(r.marker) || r.drawnOn > latest.get(r.marker)!) latest.set(r.marker, r.drawnOn); });
    return Array.from(latest.entries()).sort((a, b) => b[1].localeCompare(a[1])).map(([m]) => m);
  }, [rows]);
  const marker = picked && markers.includes(picked) ? picked : markers[0] ?? null;
  const mine = useMemo(() => rows.filter(r => r.marker === marker), [rows, marker]);
  const { points, unit, skipped } = useMemo(() => pointsInLatestUnit(mine), [mine]);
  const latest = points[points.length - 1];
  const change = useMemo(() => changeSincePrevious(points), [points]);

  // Chart window: a month before the first draw to a week after the last (at most to today).
  const today = dateKeyOf(Date.now(), tz);
  const fromKey = points.length ? msToKey(keyToMs(points[0].drawnOn) - 30 * MS_DAY) : today;
  const toKey = points.length ? msToKey(Math.min(keyToMs(today), keyToMs(latest.drawnOn) + 7 * MS_DAY)) : today;
  const overlay = trpc.labs.overlay.useQuery({ fromKey, toKey, tzOffsetMinutes: tz }, { enabled: points.length > 0 });

  const lastUnitFor = (m: string) => {
    const hit = [...rows].reverse().find(r => r.marker.toLowerCase() === m.trim().toLowerCase());
    return hit?.unit ?? null;
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      let base64: string, mimeType: string;
      if (file.type === "application/pdf") {
        if (file.size > MAX_PDF_BYTES) { toast.error("That PDF is too large. Try a smaller file or a screenshot."); return; }
        base64 = await fileToBase64(file); mimeType = "application/pdf";
      } else {
        ({ base64, mimeType } = await prepareImageForUpload(file, 2200));
      }
      const res = await extract.mutateAsync({ fileBase64: base64, mimeType });
      setDraft({
        collectedOn: res.collectedOn, skipped: res.skipped,
        rows: res.rows.map(r => ({ marker: r.marker, value: String(r.value), unit: r.unit, refLow: r.refLow == null ? "" : String(r.refLow), refHigh: r.refHigh == null ? "" : String(r.refHigh) })),
      });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      toast.error(msg.startsWith("FREE_LIMIT_REACHED") ? "You've used today's free scans. Enter the values by hand, or try again tomorrow." : msg || "Couldn't read that file.");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const status = latest ? rangeStatus(latest.value, latest.refLow, latest.refHigh) : null;
  // The scale follows your values, not the range, so a wide lab range can't flatten the line. The band is clipped to what's visible.
  const vals = points.map(p => p.value);
  const vMin = vals.length ? Math.min(...vals) : 0, vMax = vals.length ? Math.max(...vals) : 1;
  const pad = (vMax - vMin || Math.abs(vMax) || 1) * 0.25;
  const dMin = vMin - pad, dMax = vMax + pad;
  const bandLo = Math.max(latest?.refLow ?? dMin, dMin), bandHi = Math.min(latest?.refHigh ?? dMax, dMax);

  return (
    <section className="bg-card border border-border/60 rounded-2xl p-4 mb-4">
      <div className="flex items-center gap-2 mb-1">
        <FlaskConical className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">Blood work</h2>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">
        Track how a marker moves next to what you were taking. This shows timing only, and can't tell you what caused a change. Not medical advice: ranges are the ones printed on your own report.
      </p>

      <div className="flex gap-2 mb-3">
        <button type="button" onClick={() => setEntryOpen(true)} className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add result
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={extract.isPending}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-border py-2.5 text-sm font-medium disabled:opacity-60">
          {extract.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {extract.isPending ? "Reading..." : "Import report"}
        </button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
      </div>

      {labs.isLoading ? null : markers.length === 0 ? (
        <p className="text-xs text-muted-foreground">No results yet. Import a report (photo, screenshot or text PDF) or add a value by hand. Importing counts as one scan.</p>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {markers.map(m => (
              <button key={m} type="button" onClick={() => setPicked(m)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border ${m === marker ? "bg-primary text-primary-foreground border-primary" : "bg-muted/60 text-muted-foreground border-transparent"}`}>
                {m}
              </button>
            ))}
          </div>

          {latest && (
            <>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-semibold">{fmt(latest.value)}</span>
                <span className="text-xs text-muted-foreground">{unit} · {short(latest.drawnOn)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {status === "in" && `Within the range on your report (${latest.refLow ?? "…"}–${latest.refHigh ?? "…"}).`}
                {status === "below" && `Below the range on your report (${latest.refLow ?? "…"}–${latest.refHigh ?? "…"}).`}
                {status === "above" && `Above the range on your report (${latest.refLow ?? "…"}–${latest.refHigh ?? "…"}).`}
                {status === null && "No range entered for this result."}
                {change && ` ${change.delta >= 0 ? "+" : ""}${fmt(change.delta)} ${unit}${change.pct != null ? ` (${change.pct >= 0 ? "+" : ""}${Math.round(change.pct)}%)` : ""} since ${short(change.fromOn)}.`}
              </p>
              {status && status !== "in" && <p className="text-[11px] text-muted-foreground mt-1">Worth mentioning to your doctor if you haven't already.</p>}

              {points.length >= 2 ? (
                <div className="h-36 mt-3">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={points.map(p => ({ t: keyToMs(p.drawnOn), v: p.value }))} margin={{ top: 14, right: 8, bottom: 0, left: 8 }}>
                      <XAxis type="number" dataKey="t" domain={[keyToMs(fromKey), keyToMs(toKey)]} hide />
                      <YAxis hide domain={[dMin, dMax]} />
                      {(latest.refLow != null || latest.refHigh != null) && bandLo < bandHi && (
                        <ReferenceArea y1={bandLo} y2={bandHi} fill={PRIMARY} fillOpacity={0.1} />
                      )}
                      {latest.refLow != null && latest.refLow > dMin && latest.refLow < dMax && <ReferenceLine y={latest.refLow} stroke={PRIMARY} strokeOpacity={0.35} strokeDasharray="3 3" />}
                      {latest.refHigh != null && latest.refHigh > dMin && latest.refHigh < dMax && <ReferenceLine y={latest.refHigh} stroke={PRIMARY} strokeOpacity={0.35} strokeDasharray="3 3" />}
                      <Line type="monotone" dataKey="v" stroke={PRIMARY} strokeWidth={2} dot={{ r: 3.5, fill: PRIMARY }} isAnimationActive={false}
                        label={{ position: "top", fontSize: 10, fill: "currentColor", formatter: (v: number) => fmt(v) }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground mt-3">One result so far. Add another to see how it moves.</p>
              )}
              {points.length >= 1 && (
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1"><span>{short(fromKey)}</span><span>{short(toKey)}</span></div>
              )}
              {skipped > 0 && <p className="text-[11px] text-amber-700 mt-1">{skipped} older result{skipped === 1 ? " uses" : "s use"} a different unit and {skipped === 1 ? "isn't" : "aren't"} on the chart.</p>}

              <RunsStrip runs={overlay.data?.runs ?? []} fromKey={fromKey} toKey={toKey} drawDates={points.map(p => p.drawnOn)} />
              {points.length >= 2 && daysBetween(points[0].drawnOn, latest.drawnOn) > 0 && points.length < 3 && (
                <p className="text-[11px] text-muted-foreground mt-2">With only {points.length} results, treat any pattern as a hint at most.</p>
              )}
            </>
          )}

          <div className="mt-4 border-t border-border/50 pt-2">
            {[...mine].reverse().map(r => (
              <div key={r.id} className="flex items-center gap-2 py-1.5 text-xs">
                <span className="text-muted-foreground w-16 shrink-0">{short(r.drawnOn)}</span>
                <span className="font-medium">{fmt(r.value)} {r.unit}</span>
                {(r.refLow != null || r.refHigh != null) && <span className="text-muted-foreground">({r.refLow ?? "…"}–{r.refHigh ?? "…"})</span>}
                <button type="button" aria-label="Delete result"
                  onClick={() => { if (confirmId === r.id) { del.mutate({ id: r.id }); setConfirmId(null); } else setConfirmId(r.id); }}
                  className={`ml-auto p-1.5 rounded ${confirmId === r.id ? "bg-red-500 text-white" : "text-muted-foreground"}`}>
                  {confirmId === r.id ? <span className="text-[10px] px-1">Confirm</span> : <Trash2 className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <LabEntrySheet open={entryOpen} onClose={() => setEntryOpen(false)} knownMarkers={markers} lastUnitFor={lastUnitFor} presetMarker={marker} />
      {draft && <LabImportSheet key={JSON.stringify(draft.rows.length) + (draft.collectedOn ?? "")} draft={draft} onClose={() => setDraft(null)} />}
    </section>
  );
}
