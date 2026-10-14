import { describe, it, expect } from "vitest";
import { isEmailInList } from "./access";

describe("isEmailInList", () => {
  it("matches case-insensitively and ignores spaces", () => {
    expect(isEmailInList("Vick@Example.com", " a@b.com , vick@example.com ")).toBe(true);
  });
  it("rejects missing emails and empty lists", () => {
    expect(isEmailInList(null, "a@b.com")).toBe(false);
    expect(isEmailInList("a@b.com", "")).toBe(false);
    expect(isEmailInList("x@b.com", "a@b.com")).toBe(false);
  });
});
