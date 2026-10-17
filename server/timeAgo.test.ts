import { describe, it, expect, vi, afterEach } from "vitest";
import { formatTimeAgo } from "../client/src/lib/store";

describe("formatTimeAgo uses calendar days", () => {
  afterEach(() => vi.useRealTimers());
  const at = (iso: string) => vi.setSystemTime(new Date(iso));

  it("calls only the previous calendar day 'Yesterday', two days back '2d ago'", () => {
    vi.useFakeTimers();
    at("2026-10-16T15:00:00");
    expect(formatTimeAgo(new Date("2026-10-14T20:00:00"))).toBe("2d ago"); // 43h ago, but two days back
    expect(formatTimeAgo(new Date("2026-10-15T09:00:00"))).toBe("Yesterday");
    expect(formatTimeAgo(new Date("2026-10-15T23:30:00"))).toBe("Yesterday"); // 15.5h ago, across midnight
    expect(formatTimeAgo(new Date("2026-10-16T11:00:00"))).toBe("4h ago");
    expect(formatTimeAgo(new Date("2026-10-13T08:00:00"))).toBe("3d ago");
  });
});
