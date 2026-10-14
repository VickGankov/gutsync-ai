# Deployment Workflow

GitHub is the source of truth. Cursor is where code changes are made. Render deploys from GitHub.

## Cursor Workflow

1. Make changes in Cursor.
2. Run checks:

```bash
pnpm run verify
```

1. Commit and push from Cursor.
2. Render auto-deploys `main`.

## Render Setup

Create a new Render Blueprint from `render.yaml`, or create a Web Service manually with:

- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm run db:migrate && pnpm run build`
- Start command: `pnpm start`
- Node version: `22`
- Branch: `main`

Set these environment variables in Render:

```bash
DATABASE_URL=
JWT_SECRET=
# AI food analysis (any OpenAI-compatible API; defaults to Gemini)
LLM_API_KEY=
# LLM_API_URL=https://generativelanguage.googleapis.com/v1beta/openai
# LLM_MODEL=gemini-2.5-flash
# Meal photo storage (AWS S3, Cloudflare R2, Backblaze B2, ...)
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_REGION=auto
S3_ENDPOINT=            # e.g. https://<account>.r2.cloudflarestorage.com (leave empty for AWS S3)
# S3_PUBLIC_URL_BASE=   # optional public/CDN URL; otherwise photos are served via /api/media
APP_BASE_URL=https://your-render-or-custom-domain
RESEND_API_KEY=
RESEND_FROM_EMAIL=
REVENUECAT_SECRET_KEY=
VITE_REVENUECAT_PUBLIC_KEY=
```

AI and photo storage use your own providers via `LLM_*` and `S3_*`. The bucket can stay private: photos are served through `/api/media/<key>`, which redirects to a one-hour signed URL. Get a Gemini key at Google AI Studio, or point `LLM_API_URL`/`LLM_MODEL` at any OpenAI-compatible provider.

Legacy fallback: if `LLM_API_KEY` / `S3_*` are not set, the app still uses `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` (Manus proxy). Remove those once the new variables are live. Photos uploaded through Manus keep their old URLs; new uploads go to your bucket.

## First Deploy

Render free services do not include Shell, so migrations run during the build with `pnpm run db:migrate`.

Database connections (app, drizzle-kit and the migration runner) all go through `shared/dbConnection.mjs`, which turns on verified TLS for any non-local host. TiDB Cloud Serverless rejects unencrypted connections, so `DATABASE_URL` can be the plain `mysql://user:pass@host:4000/db` string; no `ssl` query parameter is needed.

`db:migrate` runs `drizzle-kit migrate` (journaled migrations 0000–0011) and then `scripts/migrate-manual.mjs`, which applies every other numbered `.sql` file in `drizzle/` once, in order, and records it in the `_manual_migrations` table. To add a schema change, add the next-numbered `.sql` file and deploy; no manual SQL needed. Statements that fail only because the object already exists are skipped, so hand-applied migrations are adopted safely. Any other error fails the build and the previous version stays live.

After the first deploy succeeds, set `APP_BASE_URL` to the final Render/custom domain URL and redeploy.

## Migration Rules

- Migration files are append-only once pushed.
- Use the next unused migration number.
- If a migration fails, fix the data or add a forward migration. Do not edit the migration journal by hand.
- If a deploy environment has a different local file than GitHub, GitHub wins.

## CI/CD Direction

For launch, migrations run during Render builds. After launch, add GitHub Actions CI and a controlled migration step.
