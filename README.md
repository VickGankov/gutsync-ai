# GutSync AI

**A mobile-first food sensitivity tracker that uses AI-powered photo analysis to help users with IBS and chronic bloating identify dietary triggers.** Users snap a photo of their meal, the AI identifies foods and hidden ingredients with FODMAP ratings, and over time the app discovers correlations between specific foods and symptoms.

**Live URL:** [https://gutsyncai-aye9tq4o.manus.space](https://gutsyncai-aye9tq4o.manus.space)
**App ID:** `com.gutsync.app`
**Deployment Target:** Google Play Store via PWA Builder

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Database Schema](#database-schema)
5. [Authentication System](#authentication-system)
6. [API Reference (tRPC Procedures)](#api-reference-trpc-procedures)
7. [Core Feature Flows](#core-feature-flows)
8. [Frontend Pages and Navigation](#frontend-pages-and-navigation)
9. [Design System](#design-system)
10. [Subscription and Monetization](#subscription-and-monetization)
11. [PWA Configuration](#pwa-configuration)
12. [Development Guide](#development-guide)
13. [Testing](#testing)
14. [Known Issues and Limitations](#known-issues-and-limitations)
15. [Pending Work](#pending-work)
16. [Important Implementation Notes](#important-implementation-notes)

---

## Architecture Overview

GutSync follows a monorepo structure with a React frontend and Express backend communicating exclusively through tRPC. The backend connects to a MySQL/TiDB database via Drizzle ORM and uses S3 for photo storage. AI analysis is performed server-side using the platform's built-in LLM service (vision-capable model).

```
┌─────────────────────────────────────────────────────┐
│  Client (React 19 + Tailwind 4)                     │
│  ├── wouter (routing)                               │
│  ├── tRPC React Query hooks                         │
│  └── framer-motion (animations)                     │
│                                                     │
│  All API calls go through trpc.* hooks              │
│  Auth state via useAuth() hook                      │
└──────────────────┬──────────────────────────────────┘
                   │ /api/trpc (HTTP batch link)
┌──────────────────▼──────────────────────────────────┐
│  Server (Express 4 + tRPC 11)                       │
│  ├── server/routers.ts (all procedures)             │
│  ├── server/db.ts (Drizzle query helpers)           │
│  ├── server/emailAuth.ts (bcrypt auth)              │
│  ├── server/storage.ts (S3 helpers)                 │
│  └── server/_core/ (framework plumbing — DO NOT     │
│       EDIT unless extending infrastructure)         │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   MySQL/TiDB     S3      LLM API
   (Drizzle)   (photos)  (food analysis)
```

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | React 19, TypeScript, Tailwind 4 | Mobile-first, single-page app |
| Routing | wouter | Lightweight client-side routing |
| State/Data | tRPC 11 + React Query | Type-safe end-to-end, superjson serialization |
| Animations | framer-motion | Page transitions, modals, gesture support |
| UI Components | shadcn/ui + Radix primitives | In `client/src/components/ui/` |
| Backend | Express 4, tRPC 11 | All routes under `/api/trpc` |
| Database | MySQL (TiDB) via Drizzle ORM | Schema in `drizzle/schema.ts` |
| Auth | Email/password with bcrypt + JWT | Custom implementation, no OAuth |
| AI | Platform LLM (vision model) | `invokeLLM()` from `server/_core/llm.ts` |
| Storage | S3 | Meal photos uploaded via `storagePut()` |
| Subscriptions | RevenueCat (planned) | Free tier: 3 scans/day, premium: unlimited |
| PWA | manifest.json + service worker | Configured for Play Store via PWA Builder |
| Testing | Vitest | 38 tests across 4 test files |

---

## Project Structure

```
gutsync-ai/
├── client/
│   ├── public/
│   │   └── manifest.json          ← PWA manifest (icons, screenshots, shortcuts)
│   ├── src/
│   │   ├── _core/hooks/useAuth.ts ← Auth state hook (user, loading, logout)
│   │   ├── components/
│   │   │   ├── BottomNav.tsx       ← Mobile bottom navigation (5 tabs + center scan)
│   │   │   ├── FoodCaptureModal.tsx← Main scan modal: photo → AI → edit → save
│   │   │   ├── Paywall.tsx         ← Premium upgrade modal
│   │   │   ├── Timeline48h.tsx     ← 48-hour meal/symptom timeline
│   │   │   └── ui/                 ← shadcn/ui components (button, card, dialog, etc.)
│   │   ├── const.ts               ← getLoginUrl() returns "/auth"
│   │   ├── contexts/ThemeContext.tsx
│   │   ├── lib/
│   │   │   ├── store.ts           ← Mock data generators (for Home page demo state)
│   │   │   ├── fodmapExplanations.ts ← FODMAP info text for food items
│   │   │   ├── trpc.ts            ← tRPC client binding
│   │   │   └── utils.ts           ← cn() utility
│   │   ├── pages/
│   │   │   ├── EmailAuth.tsx       ← Login/register page (email + password)
│   │   │   ├── Home.tsx            ← Dashboard: gut score, recent meals, symptoms
│   │   │   ├── FoodLog.tsx         ← Meal history with edit/delete/swipe
│   │   │   ├── Symptoms.tsx        ← Symptom + positive outcome logging
│   │   │   ├── Insights.tsx        ← AI-discovered correlations
│   │   │   ├── Profile.tsx         ← User profile + subscription status
│   │   │   ├── Onboarding.tsx      ← First-run onboarding slides
│   │   │   └── NotFound.tsx        ← 404 page
│   │   ├── App.tsx                 ← Routes + onboarding gate + theme
│   │   ├── main.tsx                ← tRPC/QueryClient providers + auth redirect
│   │   └── index.css               ← Global theme (OKLCH colors, fonts)
│   └── index.html
├── server/
│   ├── _core/                      ← Framework plumbing — DO NOT EDIT
│   │   ├── index.ts                ← Express server entry point
│   │   ├── context.ts              ← tRPC context builder (injects user)
│   │   ├── sdk.ts                  ← Auth: JWT verify, session management
│   │   ├── llm.ts                  ← invokeLLM() helper
│   │   ├── trpc.ts                 ← publicProcedure, protectedProcedure
│   │   ├── env.ts                  ← Environment variable access
│   │   ├── cookies.ts              ← Cookie configuration
│   │   └── ...                     ← OAuth, notification, maps, etc.
│   ├── routers.ts                  ← ALL tRPC procedures (auth, meals, symptoms, insights, subscription)
│   ├── db.ts                       ← Database query helpers (Drizzle)
│   ├── emailAuth.ts                ← registerEmail(), loginEmail() with bcrypt
│   ├── storage.ts                  ← S3 storagePut/storageGet helpers
│   ├── gutsync.test.ts             ← Main test file (20 tests)
│   ├── emailAuth.test.ts           ← Email auth tests (5 tests)
│   ├── meals.test.ts               ← Meal-specific tests (12 tests)
│   └── auth.logout.test.ts         ← Logout test (1 test)
├── drizzle/
│   ├── schema.ts                   ← Database table definitions
│   ├── relations.ts                ← Table relations
│   └── *.sql                       ← Migration files (0000–0011)
├── shared/
│   ├── const.ts                    ← COOKIE_NAME, error messages
│   └── types.ts                    ← Shared TypeScript types
├── todo.md                         ← Task tracking (completed + pending items)
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── drizzle.config.ts
└── tsconfig.json
```

---

## Database Schema

The database uses MySQL/TiDB with Drizzle ORM. Schema is defined in `drizzle/schema.ts`. All timestamps use UTC-based Unix milliseconds (bigint) except for `createdAt`/`updatedAt` which use MySQL `timestamp`.

### Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `users` | User accounts | `id`, `email`, `password` (bcrypt hash), `openId` (legacy OAuth), `role`, `loginMethod` |
| `meals` | Logged meals | `userId`, `photoUrl` (S3), `mealType` (enum), `foods` (JSON array of `MealFood`), `loggedAt` (ms) |
| `symptoms` | Symptom/outcome logs | `userId`, `type` (enum: 8 negative + 6 positive), `severity` (1–5), `source`, `loggedAt` (ms) |
| `correlations` | AI-discovered patterns | `userId`, `trigger`, `symptom`, `confidence` (0–100), `occurrences`, `recommendation` |
| `subscriptions` | Premium status | `userId`, `rcCustomerId`, `tier` (free/premium), `expiresAt`, `platform` |
| `scan_usage` | Daily scan counter | `userId`, `usageDate` (YYYY-MM-DD), `scanCount` |
| `wearable_data` | **DEPRECATED** — table exists but feature removed from codebase | `userId`, `hrv`, `heartRate`, `sleepQuality`, `stressLevel` |

### MealFood JSON Structure

Each meal's `foods` column stores a JSON array where each item has:

```typescript
interface MealFood {
  name: string;                    // "Grilled Chicken"
  category: 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'dairy' | 'grain' | 'other';
  fodmap: 'low' | 'moderate' | 'high';
  hiddenIngredients: string[];     // ["garlic powder", "onion"]
}
```

### Symptom Types

The `symptoms.type` enum includes both negative symptoms and positive outcomes:

**Negative:** `bloating`, `abdominal_pain`, `gas`, `nausea`, `fatigue`, `headache`, `diarrhea`, `constipation`

**Positive:** `energy_boost`, `better_digestion`, `improved_mood`, `better_sleep`, `clearer_skin`, `reduced_brain_fog`

### Running Migrations

```bash
pnpm db:push    # Generates SQL + runs migration (drizzle-kit generate && drizzle-kit migrate)
```

---

## Authentication System

GutSync uses **email/password authentication only**. The original Manus OAuth was removed and replaced with a custom email auth system. There is no Google login, no social login, and no OAuth redirect.

### How It Works

1. **Registration:** User submits email + password (min 8 chars) via `auth.registerEmail` procedure. Password is hashed with bcrypt (10 rounds). A new user row is created with `loginMethod: 'email'`.

2. **Login:** User submits email + password via `auth.loginEmail`. Password is verified with `bcrypt.compare()`. On success, `lastSignedIn` is updated.

3. **Session:** On successful register/login, the server creates a JWT token via `sdk.createSessionToken(userId.toString(), { name })` and sets it as an HTTP-only cookie named `app_session_id` with a 1-year expiry.

4. **Auth Check:** Every tRPC request goes through `authenticateRequest()` in `server/_core/sdk.ts`. For email-auth users, the JWT's `openId` field contains the numeric user ID (as a string). The function first tries `getUserByOpenId()`, and if that fails, parses the ID as a number and calls `getUserById()`.

5. **Frontend:** `useAuth()` hook calls `trpc.auth.me.useQuery()` to get the current user. Unauthenticated users are redirected to `/auth` (the `EmailAuth` page) via the global error handler in `main.tsx`.

### Key Files

| File | Role |
|------|------|
| `server/emailAuth.ts` | `registerEmail()` and `loginEmail()` functions |
| `server/_core/sdk.ts` | `authenticateRequest()` — patched at line ~273 for email-auth numeric ID lookup |
| `client/src/pages/EmailAuth.tsx` | Login/register UI (toggle between modes) |
| `client/src/const.ts` | `getLoginUrl()` returns `"/auth"` |
| `client/src/main.tsx` | Global error handler redirects `UNAUTHED_ERR_MSG` to login |

### Critical Note for Future AI Agents

The `authenticateRequest()` function in `server/_core/sdk.ts` has been patched to support email-auth users. The `_core` directory is normally off-limits, but this patch is necessary because email-auth users store their numeric `user.id` in the JWT's `openId` field (since they have no OAuth openId). If you ever regenerate or update `_core` files, **you must preserve this patch** (lines ~273–279).

---

## API Reference (tRPC Procedures)

All procedures are defined in `server/routers.ts`. Database helpers are in `server/db.ts`.

### Auth Router (`auth.*`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `auth.me` | query | public | Returns current user or `null` |
| `auth.registerEmail` | mutation | public | Register with email + password + optional name |
| `auth.loginEmail` | mutation | public | Login with email + password |
| `auth.logout` | mutation | public | Clears session cookie |

### Meals Router (`meals.*`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `meals.list` | query | protected | Get user's meals (default limit: 20) |
| `meals.analyzePhoto` | mutation | protected | Upload photo → S3, run AI analysis, return foods + mealType + summary. **Does NOT save the meal** — saving happens via `logManual` |
| `meals.logManual` | mutation | protected | Save a meal with mealType, foods array, optional notes and photoUrl |
| `meals.update` | mutation | protected | Update meal's type, foods, or notes |
| `meals.delete` | mutation | protected | Delete a meal by ID |

### Symptoms Router (`symptoms.*`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `symptoms.list` | query | protected | Get user's symptoms (default limit: 20) |
| `symptoms.log` | mutation | protected | Log a symptom or positive outcome with type + severity (1–5) |

### Insights Router (`insights.*`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `insights.correlations` | query | protected | Get all discovered correlations |
| `insights.runAnalysis` | mutation | protected | Run AI correlation analysis on last 7 days of data |
| `insights.dashboard` | query | protected | Get dashboard data: gut score, recent meals, symptoms, top correlation |

### Subscription Router (`subscription.*`)

| Procedure | Type | Auth | Description |
|-----------|------|------|-------------|
| `subscription.status` | query | protected | Get tier, scan count, remaining scans |
| `subscription.activate` | mutation | protected | Activate premium (verifies with RevenueCat if key configured) |
| `subscription.restore` | mutation | protected | Restore purchases via RevenueCat |
| `subscription.webhook` | mutation | public | RevenueCat webhook endpoint |

---

## Core Feature Flows

### Food Scanning Flow

This is the most complex flow in the app. Understanding it is critical.

```
User taps scan button (BottomNav center)
  → FoodCaptureModal opens (step: "upload")
  → User takes photo or uploads from gallery
  → handleFileSelect() fires
  → runAnalysis(file) called:
      1. Convert file to base64
      2. Call trpc.meals.analyzePhoto.mutateAsync()
         Server-side:
         a. Check free-tier limit (3/day for non-premium)
         b. Upload image to S3 via storagePut()
         c. Call analyzeFood(photoUrl) → invokeLLM with vision
         d. If no foods detected → throw NO_FOOD_DETECTED
         e. If free tier → incrementScanCount()
         f. Return { photoUrl, mealType, foods, summary }
      3. Display results (step: "results")
      4. Invalidate subscription.status (updates scan counter)
  → User can edit foods (add/remove/change FODMAP)
  → User taps "Save Meal"
  → handleSave() calls trpc.meals.logManual.mutate()
      with mealType, foods, notes, photoUrl
  → Invalidate meals.list + insights.dashboard
  → Modal closes
```

**Critical:** `analyzePhoto` does NOT save the meal. It only analyzes and returns results. The meal is saved separately via `logManual` when the user confirms. This prevents duplicate entries.

### Symptom Logging Flow

```
User navigates to Symptoms page
  → Two tabs: "Symptoms" (negative) and "Positive Outcomes"
  → User taps a symptom type → severity picker (1–5)
  → Calls trpc.symptoms.log.mutate()
  → Invalidates symptoms.list + insights.dashboard
```

### Correlation Analysis Flow

```
User navigates to Insights page → taps "Run Analysis"
  → Calls trpc.insights.runAnalysis.mutate()
  → Server fetches last 7 days of meals + symptoms
  → Sends to LLM for pattern detection
  → Saves discovered correlations to DB
  → Returns results to display
```

---

## Frontend Pages and Navigation

The app uses a mobile-first bottom navigation bar (`BottomNav.tsx`) with 5 tabs. The center tab is a prominent scan button.

| Route | Page | Description |
|-------|------|-------------|
| `/auth` | EmailAuth | Login/register (BottomNav hidden) |
| `/` | Home | Dashboard with gut score, recent meals, symptoms, timeline |
| `/food` | FoodLog | Meal history with swipe-to-delete, inline edit |
| `/symptoms` | Symptoms | Log symptoms and positive outcomes (tabbed) |
| `/insights` | Insights | AI-discovered food-symptom correlations |
| `/profile` | Profile | User info, subscription status, logout |

The BottomNav layout is: **Home — Food — [Scan] — Symptoms — Insights**. The scan button opens `FoodCaptureModal` as a bottom sheet. Long-pressing the scan button opens the file picker directly for gallery upload.

First-time users see an onboarding flow (`Onboarding.tsx`) stored in `localStorage` as `gutsync_onboarded`.

---

## Design System

The app uses an "Organic Minimalism" design language with warm, calming colors. The theme is defined in `client/src/index.css` using OKLCH color format (required by Tailwind 4).

### Color Palette

| Token | OKLCH Value | Usage |
|-------|-------------|-------|
| `--sage` | `oklch(0.55 0.1 155)` | Primary green, CTAs, positive indicators |
| `--sage-light` | `oklch(0.92 0.04 155)` | Light green backgrounds |
| `--sage-dark` | `oklch(0.35 0.08 155)` | Dark green text |
| `--coral` | `oklch(0.65 0.15 25)` | Warnings, high FODMAP indicators |
| `--coral-light` | `oklch(0.92 0.04 25)` | Light coral backgrounds |
| `--sand` | `oklch(0.92 0.03 80)` | Moderate FODMAP, warm neutrals |
| `--background` | `oklch(0.98 0.005 80)` | Page background (warm off-white) |

### Typography

The app uses **Plus Jakarta Sans** (imported via Google Fonts in `client/index.html`) as the primary font, with a display variant for headings.

### FODMAP Color Coding

Throughout the app, FODMAP levels are color-coded consistently:
- **Low FODMAP:** sage/green badge
- **Moderate FODMAP:** sand/amber badge
- **High FODMAP:** coral/red badge

---

## Subscription and Monetization

The app uses a freemium model enforced server-side.

### Free Tier Limits

- **3 AI scans per day** (tracked in `scan_usage` table by date)
- Unlimited manual meal logging, symptom tracking, and insights viewing

### Enforcement

The `analyzePhoto` procedure checks `isPremium()` and `getTodayScanCount()` before processing. If the limit is reached, it throws `FREE_LIMIT_REACHED:{count}`. The client catches this and shows the `Paywall` component.

After each successful scan, `incrementScanCount()` is called and `subscription.status` is invalidated to update the remaining scans counter in the UI.

### RevenueCat Integration

RevenueCat is configured but not yet fully wired for production. The `subscription.activate` procedure verifies purchases via the RevenueCat REST API if `REVENUECAT_SECRET_KEY` is set. Without the key, it trusts the client (dev/test mode).

Environment variables: `REVENUECAT_SECRET_KEY` (server), `VITE_REVENUECAT_PUBLIC_KEY` (client).

---

## PWA Configuration

The app is configured as a Progressive Web App for deployment to the Google Play Store via [PWA Builder](https://pwabuilder.com).

### manifest.json

Located at `client/public/manifest.json` with:
- App ID: `com.gutsync.app`
- Display: `standalone`, orientation: `portrait-primary`
- Icons: 192x192 and 512x512 PNG (hosted on CDN)
- Screenshots: 3 narrow-format screenshots (1536x2752)
- Shortcuts: "Scan Meal" and "Log Symptom"
- Categories: health, lifestyle

### Service Worker

A basic service worker is registered in `client/index.html` for offline caching support.

---

## Development Guide

### Prerequisites

- Node.js 22+
- pnpm (package manager)
- Access to the Manus platform (for database, S3, LLM credentials)

### Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (tsx watch)
pnpm build            # Build for production (vite + esbuild)
pnpm test             # Run all tests (vitest)
pnpm check            # TypeScript type check
pnpm db:push          # Generate + run database migrations
```

### Adding a New Feature

Follow this workflow:

1. **Schema:** Add/modify tables in `drizzle/schema.ts`, then run `pnpm db:push`.
2. **DB Helpers:** Add query functions in `server/db.ts`.
3. **Procedures:** Add tRPC procedures in `server/routers.ts` using `protectedProcedure` or `publicProcedure`.
4. **Frontend:** Call procedures via `trpc.*.useQuery()` or `trpc.*.useMutation()` in React components.
5. **Tests:** Add tests in `server/*.test.ts` and run `pnpm test`.

### Environment Variables

All environment variables are injected by the platform. Do not hardcode or commit `.env` files. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | MySQL/TiDB connection string |
| `JWT_SECRET` | Session cookie signing |
| `BUILT_IN_FORGE_API_URL` | LLM and S3 API base URL |
| `BUILT_IN_FORGE_API_KEY` | Server-side API key |
| `REVENUECAT_SECRET_KEY` | RevenueCat API key (optional) |
| `VITE_REVENUECAT_PUBLIC_KEY` | RevenueCat client key (optional) |

### Static Assets

All images and media **must** be uploaded via `manus-upload-file --webdev` and referenced by CDN URL. Do not store images in `client/public/` or `client/src/assets/` — this causes deployment timeouts.

---

## Testing

The project has 38 tests across 4 test files, all using Vitest with mocked database and LLM calls.

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `server/gutsync.test.ts` | 20 | Dashboard, analyzePhoto, meals CRUD, symptoms, insights, subscription, free-tier limits |
| `server/meals.test.ts` | 12 | Meal listing, manual logging, update, delete |
| `server/emailAuth.test.ts` | 5 | Registration, login, duplicate email, wrong password |
| `server/auth.logout.test.ts` | 1 | Logout clears cookie |

### Running Tests

```bash
pnpm test              # Run all tests
pnpm test -- --watch   # Watch mode
```

### Test Patterns

Tests mock `server/db.ts` and `server/_core/llm.ts` using `vi.mock()`. The LLM mock returns a fixed food analysis response. Tests create a tRPC caller with a mock authenticated context and call procedures directly.

---

## Known Issues and Limitations

1. **Messenger In-App Browser:** The food scan camera does not work in Facebook Messenger's in-app browser due to restricted camera API access. Users must open the app in their default browser.

2. **Wearable Data Table:** The `wearable_data` table still exists in the schema but the feature has been completely removed from the codebase (routers, UI, tests). The table can be dropped in a future migration.

3. **RevenueCat Webhook:** The `subscription.webhook` procedure is a placeholder. It logs events but does not look up users by `rcCustomerId` — it uses a hardcoded `userId: 0`. This needs to be implemented for production.

4. **Correlation Analysis:** Currently only identifies trigger foods (negative correlations). Does not yet show "beneficial foods" that correlate with positive outcomes.

5. **Home Page Mock Data:** The Home page (`Home.tsx`) uses mock data generators from `lib/store.ts` for the gut health score, recent meals, and symptoms display. These should be replaced with real tRPC queries (the `insights.dashboard` query exists but is not yet wired to the Home page).

---

## Pending Work

The following items from `todo.md` are not yet completed:

| Priority | Item |
|----------|------|
| High | Create privacy policy page (required for Google Play Store health app submission) |
| High | Add meal type picker on results screen (let user override AI-detected type before saving) |
| Medium | Update correlation analysis to show "beneficial foods" alongside trigger foods |
| Medium | Write tests for positive outcome logging and correlation |
| Low | Update VITE_APP_TITLE to "GutSync" (user action in Settings panel) |
| Low | Upload new logo and update VITE_APP_LOGO (user action in Settings panel) |
| Low | Update favicon with new logo (user action in Settings panel) |

---

## Important Implementation Notes

These are hard-won lessons from debugging. Future AI agents should read this section carefully.

### 1. analyzePhoto Does NOT Save Meals

The `meals.analyzePhoto` procedure only uploads the photo, runs AI analysis, and returns results. It does **not** call `createMeal()`. Saving happens separately via `meals.logManual` when the user confirms. This was an intentional fix to prevent duplicate meal entries.

### 2. Scan Count Column Name

The `scan_usage` table uses camelCase column names in the database (e.g., `scanCount`, `usageDate`). When writing raw SQL in Drizzle, always use the Drizzle column reference (`sql\`${scanUsage.scanCount} + 1\``) instead of hardcoded column names. The column is NOT `scan_count` — it is `scanCount`.

### 3. Email Auth JWT Payload

For email-auth users, the JWT's `openId` field contains the user's numeric ID as a string (e.g., `"42"`). The `authenticateRequest()` function in `server/_core/sdk.ts` (lines ~273–279) has been patched to handle this by falling back to `getUserById(parseInt(openId))` when `getUserByOpenId()` returns null.

### 4. Photo URL Persistence

When a user scans a meal, the S3 photo URL is returned by `analyzePhoto` and stored in component state as `savedPhotoUrl`. This URL is then passed to `logManual` via the `photoUrl` field. If this chain breaks, meal photos will not appear on meal tiles in the food log.

### 5. Free Tier Scan Counter

After a successful scan, two things must happen: (a) `incrementScanCount()` is called server-side, and (b) `subscription.status` is invalidated client-side so the UI updates the remaining scans counter immediately without requiring a page refresh.

### 6. The `_core` Directory

Files in `server/_core/` are framework plumbing and should not be edited. The one exception is the email-auth patch in `sdk.ts` (see note #3 above). If `_core` files are regenerated, the patch must be reapplied.

### 7. FODMAP Is Behind the Scenes

User-facing messaging uses "food sensitivity" language, not "FODMAP." The FODMAP analysis still runs behind the scenes and FODMAP labels appear on individual food items, but headings, descriptions, and marketing copy say "food sensitivity tracker" instead of "FODMAP tracker."
