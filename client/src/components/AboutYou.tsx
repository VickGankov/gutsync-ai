// Profile → About you: date of birth, and the optional fitness tracking switch with goal and suggested targets.

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ageOn, checkBirthDate, FITNESS_GOALS, type FitnessGoal } from "@shared/profileStats";

function formatDob(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function AboutYou() {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery();
  const suggested = trpc.fitness.suggestedTargets.useQuery(undefined, { enabled: !!me.data?.fitnessEnabled });
  const [editing, setEditing] = useState(false);
  const [dob, setDob] = useState("");

  const saveDob = trpc.profile.setBirthDate.useMutation({
    onSuccess: async () => { await utils.auth.me.invalidate(); setEditing(false); toast.success("Date of birth saved."); },
    onError: e => toast.error(e.message || "Couldn't save."),
  });
  const setFitness = trpc.profile.setFitness.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.auth.me.invalidate(), utils.fitness.suggestedTargets.invalidate()]);
    },
    onError: e => toast.error(e.message || "Couldn't save."),
  });
  const setTargets = trpc.fitness.setProfile.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.fitness.profile.invalidate(), utils.fitness.summary.invalidate()]);
      toast.success("Targets updated.");
    },
    onError: e => toast.error(e.message || "Couldn't save."),
  });

  if (!me.data) return null;
  const u = me.data;
  const age = u.birthDate ? ageOn(u.birthDate, new Date()) : null;
  const dobOk = dob && checkBirthDate(dob) === "ok";
  const goal = (u.fitnessGoal ?? "general") as FitnessGoal;
  const sug = suggested.data?.suggestion;

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5">
      <p className="text-sm font-semibold mb-3">About you</p>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm">Date of birth</p>
          <p className="text-xs text-muted-foreground">{u.birthDate ? `${formatDob(u.birthDate)}${age !== null ? ` · ${age}` : ""}` : "Not set"}</p>
        </div>
        <button type="button" onClick={() => { setDob(u.birthDate ?? ""); setEditing(v => !v); }} className="text-xs font-semibold text-primary">
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>
      {editing && (
        <div className="mt-3 flex gap-2">
          <input type="date" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={e => setDob(e.target.value)}
            className="flex-1 min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm" aria-label="Date of birth" />
          <button type="button" disabled={!dobOk || saveDob.isPending} onClick={() => saveDob.mutate({ birthDate: dob })}
            className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50">Save</button>
        </div>
      )}

      <div className="mt-4 border-t border-border/50 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm">Fitness tracking</p>
            <p className="text-xs text-muted-foreground">Protein, water, weight and strength. Optional.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={u.fitnessEnabled}
            aria-label="Fitness tracking"
            onClick={() => setFitness.mutate({ enabled: !u.fitnessEnabled })}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${u.fitnessEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${u.fitnessEnabled ? "left-[22px]" : "left-0.5"}`} />
          </button>
        </div>

        {u.fitnessEnabled && (
          <div className="mt-4">
            <p className="text-xs font-medium mb-2">Your goal</p>
            <div className="grid grid-cols-3 gap-2">
              {FITNESS_GOALS.map(g => (
                <button key={g.key} type="button" aria-pressed={goal === g.key}
                  onClick={() => setFitness.mutate({ enabled: true, goal: g.key })}
                  className={`rounded-xl border px-2 py-2 text-xs font-medium ${goal === g.key ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  {g.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">{FITNESS_GOALS.find(g => g.key === goal)?.hint}.</p>

            {sug ? (
              <div className="mt-3 rounded-xl bg-muted/60 p-3">
                <p className="text-xs">
                  Suggested for {suggested.data!.weightLb} lb: <b>{sug.proteinG} g</b> protein and <b>{(sug.waterMl / 3785.41).toFixed(2)} gal</b> water a day.
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">A common starting point, not medical advice. You can set your own in Progress.</p>
                <button type="button" disabled={setTargets.isPending}
                  onClick={() => setTargets.mutate({ proteinTargetG: sug.proteinG, waterTargetMl: sug.waterMl })}
                  className="mt-2 rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-xs font-medium disabled:opacity-50">
                  Use these targets
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">Log a weight in Progress to get suggested protein and water targets.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
