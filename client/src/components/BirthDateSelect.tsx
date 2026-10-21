// Month / day / year pickers (native selects, so phones show a scrolling wheel).
// `value` is "YYYY-MM-DD", or "" until all three are chosen.

import { useEffect, useMemo, useState } from "react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const cls = "min-w-0 rounded-xl border border-border bg-background px-3 py-2 text-sm";

type Parts = { y: string; m: string; d: string };

function split(v: string): Parts {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  return m ? { y: m[1], m: String(Number(m[2])), d: String(Number(m[3])) } : { y: "", m: "", d: "" };
}
const daysIn = (y: string, m: string) => (m ? new Date(Number(y) || 2000, Number(m), 0).getDate() : 31);

export default function BirthDateSelect({ value, onChange, idPrefix = "dob" }: { value: string; onChange: (v: string) => void; idPrefix?: string }) {
  const [parts, setParts] = useState<Parts>(() => split(value));
  // Follow the value when it is set from outside, for example when editing opens with a saved date.
  useEffect(() => { if (value) setParts(split(value)); }, [value]);

  const years = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: now - 1899 }, (_, i) => String(now - i));
  }, []);

  const update = (patch: Partial<Parts>) => {
    const n = { ...parts, ...patch };
    if (n.d && Number(n.d) > daysIn(n.y, n.m)) n.d = String(daysIn(n.y, n.m));
    setParts(n);
    onChange(n.y && n.m && n.d ? `${n.y}-${n.m.padStart(2, "0")}-${n.d.padStart(2, "0")}` : "");
  };

  return (
    <div className="mt-1 grid grid-cols-[1.6fr_1fr_1.2fr] gap-2">
      <select id={`${idPrefix}-month`} aria-label="Month" value={parts.m} onChange={e => update({ m: e.target.value })} className={cls}>
        <option value="">Month</option>
        {MONTHS.map((n, i) => <option key={n} value={String(i + 1)}>{n}</option>)}
      </select>
      <select id={`${idPrefix}-day`} aria-label="Day" value={parts.d} onChange={e => update({ d: e.target.value })} className={cls}>
        <option value="">Day</option>
        {Array.from({ length: daysIn(parts.y, parts.m) }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
      </select>
      <select id={`${idPrefix}-year`} aria-label="Year" value={parts.y} onChange={e => update({ y: e.target.value })} className={cls}>
        <option value="">Year</option>
        {years.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
    </div>
  );
}
