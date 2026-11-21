import { describe, expect, it } from "vitest";
import { BLEND_INFO, COMPOUND_INFO, infoFor, joinBlend, splitBlend, trackFor } from "../shared/compoundInfo";
import { COMPOUND_PRESETS, NEGATIVE_SYMPTOMS } from "../shared/dose";
import { POSITIVE_SYMPTOM_TYPES } from "../shared/today";

describe("blends", () => {
  it("splits on / + & and 'with'", () => {
    expect(splitBlend("CJC-1295 / Ipamorelin")).toEqual(["CJC-1295", "Ipamorelin"]);
    expect(splitBlend("CJC-1295+Ipamorelin")).toEqual(["CJC-1295", "Ipamorelin"]);
    expect(splitBlend("BPC-157 & TB-500")).toEqual(["BPC-157", "TB-500"]);
    expect(splitBlend("Retatrutide")).toEqual(["Retatrutide"]);
  });
  it("round-trips through joinBlend", () => {
    expect(splitBlend(joinBlend(["A", "B"]))).toEqual(["A", "B"]);
  });
  it("finds notes for every part and reports unknown parts instead of guessing", () => {
    const r = infoFor("CJC-1295 (no DAC) / Ipamorelin / Mystery");
    expect(r.known.map(i => i.name)).toEqual(["CJC-1295", "Ipamorelin"]);
    expect(r.unknown).toEqual(["Mystery"]);
  });
  it("merges tracked effects without repeats", () => {
    const t = trackFor(infoFor("CJC-1295 / Ipamorelin").known);
    expect(new Set(t).size).toBe(t.length);
  });
});

describe("NAD+, aliases and matched blends", () => {
  it("keeps the plus in NAD+", () => {
    expect(splitBlend("NAD+")).toEqual(["NAD+"]);
    expect(splitBlend("NAD+ / MOTS-c / 5-amino-1MQ")).toEqual(["NAD+", "MOTS-c", "5-amino-1MQ"]);
    expect(splitBlend("CJC-1295+Ipamorelin")).toEqual(["CJC-1295", "Ipamorelin"]);
  });
  it("treats SS-31 and elamipretide as one compound", () => {
    expect(infoFor("SS-31 / Elamipretide").known.map(i => i.key)).toEqual(["ss31"]);
  });
  it("attaches a blend note only when every part is known and the set matches", () => {
    expect(infoFor("CJC-1295 / Ipamorelin").blend?.name).toMatch(/CJC/);
    expect(infoFor("Ipamorelin / CJC-1295").blend).toBeDefined();
    expect(infoFor("BPC-157 & TB-500").blend).toBeDefined();
    expect(infoFor("NAD+ / MOTS-c / 5-amino-1MQ").blend).toBeDefined();
    expect(infoFor("CJC-1295 / Ipamorelin / Mystery").blend).toBeUndefined();
    expect(infoFor("BPC-157 / Ipamorelin").blend).toBeUndefined();
  });
});

describe("compound notes", () => {
  it("covers every quick-pick compound", () => {
    for (const c of COMPOUND_PRESETS) expect(infoFor(c).known.length, c).toBe(1);
  });
  it("only tracks real symptom types, each with a source and review date", () => {
    const known = new Set([...NEGATIVE_SYMPTOMS, ...POSITIVE_SYMPTOM_TYPES, "low_appetite", "better_digestion"]);
    for (const b of BLEND_INFO) for (const t of b.track) expect(known.has(t), `${b.name}: ${t}`).toBe(true);
    for (const i of COMPOUND_INFO) {
      expect(i.source.length, i.name).toBeGreaterThan(5);
      expect(i.reviewed, i.name).toMatch(/^\d{4}-\d{2}$/);
      for (const t of i.track) expect(known.has(t), `${i.name}: ${t}`).toBe(true);
    }
  });
  it("every compound and blend has both benefits and side effects", () => {
    for (const i of [...COMPOUND_INFO, ...BLEND_INFO]) {
      expect(i.benefits.length, `${i.name} benefits`).toBeGreaterThan(0);
      expect(i.sideEffects.length, `${i.name} side effects`).toBeGreaterThan(0);
    }
  });
  it("member notes are non-empty and carry no imperative dosing ('take', 'inject', 'use')", () => {
    for (const i of [...COMPOUND_INFO, ...BLEND_INFO]) for (const m of i.members ?? []) {
      expect(m.length).toBeGreaterThan(10);
      expect(m).not.toMatch(/^(take|inject|use|dose)\b/i);
    }
  });
});
