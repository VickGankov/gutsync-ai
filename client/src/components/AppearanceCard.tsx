import { Moon, Sun, Smartphone } from "lucide-react";
import { useTheme, type ThemePreference } from "@/contexts/ThemeContext";

const OPTIONS: { id: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { id: "light", label: "Light", Icon: Sun },
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "system", label: "Auto", Icon: Smartphone },
];

export default function AppearanceCard() {
  const { preference, setPreference } = useTheme();
  return (
    <div className="tc tc-warm rounded-2xl border shadow-sm p-5 mb-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Appearance</p>
          <p className="text-xs text-muted-foreground">Auto follows your phone's setting.</p>
        </div>
        <div role="radiogroup" aria-label="Appearance" className="flex gap-1 rounded-full border border-border bg-background p-1">
          {OPTIONS.map(({ id, label, Icon }) => {
            const on = preference === id;
            return (
              <button key={id} type="button" role="radio" aria-checked={on} onClick={() => setPreference(id)}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${on ? "bg-primary text-primary-foreground" : "text-[var(--action)]"}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
