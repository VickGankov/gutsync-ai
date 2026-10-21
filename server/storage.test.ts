import { describe, it, expect } from "vitest";
import { isValidMediaKey, normalizeKey, avatarKeyFromUrl } from "./storage";

describe("media keys", () => {
  it("accepts meal photo keys", () => {
    expect(isValidMediaKey("meals/42/V1StGXR8_Z5jdHi6B-myT.jpg")).toBe(true);
  });
  it("accepts avatar keys, jpg only", () => {
    expect(isValidMediaKey("avatars/42/V1StGXR8_Z5jdHi6B-myT.jpg")).toBe(true);
    expect(isValidMediaKey("avatars/42/x.png")).toBe(false);
    expect(isValidMediaKey("avatars/42/../1/x.jpg")).toBe(false);
  });
  it("finds a user's own avatar key in a stored url and ignores anyone else's", () => {
    expect(avatarKeyFromUrl("/api/media/avatars/7/abc_DEF-1.jpg", 7)).toBe("avatars/7/abc_DEF-1.jpg");
    expect(avatarKeyFromUrl("https://cdn.example.com/avatars/7/abc.jpg", 7)).toBe("avatars/7/abc.jpg");
    expect(avatarKeyFromUrl("/api/media/avatars/8/abc.jpg", 7)).toBeNull();
    expect(avatarKeyFromUrl(null, 7)).toBeNull();
    expect(avatarKeyFromUrl("/api/media/meals/7/abc.jpg", 7)).toBeNull();
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

import { mealPhotoKeys } from "./db";
describe("mealPhotoKeys", () => {
  it("keeps only this user's meal photo keys", () => {
    const urls = [
      "/api/media/meals/7/abc_DEF-1.jpg",
      "https://cdn.example.com/meals/7/xyz.jpg",
      "/api/media/meals/8/other.jpg",
      "https://example.com/not-ours.jpg",
      null,
    ];
    expect(mealPhotoKeys(urls, 7)).toEqual(["meals/7/abc_DEF-1.jpg", "meals/7/xyz.jpg"]);
  });
});
