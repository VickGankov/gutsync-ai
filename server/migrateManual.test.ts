import { describe, it, expect } from "vitest";
// @ts-expect-error plain JS module
import { splitStatements, pendingFiles, isAlreadyAppliedError } from "../scripts/migrate-manual.mjs";

describe("manual migration runner", () => {
  it("splits statements and drops comments", () => {
    const sql = "-- header\nCREATE TABLE a (id int);\n\nALTER TABLE a ADD b int;\n";
    expect(splitStatements(sql)).toEqual(["CREATE TABLE a (id int)", "ALTER TABLE a ADD b int"]);
  });

  it("only picks numbered files that drizzle-kit and the tracking table don't know about", () => {
    const files = ["0000_init.sql", "0014_x.sql", "0017_fit.sql", "0018_re.sql", "meta", "schema.ts"];
    expect(pendingFiles(files, ["0000_init"], new Set(["0014_x.sql"]))).toEqual(["0017_fit.sql", "0018_re.sql"]);
  });

  it("treats 'already exists' errors as applied, nothing else", () => {
    expect(isAlreadyAppliedError({ errno: 1050, message: "Table 'x' already exists" })).toBe(true);
    expect(isAlreadyAppliedError({ errno: 1105, message: "Duplicate key name 'idx'" })).toBe(true);
    expect(isAlreadyAppliedError({ errno: 1146, message: "Table 'x' doesn't exist" })).toBe(false);
    expect(isAlreadyAppliedError({ errno: 1064, message: "You have an error in your SQL syntax" })).toBe(false);
  });
});
