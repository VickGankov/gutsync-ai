// Pop-up bubble for picking a 1–5 severity. Used when logging from Home
// and when editing an entry in the Symptoms tab.

import { AnimatePresence, motion } from "framer-motion";
import { Trash2, X } from "lucide-react";
import { useEffect } from "react";

const LEVELS = [
  { level: 1, label: "Barely", color: "bg-sage text-white border-sage" },
  { level: 2, label: "Mild", color: "bg-sage text-white border-sage" },
  { level: 3, label: "Moderate", color: "bg-sand-dark text-white border-sand-dark" },
  { level: 4, label: "Strong", color: "bg-coral text-white border-coral" },
  { level: 5, label: "Severe", color: "bg-coral text-white border-coral" },
];

interface Props {
  open: boolean;
  emoji: string;
  label: string;
  /** Currently saved severity (edit mode) — highlighted in the picker. */
  current?: number;
  busy?: boolean;
  onSelect: (level: number) => void;
  onClose: () => void;
  /** When provided, shows a delete button (edit mode). */
  onDelete?: () => void;
  /** Hide the 1–5 scale (e.g. positive outcomes have no severity). */
  hideScale?: boolean;
}

export default function SeverityBubble({ open, emoji, label, current, busy, onSelect, onClose, onDelete, hideScale }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-28 sm:items-center sm:pb-0">
          <motion.div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-label={`How severe is ${label}?`}
            className="relative w-full max-w-sm rounded-3xl bg-card border border-border/50 shadow-2xl p-5"
            style={{ transformOrigin: "50% 100%" }}
            initial={{ opacity: 0, scale: 0.6, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 12 }}
            transition={{ type: "spring", stiffness: 380, damping: 24 }}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground hover:bg-muted"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{emoji}</span>
              <div>
                <p className="font-medium text-foreground leading-tight">{label}</p>
                <p className="text-xs text-muted-foreground">{hideScale ? "Logged entry" : "How severe is it?"}</p>
              </div>
            </div>
            {!hideScale && <div className="flex justify-between gap-2">
              {LEVELS.map(({ level, label: lvlLabel, color }, i) => (
                <motion.button
                  key={level}
                  disabled={busy}
                  onClick={() => onSelect(level)}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05 + i * 0.04, type: "spring", stiffness: 420, damping: 20 }}
                  whileTap={{ scale: 0.88 }}
                  className="flex flex-col items-center gap-1 flex-1"
                >
                  <span
                    className={`w-12 h-12 rounded-full border-2 flex items-center justify-center text-base font-semibold transition-colors ${
                      current === level ? color : "border-border text-foreground bg-background hover:border-primary/40"
                    }`}
                  >
                    {level}
                  </span>
                  <span className="text-[10px] text-muted-foreground">{lvlLabel}</span>
                </motion.button>
              ))}
            </div>}
            {onDelete && (
              <button
                onClick={onDelete}
                disabled={busy}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="w-4 h-4" /> Delete entry
              </button>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
