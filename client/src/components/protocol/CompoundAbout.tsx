// "About this compound" block inside a compound card: what it's studied for, what people report,
// and tap-to-log chips for the effects worth tracking. Static reference text, no advice, no dosing.

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getSymptomEmoji, getSymptomLabel } from "@/lib/store";
import Disclosure from "@/components/Disclosure";
import { infoFor, trackFor } from "@shared/compoundInfo";
import { NEGATIVE_SYMPTOMS } from "@shared/dose";

type SymptomType = Parameters<ReturnType<typeof trpc.symptoms.log.useMutation>["mutate"]>[0]["type"];

function List({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5">{label}</p>
      <p className="text-xs leading-snug">{items.join(" · ")}</p>
    </div>
  );
}

export default function CompoundAbout({ name }: { name: string }) {
  const { parts, known, unknown, blend } = infoFor(name);
  const utils = trpc.useUtils();
  const [picked, setPicked] = useState<string | null>(null);
  const log = trpc.symptoms.log.useMutation({
    onSuccess: (_r, v) => {
      utils.symptoms.list.invalidate();
      toast.success(`${getSymptomLabel(v.type)} logged`);
      setPicked(null);
    },
    onError: e => toast.error(e.message),
  });
  const track = trackFor(known, blend);
  const multi = known.length > 1;
  const isBlend = parts.length > 1;

  return (
    <Disclosure title={`About ${isBlend ? "this blend" : name}`} hint={isBlend ? `${parts.length} parts` : undefined} className="mt-2 border-t border-border/50">
      <div className="space-y-3">
        <p className="text-[11px] text-muted-foreground leading-snug">
          Anecdotal reports only, and several of the most active posters are tied to vendors. Not proven and not medical advice. Talk to your doctor. Logs show timing, not cause.
        </p>
        {blend && (
          <div className="space-y-2">
            <p className="text-sm font-medium">{blend.name}</p>
            <List label="Benefits" items={blend.benefits} />
            <List label="Side effects" items={blend.sideEffects} />
            <List label="Independent members report" items={blend.members ?? []} />
          </div>
        )}
        {known.map(i => {
          const full = !blend || i.owner;
          if (!full && !i.members?.length) return null;
          return (
            <div key={i.key} className="space-y-2">
              {(blend || multi) && <p className="text-sm font-medium">{i.name}</p>}
              {full && <List label="Benefits" items={i.benefits} />}
              {full && <List label="Side effects" items={i.sideEffects} />}
              <List label="Independent members report" items={i.members ?? []} />
            </div>
          );
        })}
        {unknown.length > 0 && (
          <p className="text-xs text-muted-foreground">No notes yet for {unknown.join(", ")}.</p>
        )}

        {track.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">Worth tracking</p>
            <div className="flex flex-wrap gap-1.5">
              {track.map(t => (
                <button key={t} type="button" onClick={() => setPicked(picked === t ? null : t)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
                    picked === t ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border/60"
                  }`}>
                  {getSymptomEmoji(t)} {getSymptomLabel(t)}
                </button>
              ))}
            </div>
            {picked && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground mr-1">{NEGATIVE_SYMPTOMS.has(picked) ? "How bad?" : "How much?"}</span>
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" disabled={log.isPending}
                    onClick={() => log.mutate({ type: picked as SymptomType, severity: n })}
                    className="h-8 w-8 rounded-full bg-background border border-border/60 text-xs font-medium">{n}</button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Disclosure>
  );
}
