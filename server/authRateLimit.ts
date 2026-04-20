import { TRPCError } from "@trpc/server";
import type { Request } from "express";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

function getClientIp(req: Request) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string" && forwardedFor.length > 0) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return forwardedFor[0] || "unknown";
  }

  return req.ip || req.socket.remoteAddress || "unknown";
}

function pruneExpiredBuckets(now: number) {
  for (const [key, entry] of buckets.entries()) {
    if (entry.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function assertRateLimit(
  req: Request,
  action: string,
  limit: number,
  options: { windowMs?: number; scope?: string } = {}
) {
  const now = Date.now();
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const scope = options.scope?.trim().toLowerCase();
  const key = [action, getClientIp(req), scope].filter(Boolean).join(":");

  if (buckets.size > 1000) {
    pruneExpiredBuckets(now);
  }

  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (current.count >= limit) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Too many ${action} attempts. Please try again later.`,
    });
  }

  current.count += 1;
  buckets.set(key, current);
}
