// A collapsed-by-default section: a one-line header the person can tap to reveal the detail.
// Keeps secondary information out of the way without hiding that it exists.

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export default function Disclosure({ title, hint, defaultOpen = false, className = "", children }: {
  title: string;
  /** Short text on the right of the header (a count, a latest value). Shown whether open or closed. */
  hint?: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2 py-2 text-left text-xs font-semibold">
        <span>{title}</span>
        {hint != null && <span className="font-normal text-muted-foreground">{hint}</span>}
        <span className="ml-auto grid h-6 w-6 place-items-center rounded-full border border-[color-mix(in_oklab,var(--action)_35%,var(--border))] bg-card shadow-sm"><ChevronDown className={`h-3.5 w-3.5 text-[var(--action)] transition-transform ${open ? "rotate-180" : ""}`} /></span>
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}
