# GutSync AI — App Store Submission Guide

This guide walks you through building and publishing GutSync AI to both the **Apple App Store** and **Google Play Store** using Capacitor. The project is already configured — follow the steps below on your local machine.

---

## Prerequisites

Before you begin, ensure you have the following accounts and tools ready.

| Requirement | Platform | Cost | Link |
|---|---|---|---|
| Apple Developer Account | iOS only | $99/year | [developer.apple.com](https://developer.apple.com/programs/) |
| Google Play Developer Account | Android only | $25 one-time | [play.google.com/console](https://play.google.com/console) |
| Mac with macOS 13+ | iOS only | — | Required by Apple |
| Xcode 15+ | iOS only | Free | Mac App Store |
| Android Studio | Android | Free | [developer.android.com/studio](https://developer.android.com/studio) |
| Node.js 18+ | Both | Free | [nodejs.org](https://nodejs.org) |
| pnpm | Both | Free | `npm install -g pnpm` |

---

## Step 1: Download the Project

Download your project code from the **Code panel** in the Manus Management UI (click the download icon). Extract the ZIP to a folder on your computer, e.g., `~/Projects/gutsync-ai`.

---

## Step 2: Install Dependencies

Open a terminal in the project folder and run:

```bash
pnpm install
```

---

## Step 3: Configure Your Backend URL

Open `capacitor.config.ts` and update the `server.url` to point to your live production backend (your Manus-hosted URL):

```ts
server: {
  url: "https://gutsyncai-aye9tq4o.manus.space",
  cleartext: false,
},
```

> **Important:** Remove the `//` comment characters to enable this block. This tells the native app to load your live backend instead of a local server.

---

## Part A: iOS (Apple App Store)

### Step A1: Build and Sync

Run the following command to build the web app and sync it into the iOS project:

```bash
pnpm run cap:ios
```

This will build the app, sync assets into `ios/`, and open Xcode automatically.

### Step A2: Configure Xcode

Once Xcode opens, you need to configure a few things:

1. **Select your Team:** In the project navigator, click `App` → `Signing & Capabilities` → select your Apple Developer team from the dropdown.
2. **Set Bundle Identifier:** Confirm it reads `ai.gutsync.app` (already set).
3. **Set Version:** Under `General`, set `Version` to `1.0` and `Build` to `1`.
4. **Confirm capabilities:** For this launch, do not enable health/device integrations that are not implemented yet.

### Step A3: Test on a Device

Connect your iPhone via USB. In Xcode, select your device from the top device picker and press **Run (▶)**. The app will install and launch on your phone.

### Step A4: Archive for App Store

1. In Xcode, go to **Product → Archive**.
2. Wait for the archive to complete (2–5 minutes).
3. The **Organizer** window will open automatically.
4. Click **Distribute App → App Store Connect → Upload**.
5. Follow the prompts and click **Upload**.

### Step A5: Submit on App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com).
2. Click **My Apps → + → New App**.
3. Fill in the details:

| Field | Value |
|---|---|
| Name | GutSync AI |
| Bundle ID | ai.gutsync.app |
| SKU | gutsync-ai-001 |
| Primary Language | English (U.S.) |

4. Under **App Information**, set the category to **Health & Fitness**.
5. Under **Pricing**, set to **Free** (or your chosen price).
6. Upload **screenshots** (at minimum: 6.7" iPhone display — 1290×2796px).
7. Write your **App Description** (see the template below).
8. Select the build you uploaded in Step A4.
9. Click **Submit for Review**.

> **Review time:** Apple typically reviews apps within 1–3 business days.

---

## Part B: Android (Google Play Store)

### Step B1: Build and Sync

Run the following command to build the web app and sync it into the Android project:

```bash
pnpm run cap:android
```

This will build the app, sync assets into `android/`, and open Android Studio automatically.

### Step B2: Configure Android Studio

Once Android Studio opens:

1. Wait for Gradle sync to complete (may take a few minutes on first run).
2. Open `android/app/build.gradle` and confirm:
   - `applicationId "ai.gutsync.app"`
   - `versionCode 1`
   - `versionName "1.0"`

### Step B3: Test on a Device

Connect your Android phone via USB with **Developer Mode** and **USB Debugging** enabled. In Android Studio, select your device and click **Run (▶)**.

### Step B4: Generate a Signed Release APK/AAB

1. In Android Studio, go to **Build → Generate Signed Bundle / APK**.
2. Select **Android App Bundle (.aab)** — Google Play requires this format.
3. Click **Create new keystore** and fill in:
   - **Key store path:** Save to a safe location (e.g., `~/gutsync-release.jks`)
   - **Password:** Choose a strong password and **save it securely** — you cannot recover it
   - **Alias:** `gutsync-key`
   - **Validity:** 25 years
4. Click **Next → Release → Finish**.
5. The `.aab` file will be generated at `android/app/release/app-release.aab`.

> **Critical:** Back up your keystore file. If you lose it, you cannot update your app on the Play Store.

### Step B5: Submit on Google Play Console

1. Go to [play.google.com/console](https://play.google.com/console).
2. Click **Create app**.
3. Fill in the details:

| Field | Value |
|---|---|
| App name | GutSync AI |
| Default language | English (United States) |
| App or game | App |
| Free or paid | Free |

4. Complete the **Store Listing** with description, screenshots, and feature graphic (1024×500px).
5. Go to **Production → Create new release**.
6. Upload your `app-release.aab` file.
7. Complete the **Content Rating** questionnaire (select Health & Fitness).
8. Complete the **Data Safety** form (declare camera, health data usage).
9. Click **Review release → Start rollout to Production**.

> **Review time:** Google typically reviews apps within a few hours to 2 business days.

---

## App Store Listing Copy

Use this as a starting point for both stores:

### Short Description (80 characters)
```
Your invisible gut health detective — powered by AI
```

### Full Description
```
GutSync AI is the effortless gut health tracker that does the hard work for you.

Simply photograph your meals and our AI instantly identifies every food item, 
detects hidden ingredients like garlic powder and high-fructose corn syrup, and 
analyzes FODMAP levels — all in seconds.

WHAT MAKES GUTSYNC AI DIFFERENT
• No manual logging — just take a photo
• Detects hidden trigger ingredients your eyes can't see
• Helps connect meals, ingredients, and symptoms over time
• Finds complex trigger patterns (e.g., "bloating when combining dairy + high-fructan vegetables")
• Personalized insights that get smarter over time

PERFECT FOR
• IBS and IBD sufferers
• Anyone following a low-FODMAP diet
• People with chronic bloating, gas, or digestive discomfort
• Those who want to understand their gut without keeping a food diary

PRIVACY FIRST
Your health data is encrypted and never sold. You own your data.

Start your gut health journey today — no food diary required.
```

### Keywords (Apple App Store)
```
gut health, IBS tracker, FODMAP, food diary, calorie tracker, bloating, 
digestive health, food intolerance, AI nutrition, symptom tracker
```

---

## Troubleshooting

**"No provisioning profile" error in Xcode:** Make sure you are signed in with your Apple Developer account under Xcode → Settings → Accounts, and that your device is registered in the Apple Developer portal.

**Gradle sync fails in Android Studio:** Go to File → Invalidate Caches → Invalidate and Restart.

**App loads a blank white screen:** Confirm the `server.url` in `capacitor.config.ts` is set to your live production URL and the server is running.

**Camera not working on device:** Ensure you granted camera permissions when prompted. On iOS, go to Settings → GutSync AI → Camera and toggle it on.

---

## After Publishing

Once live, remember to:

1. **Monitor crash reports** via App Store Connect (Xcode Organizer) and Google Play Console (Android Vitals).
2. **Respond to reviews** — early engagement with reviewers signals quality to the stores.
3. **Update regularly** — apps with frequent updates rank higher in search.
4. **Set up TestFlight (iOS)** for beta testing before each major update.

---

*Generated for GutSync AI v1.0 — March 2026*
