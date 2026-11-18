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
        <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}
