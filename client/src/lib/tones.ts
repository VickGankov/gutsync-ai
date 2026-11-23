// One color per kind of data, so the same thing looks the same on every screen.
// `onDark` is for the charcoal Today card; `ink` is a touch deeper so it reads on light cards.
export const TONE = {
  meals:    { onDark: "oklch(0.91 0.2 120)",  ink: "var(--ink-meals)" },
  symptoms: { onDark: "oklch(0.76 0.15 25)",  ink: "oklch(0.68 0.15 25)" },   // coral stays: it means "pay attention"
  protein:  { onDark: "oklch(0.8 0.15 135)",  ink: "var(--ink-protein)" },   // deeper green-lime
  water:    { onDark: "oklch(0.82 0.08 205)", ink: "var(--ink-water)" },     // muted teal, the one cool note
  fiber:    { onDark: "oklch(0.83 0.14 85)",  ink: "var(--ink-fiber)" },      // warm gold
  strength: { onDark: "oklch(0.82 0.03 250)", ink: "var(--ink-strength)" },   // slate
  protocol: { onDark: "oklch(0.84 0.09 128)", ink: "var(--ink-protocol)" },    // dark olive
  weight:   { onDark: "oklch(0.95 0.01 90)",  ink: "var(--chart-1)" },
} as const;

/** Soft tinted background for a card or chip of the given tone. */
export const tint = (color: string, pct = 14) => `color-mix(in oklch, ${color} ${pct}%, transparent)`;
