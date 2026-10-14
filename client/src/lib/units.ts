// US water units. Storage stays in millilitres; these helpers are display/input only.

export const ML_PER_OZ = 29.5735;
export const ML_PER_GAL = 3785.41;

export const mlToOz = (ml: number) => Math.round(ml / ML_PER_OZ);
export const ozToMl = (oz: number) => Math.round(oz * ML_PER_OZ);

/** Gallons with 2 decimals, e.g. 0.25. */
export const formatGal = (ml: number) => (ml / ML_PER_GAL).toFixed(2);

/** Gallons for an editable field (2 decimals, no trailing zeros noise). */
export const galInputValue = (ml: number) => String(Math.round((ml / ML_PER_GAL) * 100) / 100);

export const galToMl = (gal: number) => Math.round(gal * ML_PER_GAL);
