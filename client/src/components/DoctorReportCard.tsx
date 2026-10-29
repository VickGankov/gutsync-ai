// Download a PDF summary to bring to an appointment. The server builds it from the signed-in user's own entries.

import { useState } from "react";
import { FileText } from "lucide-react";

const PERIODS = [7, 14, 30, 60, 90] as const;

export default function DoctorReportCard() {
  const [days, setDays] = useState<number>(30);
  const href = `/api/report.pdf?days=${days}&tz=${new Date().getTimezoneOffset()}`;
  return (
    <div className="bg-card border border-border/50 rounded-2xl p-5 mb-5">
      <div className="flex items-center gap-3 mb-3">
        <FileText className="w-5 h-5 text-primary shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Report for your doctor</p>
          <p className="text-xs text-muted-foreground">A PDF of your symptoms, possible triggers, body and labs. Counts only, no diagnosis.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex gap-1 flex-1" role="radiogroup" aria-label="Report period">
          {PERIODS.map(p => (
            <button
              key={p}
              role="radio"
              aria-checked={days === p}
              onClick={() => setDays(p)}
              className={`flex-1 text-xs font-semibold py-1.5 rounded-full ${days === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
            >
              {p}d
            </button>
          ))}
        </div>
        <a href={href} target="_blank" rel="noopener" className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-full">
          Download
        </a>
      </div>
    </div>
  );
}
