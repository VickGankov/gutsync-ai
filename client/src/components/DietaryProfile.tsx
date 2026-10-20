// Foods you suspect. GutSync flags them in your meals and counts how your own logs compare.
// It never decides on its own that something is a trigger.

import { Apple } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { SENSITIVITIES } from "@shared/sensitivities";

export default function DietaryProfile() {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery();
  const selected = me.data?.sensitivities ?? [];
  const save = trpc.profile.setSensitivities.useMutation({
    onMutate: async ({ keys }) => {
      await utils.auth.me.cancel();
      const prev = utils.auth.me.getData();
      if (prev) utils.auth.me.setData(undefined, { ...prev, sensitivities: keys });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) utils.auth.me.setData(undefined, ctx.prev); toast.error("Couldn't save. Try again."); },
    onSettled: () => utils.auth.me.invalidate(),
  });

  const toggle = (key: string) => {
    const next = selected.includes(key) ? selected.filter(k => k !== key) : [...selected, key];
    save.mutate({ keys: next });
  };

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-5 mb-5">
      <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
        <Apple className="w-4 h-4 text-coral" />
        Foods I suspect
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Tap any you already think bother you. GutSync will flag them in your meals and show how your own logs compare. Your logs, not this list, decide what counts as a trigger.
      </p>
      <div className="flex flex-wrap gap-2">
        {SENSITIVITIES.map(s => {
          const on = selected.includes(s.key);
          return (
            <button key={s.key} type="button" onClick={() => toggle(s.key)} aria-pressed={on} disabled={me.isLoading}
              className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${on ? "bg-primary text-primary-foreground border-primary" : "bg-muted border-border text-foreground"}`}>
              {s.label}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground mt-3">
        Matching is approximate: it looks for these words in food names and ingredient lists, so it can miss things or flag a look-alike.
      </p>
    </div>
  );
}
