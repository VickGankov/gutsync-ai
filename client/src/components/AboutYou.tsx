// Profile → About you: date of birth.

import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { ageOn, checkBirthDate } from "@shared/profileStats";

function formatDob(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function AboutYou() {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery();
  const [editing, setEditing] = useState(false);
  const [dob, setDob] = useState("");

  const saveDob = trpc.profile.setBirthDate.useMutation({
    onSuccess: async () => { await utils.auth.me.invalidate(); setEditing(false); toast.success("Date of birth saved."); },
    onError: e => toast.error(e.message || "Couldn't save."),
  });

  if (!me.data) return null;
  const u = me.data;
  const age = u.birthDate ? ageOn(u.birthDate, new Date()) : null;
  const dobOk = dob && checkBirthDate(dob) === "ok";

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
    </div>
  );
}
