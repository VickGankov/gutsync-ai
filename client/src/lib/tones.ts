// One color per kind of data, so the same thing looks the same on every screen.
// `onDark` is for the charcoal Today card; `ink` is a touch deeper so it reads on light cards.
export const TONE = {
  meals:    { onDark: "oklch(0.91 0.2 120)",  ink: "oklch(0.78 0.18 120)" },
  symptoms: { onDark: "oklch(0.76 0.15 25)",  ink: "oklch(0.68 0.15 25)" },
  protein:  { onDark: "oklch(0.77 0.14 295)", ink: "oklch(0.6 0.16 295)" },
  water:    { onDark: "oklch(0.81 0.1 225)",  ink: "oklch(0.64 0.12 230)" },
  fiber:    { onDark: "oklch(0.83 0.14 80)",  ink: "oklch(0.72 0.14 80)" },
  strength: { onDark: "oklch(0.8 0.14 350)",  ink: "oklch(0.62 0.17 350)" },
  protocol: { onDark: "oklch(0.82 0.1 190)",  ink: "oklch(0.64 0.11 190)" },
  weight:   { onDark: "oklch(0.95 0.01 90)",  ink: "oklch(0.3 0.02 265)" },
} as const;

/** Soft tinted background for a card or chip of the given tone. */
export const tint = (color: string, pct = 14) => `color-mix(in oklch, ${color} ${pct}%, transparent)`;
