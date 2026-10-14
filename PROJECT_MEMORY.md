# Project Memory

This file is the durable context for future Cursor chats in this workspace.

## How To Use

- Read this file near the start of project work.
- Treat entries as helpful context, not as a substitute for checking the current code and git state.
- Add durable decisions, preferences, architecture notes, and active project status when they will matter in future chats.
- Keep entries concise and date-stamped. Prefer summaries over raw chat transcripts.
- Remove or revise stale entries when the project changes.

## Durable Context

- 2026-05-01: The user wants future Cursor chats in this workspace to preserve useful context across conversations. Use this file as the curated source of project memory.
- 2026-05-06: Release-readiness pass is underway. `pnpm run verify` passes locally after dependency install. Implemented launch fixes for privacy policy, meal type override after scan, production RevenueCat fail-closed activation, isolated email-auth tests, GutSync branding/app ID alignment, and removal of unused analytics HTML placeholders. Remaining launch risks include configuring real Render/RevenueCat/Forge/Resend environment variables, RevenueCat webhook user lookup, beneficial-food correlations, and store assets/favicon.
- 2026-10-13: Branch `feature/direct-ai-storage` removes the hard dependency on the Manus Forge proxy for AI and photo storage. AI uses `LLM_API_KEY`/`LLM_API_URL`/`LLM_MODEL` (OpenAI-compatible, default Gemini); images are sent inline as data URLs. Photos go to an S3-compatible bucket via `S3_*`, served through `/api/media/<key>` (signed redirect) unless `S3_PUBLIC_URL_BASE` is set. Forge env vars remain a fallback until removed.
- 2026-10-13: Added FODMAP reintroduction challenge on branch `feature/reintro-challenge`: `/reintro` page (pick a FODMAP group, 3-day increasing doses, daily 0–5 check-in with stress/sleep/ate-dose flags, early stop at severity ≥3, tolerance map, shareable text summary), Home banner for an active challenge, entry card on Insights. Shared protocol logic in `shared/reintro.ts`. Requires hand-written migration `drizzle/0018_reintro_challenges.sql` (0017 is on the fitness branch).
- 2026-10-13: Added fitness tracking on branch `feature/fitness-tracking`: `/progress` page (protein vs target, water, weigh-ins with weekly % change, lift top sets with e1RM trend), AI meal scans now estimate `proteinGrams` per food, new symptom types `acid_reflux`, `vomiting`, `low_appetite`. Requires applying hand-written migration `drizzle/0017_fitness_tracking.sql` before deploy.
- 2026-10-14: Migrations are now automatic on deploy: `pnpm run db:migrate` = `drizzle-kit migrate && node scripts/migrate-manual.mjs`. The manual runner applies non-journaled numbered `.sql` files in `drizzle/` once each, tracked in `_manual_migrations`; "already exists" errors are skipped, anything else fails the build. Add schema changes as the next-numbered `.sql` file.
- 2026-10-14: Render deploys had been failing since May 2026 with "Connections using insecure transport are prohibited" (TiDB Cloud requires TLS; drizzle-kit and the app connected with the raw URL, no TLS). Fixed by `shared/dbConnection.mjs`, used by server/db.ts, drizzle.config.ts and scripts/migrate-manual.mjs: verified TLS for any non-local host.
- 2026-10-14: Faster photo scans. Client resizes photos to ~1024px JPEG before upload (`client/src/lib/image.ts`); upload to S3 runs in parallel with the AI call. `meals.analyzePhoto` is now two-stage (`server/foodAnalysis.ts`): the vision model only identifies foods + grams; FODMAP level, hidden ingredients and protein/100 g come from the shared `food_cache` table (migration 0019, seeded with ~100 approximate starter foods from `server/foodSeed.ts`, NOT Monash data); only unseen foods get a small text AI lookup, which is saved for everyone. Any failure falls back to the old single-call analysis. Server logs `[analyze] identify=..ms total=..ms cacheHits=..` for measuring. Also: free scans are 10/day; `UNLIMITED_EMAILS` (comma-separated) env var gives accounts unlimited scans.
