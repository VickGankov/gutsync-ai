// Triggerplate — FODMAP Reintroduction Challenge
// Test one FODMAP group over 3 days with increasing amounts, check in daily,
// and build a personal tolerance map.

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, FlaskConical, Check, Share2, Loader2, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { friendlyPlanError } from "@shared/plans";
import {
  REINTRO_GROUPS,
  REINTRO_GROUP_INFO,
  WASHOUT_DAYS,
  currentChallengeDay,
  type ReintroGroup,
  type ReintroOutcome,
} from "@shared/reintro";

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const OUTCOME_STYLE: Record<ReintroOutcome, { label: string; cls: string }> = {
  tolerated: { label: "Tolerated", cls: "bg-sage-light/60 text-sage-dark" },
  limit: { label: "Limit", cls: "bg-amber-100 text-amber-800" },
  avoid: { label: "Avoid for now", cls: "bg-coral-light/60 text-coral" },
};

const SEVERITY_LABELS = ["None", "Very mild", "Mild", "Moderate", "Strong", "Severe"];
const DAY_MS = 86_400_000;

const inputCls =
  "bg-background border border-border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/30";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <motion.section variants={item} className={`bg-card border border-border/60 rounded-2xl p-4 mb-4 ${className}`}>{children}</motion.section>;
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex-1 text-xs font-medium px-3 py-2 rounded-xl border transition-colors ${
        checked ? "bg-primary/10 border-primary/40 text-primary" : "bg-background border-border text-muted-foreground"
      }`}
    >
      {checked && <Check className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />}
      {label}
    </button>
  );
}

export default function Reintro() {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const tzOffsetMinutes = useMemo(() => new Date().getTimezoneOffset(), []);

  const listQuery = trpc.reintro.list.useQuery(undefined, { enabled: isAuthenticated });
  const refresh = () => utils.reintro.list.invalidate();
  const start = trpc.reintro.start.useMutation({ onSuccess: refresh });
  const checkIn = trpc.reintro.checkIn.useMutation({ onSuccess: refresh });
  const abandon = trpc.reintro.abandon.useMutation({ onSuccess: refresh });

  const [picking, setPicking] = useState<ReintroGroup | null>(null);
  const [setup, setSetup] = useState({ testFood: "", doses: ["", "", ""] as [string, string, string] });
  const [form, setForm] = useState({ severity: -1, ateDose: true, stressed: false, poorSleep: false, note: "" });

  const challenges = listQuery.data ?? [];
  const active = challenges.find(c => c.status === "active");
  const completed = challenges.filter(c => c.status === "completed");

  // Latest completed result per group = the tolerance map.
  const latestByGroup = useMemo(() => {
    const map = new Map<string, (typeof completed)[number]>();
    for (const c of completed) if (!map.has(c.foodGroup)) map.set(c.foodGroup, c);
    return map;
  }, [completed]);

  const lastFinishedAt = completed[0]?.finishedAt ?? null;
  const washoutLeftDays = lastFinishedAt
    ? Math.max(0, Math.ceil((lastFinishedAt + WASHOUT_DAYS * DAY_MS - Date.now()) / DAY_MS))
    : 0;

  const openSetup = (group: ReintroGroup) => {
    const info = REINTRO_GROUP_INFO[group];
    setPicking(group);
    setSetup({ testFood: info.testFood, doses: [...info.doses] as [string, string, string] });
  };

  const startChallenge = () => {
    if (!picking) return;
    start.mutate(
      { foodGroup: picking, testFood: setup.testFood.trim(), doses: setup.doses.map(d => d.trim()) as [string, string, string] },
      {
        onSuccess: () => {
          setPicking(null);
          toast.success("Challenge started", { description: "Eat today's amount, then check in later today or tomorrow morning." });
        },
        onError: e => toast.error(friendlyPlanError(e.message)),
      },
    );
  };

  const submitCheckIn = (id: number, day: 1 | 2 | 3) => {
    if (form.severity < 0) return toast.error("Rate how your gut felt");
    checkIn.mutate(
      {
        id, day,
        severity: form.severity,
        ateDose: form.ateDose,
        stressed: form.stressed,
        poorSleep: form.poorSleep,
        ...(form.note.trim() ? { note: form.note.trim() } : {}),
        tzOffsetMinutes,
      },
      {
        onSuccess: ({ assessment }) => {
          setForm({ severity: -1, ateDose: true, stressed: false, poorSleep: false, note: "" });
          if (assessment) {
            toast.success(`Result: ${OUTCOME_STYLE[assessment.outcome].label}`, { description: assessment.reason });
          } else {
            toast.success(`Day ${day} logged`, { description: "Next amount tomorrow." });
          }
        },
        onError: e => toast.error(e.message),
      },
    );
  };

  const shareSummary = async () => {
    const lines = ["Triggerplate — FODMAP reintroduction results", ""];
    for (const g of REINTRO_GROUPS) {
      const c = latestByGroup.get(g);
      const info = REINTRO_GROUP_INFO[g];
      if (!c || !c.outcome) {
        lines.push(`${info.label}: not tested`);
        continue;
      }
      const doses = c.doses as [string, string, string];
      const detail =
        c.outcome === "limit" && c.toleratedDay ? ` (ok up to ${doses[c.toleratedDay - 1]} ${c.testFood})`
        : c.outcome === "tolerated" ? ` (${doses[2]} ${c.testFood})`
        : ` (reacted to ${doses[0]} ${c.testFood})`;
      const dateStr = c.finishedAt ? new Date(c.finishedAt).toLocaleDateString() : "";
      lines.push(`${info.label}: ${OUTCOME_STYLE[c.outcome].label}${detail} — ${dateStr}${c.lowConfidence ? " [low confidence: stress/sleep/missed dose]" : ""}`);
    }
    const text = lines.join("\n");
    try {
      if (navigator.share) await navigator.share({ title: "FODMAP reintroduction results", text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Summary copied", { description: "Paste it into a message to your dietitian." });
      }
    } catch {
      /* user cancelled share */
    }
  };

  if (listQuery.isLoading) {
    return <div className="flex justify-center pt-24"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  // ── Active challenge view ──
  let activeView: React.ReactNode = null;
  if (active) {
    const info = REINTRO_GROUP_INFO[active.foodGroup as ReintroGroup];
    const doses = active.doses as [string, string, string];
    const logged = active.checkIns ?? [];
    const dueDay = Math.min(3, currentChallengeDay(active.startedAt, Date.now(), tzOffsetMinutes));
    const nextDay = ([1, 2, 3] as const).find(d => !logged.some(c => c.day === d)) ?? null;
    const canCheckIn = nextDay !== null && nextDay <= dueDay;

    activeView = (
      <>
        <Card>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground">Active challenge</span>
            <span className="text-xs text-muted-foreground">Day {Math.min(dueDay, 3)} of 3</span>
          </div>
          <h2 className="text-lg font-semibold">{info?.emoji} {info?.label ?? active.foodGroup}</h2>
          <p className="text-sm text-muted-foreground">Test food: {active.testFood}</p>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {doses.map((dose, i) => {
              const day = (i + 1) as 1 | 2 | 3;
              const c = logged.find(x => x.day === day);
              const isToday = day === dueDay && !c;
              return (
                <div key={day} className={`rounded-xl p-2.5 text-center border ${isToday ? "border-primary bg-primary/5" : "border-border/60 bg-muted/40"}`}>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Day {day}</p>
                  <p className="text-sm font-semibold mt-0.5">{dose}</p>
                  <p className="text-[11px] mt-1 text-muted-foreground">
                    {c ? `${SEVERITY_LABELS[c.severity]}${c.ateDose ? "" : " · skipped"}` : isToday ? "Today" : "—"}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>

        {canCheckIn ? (
          <Card>
            <h3 className="text-sm font-semibold mb-1">Day {nextDay} check-in</h3>
            <p className="text-xs text-muted-foreground mb-3">
              After eating {doses[nextDay! - 1]} of {active.testFood}, how was your gut over the next ~24 hours?
            </p>
            <div className="grid grid-cols-6 gap-1.5">
              {SEVERITY_LABELS.map((label, i) => (
                <button
                  key={label}
                  onClick={() => setForm(f => ({ ...f, severity: i }))}
                  className={`rounded-lg py-2 text-sm font-semibold border transition-colors ${
                    form.severity === i
                      ? i >= 3 ? "bg-coral text-white border-coral" : "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border"
                  }`}
                  title={label}
                >
                  {i}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 h-4">{form.severity >= 0 ? SEVERITY_LABELS[form.severity] : "0 = none, 5 = severe"}</p>
            <div className="flex gap-2 mt-2">
              <Toggle checked={form.ateDose} onChange={v => setForm(f => ({ ...f, ateDose: v }))} label="Ate the amount" />
              <Toggle checked={form.stressed} onChange={v => setForm(f => ({ ...f, stressed: v }))} label="Stressed" />
              <Toggle checked={form.poorSleep} onChange={v => setForm(f => ({ ...f, poorSleep: v }))} label="Poor sleep" />
            </div>
            <input className={`${inputCls} mt-3`} placeholder="Note (optional)" value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            <Button className="w-full mt-3" onClick={() => submitCheckIn(active.id, nextDay!)} disabled={checkIn.isPending}>
              Save check-in
            </Button>
            <p className="text-[11px] text-muted-foreground mt-2 flex gap-1.5">
              <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
              A score of 3 or more stops the challenge so you don't increase the amount after a reaction.
            </p>
          </Card>
        ) : (
          <Card>
            <p className="text-sm">Day {nextDay} starts tomorrow. Eat {nextDay ? doses[nextDay - 1] : ""} of {active.testFood} and check in afterward.</p>
          </Card>
        )}

        <button
          className="text-xs text-muted-foreground underline w-full text-center mb-6"
          onClick={() => {
            if (confirm("Stop this challenge? Its check-ins won't count toward your results.")) {
              abandon.mutate({ id: active.id }, { onSuccess: () => toast("Challenge stopped") });
            }
          }}
        >
          Stop this challenge
        </button>
      </>
    );
  }

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <motion.div variants={item} className="mb-5">
        <Link href="/insights">
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mb-2"><ArrowLeft className="w-3.5 h-3.5" /> Insights</span>
        </Link>
        <h1 className="text-2xl tracking-tight flex items-center gap-2"><FlaskConical className="w-6 h-6 text-primary" /> Reintroduction</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Test one FODMAP group at a time to learn what you actually tolerate.</p>
      </motion.div>

      {activeView}

      {!active && !picking && (
        <Card className="bg-primary/5 border-primary/20">
          <h2 className="text-sm font-semibold mb-1.5">How it works</h2>
          <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
            <li>Stay on your low-FODMAP baseline and pick one group to test.</li>
            <li>Eat a small, then medium, then larger amount over 3 days.</li>
            <li>Check in daily. If symptoms hit 3/5, the test stops — no bigger amounts.</li>
            <li>Take {WASHOUT_DAYS} normal low-FODMAP days before the next group.</li>
          </ol>
          {washoutLeftDays > 0 && (
            <p className="text-xs text-amber-800 mt-3 flex gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
              Washout: wait {washoutLeftDays} more day{washoutLeftDays === 1 ? "" : "s"} before your next challenge so results don't overlap.
            </p>
          )}
        </Card>
      )}

      {picking && (
        <Card>
          <h2 className="text-sm font-semibold mb-3">{REINTRO_GROUP_INFO[picking].emoji} Test {REINTRO_GROUP_INFO[picking].label}</h2>
          <label className="text-xs text-muted-foreground">Test food
            <input className={`${inputCls} mt-1`} value={setup.testFood} onChange={e => setSetup(s => ({ ...s, testFood: e.target.value }))} />
          </label>
          <p className="text-[11px] text-muted-foreground mt-1">Other foods in this group: {REINTRO_GROUP_INFO[picking].examples}</p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            {setup.doses.map((d, i) => (
              <label key={i} className="text-xs text-muted-foreground">Day {i + 1}
                <input className={`${inputCls} mt-1`} value={d}
                  onChange={e => setSetup(s => { const doses = [...s.doses] as [string, string, string]; doses[i] = e.target.value; return { ...s, doses }; })} />
              </label>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">Amounts are starting suggestions. If you work with a dietitian, use theirs.</p>
          <div className="flex gap-2 mt-4">
            <Button variant="outline" className="flex-1" onClick={() => setPicking(null)}>Cancel</Button>
            <Button className="flex-1" onClick={startChallenge}
              disabled={start.isPending || !setup.testFood.trim() || setup.doses.some(d => !d.trim())}>
              Start day 1
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Your tolerance map</h2>
          {completed.length > 0 && (
            <button onClick={shareSummary} className="text-xs text-primary flex items-center gap-1">
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          )}
        </div>
        <div className="space-y-2">
          {REINTRO_GROUPS.map(g => {
            const info = REINTRO_GROUP_INFO[g];
            const c = latestByGroup.get(g);
            const isActive = active?.foodGroup === g;
            const selectable = !active && !picking;
            return (
              <button
                key={g}
                disabled={!selectable}
                onClick={() => openSetup(g)}
                className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
                  selectable ? "bg-muted/50 hover:bg-muted" : "bg-muted/30"
                }`}
              >
                <span className="text-sm">{info.emoji} {info.label}</span>
                {isActive ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">Testing</span>
                ) : c?.outcome ? (
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${OUTCOME_STYLE[c.outcome].cls}`}>
                    {OUTCOME_STYLE[c.outcome].label}
                    {c.outcome === "limit" && c.toleratedDay ? ` · ≤${(c.doses as string[])[c.toleratedDay - 1]}` : ""}
                    {c.lowConfidence ? " *" : ""}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">{selectable ? "Test →" : "Not tested"}</span>
                )}
              </button>
            );
          })}
        </div>
        {completed.some(c => c.lowConfidence) && (
          <p className="text-[11px] text-muted-foreground mt-2">* Stress, poor sleep or a skipped amount during the test — consider retesting.</p>
        )}
      </Card>

      <p className="text-[11px] text-center text-muted-foreground mb-4 px-4">
        For guidance only — not a diagnosis. Work with a dietitian or doctor where you can.
      </p>
    </motion.div>
  );
}
