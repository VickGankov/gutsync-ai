import type { Express } from "express";

export function registerOAuthRoutes(_app: Express) {
  console.warn(
    "[Auth] Legacy OAuth routes are disabled. GutSync now uses email-based authentication only."
  );
}
