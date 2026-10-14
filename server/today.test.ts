import { describe, it, expect } from "vitest";
import { summarizeToday } from "../shared/today";

const H = 3_600_000;
const start = Date.UTC(2026, 9, 14, 0, 0, 0);
const base = {
  now: start + 14 * H, startOfDay: start, hour: 14,
  meals: [], symptoms: [], proteinG: 40, proteinTargetG: 150, reintroCheckInPending: false,
};

describe("summarizeToday", () => {
  it("counts only today's entries and picks the worst negative symptom", () => {
    const s = summarizeToday({
      ...base,
      meals: [{ loggedAt: start + 8 * H }, { loggedAt: start - H }],
      symptoms: [
        { type: "gas", severity: 2, loggedAt: start + 9 * H },
        { type: "bloating", severity: 4, loggedAt: start + 10 * H },
        { type: "better_sleep", severity: 5, loggedAt: start + 7 * H },
        { type: "nausea", severity: 5, loggedAt: start - 5 * H },
      ],
    });
    expect(s.mealsToday).toBe(1);
    expect(s.symptomsToday).toBe(2);
    expect(s.worst).toEqual({ type: "bloating", severity: 4 });
  });

  it("prioritises a pending reintroduction check-in", () => {
    expect(summarizeToday({ ...base, reintroCheckInPending: true }).nudge.kind).toBe("reintro");
  });

  it("nudges to log a meal after 11am when none logged", () => {
    expect(summarizeToday(base).nudge.kind).toBe("meal");
    expect(summarizeToday({ ...base, hour: 9, now: start + 9 * H }).nudge.kind).toBe("done");
  });

  it("asks how you feel 2h+ after a meal with no symptoms", () => {
    const s = summarizeToday({ ...base, meals: [{ loggedAt: start + 10 * H }] });
    expect(s.nudge.kind).toBe("feeling");
  });

  it("nudges on protein in the evening when well behind", () => {
    const s = summarizeToday({
      ...base, hour: 18, now: start + 18 * H,
      meals: [{ loggedAt: start + 17.5 * H }], symptoms: [{ type: "gas", severity: 1, loggedAt: start + 17.6 * H }],
    });
    expect(s.nudge).toEqual({ kind: "protein", href: "/progress", remainingG: 110 });
  });

  it("is done when everything is logged", () => {
    const s = summarizeToday({
      ...base, proteinG: 150,
      meals: [{ loggedAt: start + 12 * H }], symptoms: [{ type: "gas", severity: 1, loggedAt: start + 13 * H }],
    });
    expect(s.nudge.kind).toBe("done");
    expect(s.lastSymptom?.type).toBe("gas");
  });
});
