// One color per kind of data, so the same thing looks the same on every screen.
// `onDark` is for the charcoal Today card; `ink` is a touch deeper so it reads on light cards.
export const TONE = {
  meals:    { onDark: "oklch(0.91 0.2 120)",  ink: "oklch(0.78 0.18 120)" },
  symptoms: { onDark: "oklch(0.76 0.15 25)",  ink: "oklch(0.68 0.15 25)" },   // coral stays: it means "pay attention"
  protein:  { onDark: "oklch(0.8 0.15 135)",  ink: "oklch(0.55 0.14 132)" },   // deeper green-lime
  water:    { onDark: "oklch(0.82 0.08 205)", ink: "oklch(0.6 0.09 205)" },     // muted teal, the one cool note
  fiber:    { onDark: "oklch(0.83 0.14 85)",  ink: "oklch(0.7 0.13 85)" },      // warm gold
  strength: { onDark: "oklch(0.82 0.03 250)", ink: "oklch(0.45 0.035 250)" },   // slate
  protocol: { onDark: "oklch(0.84 0.09 128)", ink: "oklch(0.42 0.07 130)" },    // dark olive
  weight:   { onDark: "oklch(0.95 0.01 90)",  ink: "oklch(0.3 0.02 265)" },
} as const;

/** Soft tinted background for a card or chip of the given tone. */
export const tint = (color: string, pct = 14) => `color-mix(in oklch, ${color} ${pct}%, transparent)`;
