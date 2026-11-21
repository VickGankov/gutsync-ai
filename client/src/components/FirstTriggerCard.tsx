// Home card: the path from "just started" to a first confirmed trigger, with one next step.
// Honest by design: a pattern is "possible" until a clean 3-day test reacts, and the card says so.

import { useMemo } from "react";
import { Link } from "wouter";
import { ArrowRight, Check, FlaskConical } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function FirstTriggerCard() {
  const tz = useMemo(() => new Date().getTimezoneOffset(), []);
  const q = trpc.insights.firstTrigger.useQuery({ tzOffsetMinutes: tz }, { staleTime: 30_000 });
  const d = q.data;
  if (!d || d.stage === "confirmed") return null;

  const current = d.steps.findIndex(s => !s.done);
  return (
    <section className="tc tc-symptoms border rounded-2xl p-4 mb-4" aria-label="Path to your first confirmed trigger">
      <div className="flex items-center gap-2 mb-3">
        <FlaskConical className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold">Your first confirmed trigger</h2>
        <span className="ml-auto text-[11px] text-muted-foreground">Step {Math.min(current < 0 ? d.steps.length : current + 1, d.steps.length)} of {d.steps.length}</span>
      </div>

      <ol className="flex gap-1.5 mb-3" aria-hidden>
        {d.steps.map((s, i) => (
          <li key={s.key} className={`h-1.5 flex-1 rounded-full ${s.done ? "bg-volt" : i === current ? "bg-primary/60" : "bg-muted"}`} />
        ))}
      </ol>

      <p className="font-display text-lg leading-snug">{d.headline}</p>
      <p className="text-xs text-muted-foreground mt-1">{d.detail}</p>

      {current >= 0 && d.steps[current] && d.stage === "building" && (
        <p className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1.5">
          <span className="font-semibold text-foreground">{d.steps[current].label}:</span> {d.steps[current].have}/{d.steps[current].need}
        </p>
      )}

      <details className="mt-3 text-xs group">
        <summary className="cursor-pointer text-muted-foreground list-none">All steps</summary>
        <ul className="mt-2 space-y-1.5">
          {d.steps.map(s => (
            <li key={s.key} className="flex items-start gap-2">
              <span className={`mt-0.5 h-4 w-4 rounded-full flex items-center justify-center shrink-0 ${s.done ? "bg-volt text-volt-foreground" : "border border-border"}`}>
                {s.done && <Check className="w-3 h-3" />}
              </span>
              <span className={s.done ? "text-muted-foreground" : ""}>{s.label}{!s.done && s.need > 1 ? ` (${s.have}/${s.need})` : ""}</span>
            </li>
          ))}
        </ul>
      </details>

      {d.cta && (
        <Link href={d.cta.href}>
          <div className="mt-3 flex items-center justify-between rounded-2xl bg-primary text-primary-foreground px-4 py-3 active:scale-[0.98] transition-transform cursor-pointer">
            <span className="text-sm font-medium">{d.cta.label}</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </Link>
      )}
    </section>
  );
}
