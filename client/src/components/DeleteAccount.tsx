// Permanent account deletion, in Profile → Privacy & Data. Asks for the word DELETE (and the password for email accounts).

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const del = trpc.profile.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Your account and data were deleted.");
      window.location.href = "/";
    },
    onError: e => toast.error(e.message || "Couldn't delete the account."),
  });
  const ready = confirm.trim().toUpperCase() === "DELETE" && (!hasPassword || password.length > 0);

  return (
    <>
      <div className="flex items-center gap-3 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted"><Trash2 className="h-4 w-4 text-coral" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">Delete Account</p>
          <p className="text-xs text-muted-foreground">Permanently remove your account and all your data</p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className="text-xs font-semibold text-coral">Delete</button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="del-title">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-lg">
            <h2 id="del-title" className="text-lg font-semibold">Delete your account?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              This permanently deletes your meals, symptoms, labs, photos, settings, and account. It can't be undone.
              Download your data first with Export My Data if you want a copy.
            </p>
            {hasPassword && (
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Your password"
                autoComplete="current-password"
                className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              />
            )}
            <input
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Type DELETE to confirm"
              autoCapitalize="characters"
              autoCorrect="off"
              className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            />
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => { setOpen(false); setConfirm(""); setPassword(""); }} className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium">Cancel</button>
              <button
                type="button"
                disabled={!ready || del.isPending}
                onClick={() => del.mutate({ confirm, password: hasPassword ? password : undefined })}
                className="flex-1 rounded-xl bg-coral px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {del.isPending ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
