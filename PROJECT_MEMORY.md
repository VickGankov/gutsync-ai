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
