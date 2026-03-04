# Mobile App Builder Architecture

`mp-mobile-app-builder` is a standalone repository whose sole purpose is producing signed, distributable native app packages for the iOS App Store and Google Play Store.

For the mobile app itself (development, features, OTA updates) see [Mobile App Architecture](./mobile-app-overview). For deployment steps see [iOS Build](./ios-build) and [Android Build](./android-build).

---

## Why a Separate Repo?

`mp-mobile-app` (the main patient app) and `mp-mobile-app-builder` serve different purposes and deliberately stay separated:

|                  | mp-mobile-app                                   | mp-mobile-app-builder                                      |
| ---------------- | ----------------------------------------------- | ---------------------------------------------------------- |
| **Purpose**      | Active development, web deployment, OTA updates | Native app store package production only                   |
| **Nuxt version** | Nuxt 4 (latest)                                 | Nuxt 3 (older — may lag behind)                            |
| **Dependencies** | Full dev toolchain, mobile plugins, Capacitor   | Minimal — only what's needed for a static build + Fastlane |
| **Used by**      | Developers daily                                | CI/CD + release engineers on release day                   |
| **Native repos** | `ios/` + `android/` submodules                  | `ios/` + `android/` submodules (separate native repos)     |

**Why keep the Nuxt version older in the builder?**

The builder only needs to produce a static bundle (`nuxt generate`). Upgrading it in lockstep with `mp-mobile-app` every time would add risk to release builds with no benefit. The builder is upgraded deliberately when needed.

---

## How a Native Build Works

```
mp-mobile-app-builder
  │
  ├─ nuxt generate              → .output/public/ (static web bundle)
  │
  ├─ npx cap sync               → copies .output/public/ into ios/App/public/
  │                               and android/app/src/main/assets/public/
  │
  ├─ Fastlane ios beta          → xcodebuild archive → IPA → TestFlight
  │
  └─ Fastlane android internal  → gradle bundle Release → AAB → Play Store internal
```

### Step 1 — Static generation

`nuxt generate` produces a fully static bundle in `.output/public/`. This is the web content that will run inside the native WebView.

### Step 2 — Capacitor sync

`npx cap sync` copies the generated web bundle into the native projects and installs any Capacitor plugin native code changes.

### Step 3 — Fastlane build + upload

Fastlane handles code signing, archiving, and store upload. See [iOS Build](./ios-build) and [Android Build](./android-build) for full lane documentation.

---

## Repository Structure

```
mp-mobile-app-builder/
  ios/                              ← git submodule → mp-mobile-app-ios-native
    App/
      fastlane/
        Fastfile                    ← beta lane: setup_ci + match + build + upload
        Appfile                     ← com.medipal.sigil + team/issuer IDs
      App.xcodeproj/
      capacitor.config.json
  android/                          ← git submodule → mp-mobile-app-android-native
    fastlane/
      Fastfile                      ← internal lane: gradle bundle + play store upload
      Appfile                       ← com.medipal.sigil
    app/
      src/
  nuxt.config.ts
  capacitor.config.ts
  package.json
```

---

## Git Submodules

The native Xcode and Android Studio projects live in separate repositories to keep platform-specific build artifacts, provisioning data, and IDE files isolated from the web codebase.

| Submodule path | Repository                     |
| -------------- | ------------------------------ |
| `ios/`         | `mp-mobile-app-ios-native`     |
| `android/`     | `mp-mobile-app-android-native` |

After cloning `mp-mobile-app-builder`, always initialize submodules:

```bash
git clone --recurse-submodules <mp-mobile-app-builder>
# or:
git submodule update --init --recursive
```

When the native projects are updated (Xcode project settings, Capacitor plugin native code), update the submodule pointer:

```bash
cd ios && git pull origin main && cd ..
git add ios && git commit -m "chore: update ios native submodule"
```

---

## Live Update Bundle

When the `USE_LIVE_UPDATE` environment variable is set, `npm run generate` additionally produces:

- `live-update.zip` — compressed web bundle for OTA delivery
- `manifest.json` — `{ hash, version, timestamp, contentUrl }`

These are uploaded to the `updates.{env}.medipal.dev` CDN endpoint (served by `mp-frontend-nginx-proxy`). The running app checks this manifest on startup and downloads the zip if its local hash is stale.

```bash
USE_LIVE_UPDATE=true npm run generate
```

See [Mobile App Architecture — Live Update](./mobile-app-overview#live-update-architecture) for the full OTA update flow.

---

## Key Environment Variables

| Variable                            | Used in            | Purpose                                              |
| ----------------------------------- | ------------------ | ---------------------------------------------------- |
| `API_URL`                           | Nuxt build         | Backend API base URL baked into the bundle           |
| `API_KEY`                           | Nuxt build         | API key baked into the bundle                        |
| `CRYPTO_KEY`                        | Nuxt build         | AES key for deep-link token decryption               |
| `LIVE_UPDATE_URL`                   | Nuxt build         | OTA update server URL                                |
| `USE_LIVE_UPDATE`                   | Nuxt generate      | Enables live-update zip + manifest generation        |
| `APP_STORE_CONNECT_API_KEY_ID`      | Fastlane (iOS)     | App Store Connect API authentication                 |
| `APP_STORE_CONNECT_API_ISSUER_ID`   | Fastlane (iOS)     | App Store Connect API authentication                 |
| `APP_STORE_CONNECT_API_KEY_CONTENT` | Fastlane (iOS)     | `.p8` key content                                    |
| `MATCH_PASSWORD`                    | Fastlane (iOS)     | Passphrase for `mp-fastlane-certificates` decryption |
| `ANDROID_KEYSTORE_*`                | Fastlane (Android) | APK/AAB signing                                      |

---

## npm Scripts

| Script                  | What it does                         |
| ----------------------- | ------------------------------------ |
| `npm run build`         | `nuxt generate` (web bundle only)    |
| `npm run build:ios`     | `nuxt generate` + `cap sync ios`     |
| `npm run build:android` | `nuxt generate` + `cap sync android` |

---

## See Also

- [iOS Build](./ios-build) — Fastlane beta lane, code signing, TestFlight
- [Android Build](./android-build) — Fastlane internal lane, Play Store
- [Mobile App Architecture](./mobile-app-overview) — the main app, live updates, offline sync
- [Platform Overview](/overview/platform) — how the builder fits into the broader system
