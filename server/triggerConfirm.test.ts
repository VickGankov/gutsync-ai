import { describe, it, expect } from "vitest";
import { confirmationFor, groupsForNames, type FinishedChallenge } from "../shared/triggerConfirm";

const ch = (foodGroup: string, outcome: FinishedChallenge["outcome"], extra: Partial<FinishedChallenge> = {}): FinishedChallenge => ({
  foodGroup, status: "completed", outcome, lowConfidence: 0, finishedAt: 100, startedAt: 50, ...extra,
});

describe("triggerConfirm", () => {
  it("matches foods to reintroduction groups by keyword", () => {
    expect(groupsForNames(["garlic powder"])).toEqual(["fructans_garlic"]);
    expect(groupsForNames(["Wheat bread", "butter"])).toEqual(["fructans_wheat"]);
    expect(groupsForNames(["cheesecake"])).toEqual(["lactose"]);
    expect(groupsForNames(["banana"])).toEqual([]);
    expect(groupsForNames(["rice cake"])).toEqual([]); // not 'ice cream'
  });

  it("is never confirmed without a finished test", () => {
    expect(confirmationFor(["garlic"], [])).toBeNull();
    expect(confirmationFor(["garlic"], [ch("fructans_garlic", null, { status: "active" })])).toBeNull();
    expect(confirmationFor(["garlic"], [ch("fructans_garlic", "avoid", { status: "abandoned" })])).toBeNull();
  });

  it("confirms after a clean test that reacted (limit or avoid)", () => {
    expect(confirmationFor(["garlic"], [ch("fructans_garlic", "avoid")])).toMatchObject({ state: "confirmed" });
    expect(confirmationFor(["garlic"], [ch("fructans_garlic", "limit")])).toMatchObject({ state: "confirmed" });
  });

  it("asks for a retest when the reacting test had stress or poor sleep logged", () => {
    expect(confirmationFor(["garlic"], [ch("fructans_garlic", "avoid", { lowConfidence: 1 })])).toMatchObject({ state: "retest" });
  });

  it("says tolerated only when every matching group was tested and tolerated", () => {
    expect(confirmationFor(["garlic"], [ch("fructans_garlic", "tolerated")])).toMatchObject({ state: "tolerated" });
    expect(confirmationFor(["garlic", "onion"], [ch("fructans_garlic", "tolerated")])).toBeNull();
  });

  it("uses the most recent finished test for a group", () => {
    const older = ch("fructans_garlic", "avoid", { finishedAt: 100 });
    const newer = ch("fructans_garlic", "tolerated", { finishedAt: 900 });
    expect(confirmationFor(["garlic"], [older, newer])).toMatchObject({ state: "tolerated" });
  });
});
