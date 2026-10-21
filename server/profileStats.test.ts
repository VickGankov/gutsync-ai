import { describe, it, expect } from "vitest";
import { ageOn, checkBirthDate, parseBirthDate } from "@shared/profileStats";

const NOW = new Date("2026-10-21T12:00:00Z");

describe("birth date", () => {
  it("parses only real calendar dates", () => {
    expect(parseBirthDate("1990-02-28")).toEqual({ y: 1990, m: 2, d: 28 });
    expect(parseBirthDate("1990-02-30")).toBeNull();
    expect(parseBirthDate("90-02-10")).toBeNull();
    expect(parseBirthDate("1990/02/10")).toBeNull();
  });
  it("computes age by calendar date", () => {
    expect(ageOn("2008-10-21", NOW)).toBe(18);
    expect(ageOn("2008-10-22", NOW)).toBe(17);
    expect(ageOn("2000-02-29", NOW)).toBe(26);
  });
  it("classifies dates", () => {
    expect(checkBirthDate("1990-05-05", NOW)).toBe("ok");
    expect(checkBirthDate("2008-10-21", NOW)).toBe("ok");
    expect(checkBirthDate("2008-10-22", NOW)).toBe("under18");
    expect(checkBirthDate("2027-01-01", NOW)).toBe("future");
    expect(checkBirthDate("1890-01-01", NOW)).toBe("implausible");
    expect(checkBirthDate("nonsense", NOW)).toBe("invalid");
  });
});
