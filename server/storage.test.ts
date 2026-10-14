import { describe, it, expect } from "vitest";
import { isValidMediaKey, normalizeKey } from "./storage";

describe("media keys", () => {
  it("accepts meal photo keys", () => {
    expect(isValidMediaKey("meals/42/V1StGXR8_Z5jdHi6B-myT.jpg")).toBe(true);
  });
  it("rejects traversal and unexpected paths", () => {
    expect(isValidMediaKey("meals/42/../../secret.jpg")).toBe(false);
    expect(isValidMediaKey("other/42/abc.jpg")).toBe(false);
    expect(isValidMediaKey("meals/abc/x.jpg")).toBe(false);
    expect(isValidMediaKey("meals/42/x.exe")).toBe(false);
  });
  it("strips leading slashes", () => {
    expect(normalizeKey("//meals/1/a.jpg")).toBe("meals/1/a.jpg");
  });
});
