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
- 2026-10-13: Added fitness tracking on branch `feature/fitness-tracking`: `/progress` page (protein vs target, water, weigh-ins with weekly % change, lift top sets with e1RM trend), AI meal scans now estimate `proteinGrams` per food, new symptom types `acid_reflux`, `vomiting`, `low_appetite`. Requires applying hand-written migration `drizzle/0017_fitness_tracking.sql` before deploy.
