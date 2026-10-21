// Scroll-wheel date picker (month / day / year), like the phone date wheels.
// `value` is "YYYY-MM-DD", or "" until the person has scrolled all three columns.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ITEM = 40;            // row height in px
const ROWS = 5;             // visible rows (the middle one is selected)
const PAD = ITEM * ((ROWS - 1) / 2);

const daysIn = (year: number, monthIdx: number) => new Date(year, monthIdx + 1, 0).getDate();

function Wheel({ label, items, index, touched, onPick, className = "" }: {
  label: string; items: string[]; index: number; touched: boolean; onPick: (i: number) => void; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const programmatic = useRef(false);
  const [live, setLive] = useState(index);

  // Move the wheel when the selected row changes from outside (initial value, day clamped, saved date loaded).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setLive(index);
    if (Math.abs(el.scrollTop - index * ITEM) > 1) {
      programmatic.current = true;
      el.scrollTop = index * ITEM;
      window.setTimeout(() => { programmatic.current = false; }, 80);
    }
  }, [index, items.length]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onScroll = () => {
    const el = ref.current;
    if (!el || programmatic.current) return;
    const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM)));
    setLive(i);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onPick(i), 110);
  };

  const goTo = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, i));
    ref.current?.scrollTo({ top: clamped * ITEM, behavior: "smooth" });
  }, [items.length]);

  return (
    <div className={`relative ${className}`} style={{ height: ITEM * ROWS }}>
      <div
        ref={ref}
        role="listbox"
        aria-label={label}
        tabIndex={0}
        onScroll={onScroll}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); goTo(live + 1); }
          if (e.key === "ArrowUp") { e.preventDefault(); goTo(live - 1); }
        }}
        className="h-full overflow-y-scroll outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{
          scrollSnapType: "y mandatory",
          overscrollBehavior: "contain",
          WebkitOverflowScrolling: "touch",
          maskImage: "linear-gradient(to bottom, transparent, black 28%, black 72%, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent, black 28%, black 72%, transparent)",
        }}
      >
        <div style={{ height: PAD }} aria-hidden />
        {items.map((t, i) => (
          <div
            key={`${t}-${i}`}
            role="option"
            aria-selected={i === live}
            onClick={() => goTo(i)}
            className={`flex items-center justify-center text-base transition-colors ${
              i === live ? (touched ? "font-semibold text-foreground" : "font-medium text-muted-foreground") : "text-muted-foreground/70"
            }`}
            style={{ height: ITEM, scrollSnapAlign: "center" }}
          >
            {t}
          </div>
        ))}
        <div style={{ height: PAD }} aria-hidden />
      </div>
    </div>
  );
}

export default function BirthDateSelect({ value, onChange }: { value: string; onChange: (v: string) => void; idPrefix?: string }) {
  const now = new Date();
  const thisYear = now.getFullYear();
  const years = useMemo(() => Array.from({ length: thisYear - 1899 }, (_, i) => String(thisYear - i)), [thisYear]);

  // Start on a plausible adult date; nothing counts until each column has been scrolled.
  const [sel, setSel] = useState({ m: 0, d: 0, y: 30 });
  const [touched, setTouched] = useState({ m: false, d: false, y: false });

  // A saved date loaded from outside (editing in Profile) fills all three columns.
  useEffect(() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (!m) return;
    const next = { m: Number(m[2]) - 1, d: Number(m[3]) - 1, y: thisYear - Number(m[1]) };
    setSel(s => (s.m === next.m && s.d === next.d && s.y === next.y ? s : next));
    setTouched({ m: true, d: true, y: true });
  }, [value, thisYear]);

  const year = thisYear - sel.y;
  const dayCount = daysIn(year, sel.m);
  const days = useMemo(() => Array.from({ length: dayCount }, (_, i) => String(i + 1)), [dayCount]);
  const day = Math.min(sel.d, dayCount - 1);

  const emit = (s: { m: number; d: number; y: number }, t: { m: boolean; d: boolean; y: boolean }) => {
    if (!(t.m && t.d && t.y)) { if (value) onChange(""); return; }
    const y = thisYear - s.y;
    const d = Math.min(s.d, daysIn(y, s.m) - 1);
    onChange(`${y}-${String(s.m + 1).padStart(2, "0")}-${String(d + 1).padStart(2, "0")}`);
  };

  const pick = (col: "m" | "d" | "y") => (i: number) => {
    const s = { ...sel, [col]: i };
    const t = { ...touched, [col]: true };
    setSel(s); setTouched(t); emit(s, t);
  };

  const allTouched = touched.m && touched.d && touched.y;

  return (
    <div className="mt-2" role="group" aria-label="Date of birth">
      <div className="relative">
        <div className="pointer-events-none absolute inset-x-0 rounded-xl bg-muted/70" style={{ top: PAD, height: ITEM }} aria-hidden />
        <div className="relative grid grid-cols-[1.7fr_0.9fr_1.1fr] gap-1">
          <Wheel label="Month" items={MONTHS} index={sel.m} touched={touched.m} onPick={pick("m")} />
          <Wheel label="Day" items={days} index={day} touched={touched.d} onPick={pick("d")} />
          <Wheel label="Year" items={years} index={sel.y} touched={touched.y} onPick={pick("y")} />
        </div>
      </div>
      <p className="mt-1 text-center text-[11px] text-muted-foreground">
        {allTouched ? "Scroll any column to change it." : "Scroll month, day and year to your date of birth."}
      </p>
    </div>
  );
}
