import { describe, it, expect } from "vitest";
import { parseSchedule, isDoseDay, minGapDays, describeSchedule, scheduleStatus, expectedInRange, localKey, type Schedule } from "../shared/doseSchedule";

// 2026-11-02 is a Monday.
const at = (key: string, hour = 9) => Date.parse(`${key}T${String(hour).padStart(2, "0")}:00:00Z`);
const weekdays: Schedule = { kind: "weekdays", days: [1, 2, 3, 4, 5] };
const cycle: Schedule = { kind: "cycle", on: 5, off: 2, start: "2026-11-02" };

describe("which days are dose days", () => {
  it("weekdays: Mon to Fri on, weekend off", () => {
    expect(isDoseDay(weekdays, "2026-11-02")).toBe(true);
    expect(isDoseDay(weekdays, "2026-11-06")).toBe(true);
    expect(isDoseDay(weekdays, "2026-11-07")).toBe(false);
    expect(isDoseDay(weekdays, "2026-11-08")).toBe(false);
  });
  it("5 on 2 off repeats from its start date, not before it", () => {
    expect(isDoseDay(cycle, "2026-11-06")).toBe(true);
    expect(isDoseDay(cycle, "2026-11-07")).toBe(false);
    expect(isDoseDay(cycle, "2026-11-09")).toBe(true);
    expect(isDoseDay(cycle, "2026-11-14")).toBe(false);
    expect(isDoseDay(cycle, "2026-11-01")).toBe(false);
  });
  it("a cycle that isn't 7 days long drifts across weekdays, unlike a weekday schedule", () => {
    const c42: Schedule = { kind: "cycle", on: 4, off: 2, start: "2026-11-02" };
    expect(isDoseDay(c42, "2026-11-05")).toBe(true);  // Thu, 4th on day
    expect(isDoseDay(c42, "2026-11-06")).toBe(false); // Fri, off
    expect(isDoseDay(c42, "2026-11-08")).toBe(true);  // Sun, next cycle starts
    expect(isDoseDay(c42, "2026-11-11")).toBe(true);  // Wed, 4th on day of cycle two
    expect(isDoseDay(c42, "2026-11-12")).toBe(false); // Thu, off
    expect(isDoseDay(c42, "2026-11-13")).toBe(false); // Fri, off
    expect(isDoseDay(c42, "2026-11-14")).toBe(true);  // Sat, cycle three
  });
});

describe("parsing, gaps and labels", () => {
  it("falls back to an interval when the pieces are unusable", () => {
    expect(parseSchedule({ kind: "weekdays", intervalDays: 3, weekdays: "" })).toEqual({ kind: "interval", days: 3 });
    expect(parseSchedule({ kind: "cycle", intervalDays: 7, cycleOn: 0, cycleOff: 2, cycleStart: "2026-11-02" })).toEqual({ kind: "interval", days: 7 });
    expect(parseSchedule({ intervalDays: 7 })).toEqual({ kind: "interval", days: 7 });
    expect(parseSchedule({ kind: "weekdays", intervalDays: 1, weekdays: "5,1,1,9" })).toEqual({ kind: "weekdays", days: [1, 5] });
  });
  it("minimum gap decides whether 'day after a dose' means anything", () => {
    expect(minGapDays(weekdays)).toBe(1);
    expect(minGapDays(cycle)).toBe(1);
    expect(minGapDays({ kind: "weekdays", days: [1, 4] })).toBe(3);
    expect(minGapDays({ kind: "weekdays", days: [2] })).toBe(7);
    expect(minGapDays({ kind: "cycle", on: 1, off: 2, start: "2026-11-02" })).toBe(3);
  });
  it("describes schedules in plain words", () => {
    expect(describeSchedule(weekdays)).toBe("Weekdays (Mon to Fri)");
    expect(describeSchedule(cycle)).toBe("5 days on, 2 off");
    expect(describeSchedule({ kind: "weekdays", days: [1, 4] })).toBe("Mon, Thu");
    expect(describeSchedule({ kind: "interval", days: 7 })).toBe("Every 7 days");
  });
});

describe("streaks on a 5 on / 2 off cycle", () => {
  const taken = (keys: string[]) => keys.map(k => at(k));
  it("a rest day does not break the streak or count towards it", () => {
    const doses = taken(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
    const sat = scheduleStatus(cycle, doses, at("2026-11-07", 15), 0);
    expect(sat.state).toBe("rest");
    expect(sat.streak).toBe(5);
    expect(sat.nextKey).toBe("2026-11-09");
    expect(sat.daysUntil).toBe(2);
    expect(sat.missedKey).toBeNull();
    const mon = scheduleStatus(cycle, doses, at("2026-11-09", 8), 0);
    expect(mon.state).toBe("due");
    expect(mon.streak).toBe(5); // today is due, not missed
  });
  it("streak carries across the weekend once Monday is taken", () => {
    const doses = taken(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-09"]);
    const s = scheduleStatus(cycle, doses, at("2026-11-09", 20), 0);
    expect(s.state).toBe("done");
    expect(s.streak).toBe(6);
    expect(s.nextKey).toBe("2026-11-10");
  });
  it("a missed scheduled day resets it and is reported", () => {
    const doses = taken(["2026-11-02", "2026-11-03", "2026-11-05", "2026-11-06"]);
    const s = scheduleStatus(cycle, doses, at("2026-11-07", 12), 0);
    expect(s.streak).toBe(2);
    expect(s.taken28).toBe(4);
    expect(s.expected28).toBe(5);
    const fri = scheduleStatus(cycle, taken(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]), at("2026-11-07", 12), 0);
    expect(fri.state).toBe("overdue");
    expect(fri.missedKey).toBe("2026-11-06");
  });
  it("a dose logged on a rest day neither breaks nor adds to the streak", () => {
    const doses = taken(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]);
    const s = scheduleStatus(cycle, doses, at("2026-11-08", 12), 0);
    expect(s.streak).toBe(5);
    expect(s.state).toBe("rest");
  });
  it("uses the user's local day, not UTC", () => {
    // 11 PM Pacific on Fri 11/6 is already Sat 11/7 in UTC.
    const tz = 480;
    const doses = [at("2026-11-07", 7)];
    expect(localKey(doses[0], tz)).toBe("2026-11-06");
    const s = scheduleStatus(cycle, doses, at("2026-11-07", 5), tz); // 9 PM Friday locally
    expect(s.state).toBe("done");
  });
  it("has nothing to say before the first dose", () => {
    expect(scheduleStatus(cycle, [], at("2026-11-03"), 0).state).toBe("none");
  });
});

describe("weekday schedule and expected counts", () => {
  it("counts only scheduled days, never before the first dose", () => {
    expect(expectedInRange(weekdays, "2026-11-02", "2026-11-08")).toBe(5);
    expect(expectedInRange(cycle, "2026-11-02", "2026-11-08")).toBe(5);
    expect(expectedInRange(weekdays, "2026-11-02", "2026-11-08", "2026-11-04")).toBe(3);
    expect(expectedInRange(weekdays, "2026-11-02", "2026-11-08", "2026-11-20")).toBe(0);
  });
  it("Monday-Thursday: Friday is a rest day", () => {
    const mt: Schedule = { kind: "weekdays", days: [1, 2, 3, 4] };
    const s = scheduleStatus(mt, [at("2026-11-02"), at("2026-11-03"), at("2026-11-04"), at("2026-11-05")], at("2026-11-06", 12), 0);
    expect(s.state).toBe("rest");
    expect(s.streak).toBe(4);
    expect(s.nextKey).toBe("2026-11-09");
  });
});
