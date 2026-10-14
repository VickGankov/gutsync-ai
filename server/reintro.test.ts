import { describe, it, expect } from "vitest";
import { assessChallenge, currentChallengeDay, type ReintroCheckIn } from "@shared/reintro";

const ci = (day: 1 | 2 | 3, severity: number, extra: Partial<ReintroCheckIn> = {}): ReintroCheckIn => ({
  day, severity, stressed: false, poorSleep: false, ateDose: true, loggedAt: day, ...extra,
});

describe("assessChallenge", () => {
  it("is pending until all days are in when there is no reaction", () => {
    expect(assessChallenge([ci(1, 0), ci(2, 1)])).toBeNull();
  });

  it("marks tolerated when no day reaches the threshold", () => {
    const r = assessChallenge([ci(1, 0), ci(2, 2), ci(3, 2)]);
    expect(r?.outcome).toBe("tolerated");
    expect(r?.toleratedDay).toBe(3);
    expect(r?.lowConfidence).toBe(false);
  });

  it("stops early and limits to the previous dose on a day-2 reaction", () => {
    const r = assessChallenge([ci(1, 1), ci(2, 4)]);
    expect(r?.outcome).toBe("limit");
    expect(r?.toleratedDay).toBe(1);
  });

  it("recommends avoiding after a day-1 reaction", () => {
    const r = assessChallenge([ci(1, 3)]);
    expect(r?.outcome).toBe("avoid");
    expect(r?.toleratedDay).toBe(0);
  });

  it("ignores symptoms on days the dose wasn't eaten but flags low confidence", () => {
    const r = assessChallenge([ci(1, 0), ci(2, 4, { ateDose: false }), ci(3, 1)]);
    expect(r?.outcome).toBe("tolerated");
    expect(r?.lowConfidence).toBe(true);
  });

  it("flags low confidence when stress or poor sleep precede the reaction", () => {
    const r = assessChallenge([ci(1, 0, { poorSleep: true }), ci(2, 3)]);
    expect(r?.lowConfidence).toBe(true);
  });
});

describe("currentChallengeDay", () => {
  it("advances at local midnight", () => {
    const PDT = 420;
    const start = Date.UTC(2026, 9, 14, 5, 0); // Oct 13 22:00 PDT
    expect(currentChallengeDay(start, Date.UTC(2026, 9, 14, 6, 59), PDT)).toBe(1); // 23:59 PDT
    expect(currentChallengeDay(start, Date.UTC(2026, 9, 14, 7, 1), PDT)).toBe(2); // 00:01 PDT
  });
});
