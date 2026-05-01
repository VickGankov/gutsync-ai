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

- Build command: `corepack enable && pnpm install --frozen-lockfile && pnpm run build`
- Start command: `pnpm start`
- Node version: `22`
- Branch: `main`

Set these environment variables in Render:

```bash
DATABASE_URL=
JWT_SECRET=
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=
APP_BASE_URL=https://your-render-or-custom-domain
RESEND_API_KEY=
RESEND_FROM_EMAIL=
REVENUECAT_SECRET_KEY=
VITE_REVENUECAT_PUBLIC_KEY=
```

`BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` are still required by the current AI and photo-storage code. If those credentials are Manus-only or stop working outside Manus, replace them with standard providers before launch.

## First Deploy

After the first successful Render build, open a Render shell and run:

```bash
pnpm run db:push
```

Then set `APP_BASE_URL` to the final Render/custom domain URL and redeploy.

## Migration Rules

- Migration files are append-only once pushed.
- Use the next unused migration number.
- If a migration fails, fix the data or add a forward migration. Do not edit the migration journal by hand.
- If a deploy environment has a different local file than GitHub, GitHub wins.

## CI/CD Direction

For launch, keep migrations manual from Render shell. After launch, add GitHub Actions CI and a controlled migration step.
