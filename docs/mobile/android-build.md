# Android Build

This page covers building and distributing the Medipal Android app to Google Play internal testing using `mp-mobile-app-builder` and Fastlane.

---

## Overview

`mp-mobile-app-builder` is a separate repository from `mp-mobile-app`. It exists solely for producing signed, distributable native app packages. The main development repo stays clean of app store build tooling.

See [Mobile App Builder Architecture](./mobile-app-builder) for an explanation of why the repos are separated.

---

## Prerequisites

- **Android Studio** (Flamingo or newer) with SDK platform for the target API level
- **JDK 17** — required by Gradle
- **Fastlane** — `brew install fastlane` or `gem install fastlane`
- **Node.js / npm** — for the Nuxt static generation step
- Google Play service account credentials JSON (see [Credentials](#credentials))

---

## Repository Structure

```
mp-mobile-app-builder/
  android/                      ← git submodule → mp-mobile-app-android-native
    fastlane/
      Fastfile                  ← Fastlane lane definitions
      Appfile                   ← Package name and credentials path
  ios/                          ← git submodule → mp-mobile-app-ios-native
  ...nuxt.config.ts / package.json
```

The `android/` directory is a git submodule pointing to `mp-mobile-app-android-native`. Always initialize submodules after cloning:

```bash
git clone --recurse-submodules <mp-mobile-app-builder>
# or after a plain clone:
git submodule update --init --recursive
```

---

## Building

### Manual (step by step)

```bash
# 1. Generate static web bundle
npm run build

# 2. Sync web bundle into the Android native project
npx cap sync android

# 3. Open in Android Studio (optional — for manual inspection / signing)
npx cap open android
```

### Shortcut

```bash
npm run build:android
```

This single command runs the Nuxt static generation and Capacitor sync in sequence.

---

## Fastlane Internal Lane

The `internal` lane automates the full Google Play internal track upload. Run it from the root of `mp-mobile-app-builder`:

```bash
fastlane android internal
```

### What the lane does (`android/fastlane/Fastfile`)

```ruby
lane :internal do
  gradle(
    task: "clean bundle",
    build_type: "Release"
  )
  upload_to_play_store(
    track: "internal",
    release_status: "draft",
    json_key: "medipal-play-console.json"
  )
end
```

| Step                                                  | Purpose                                                        |
| ----------------------------------------------------- | -------------------------------------------------------------- |
| `gradle(task: "clean bundle", build_type: "Release")` | Clean build + produce signed `.aab` (Android App Bundle)       |
| `upload_to_play_store`                                | Upload `.aab` to the internal testing track as a draft release |

**Output artifact:** `app-release.aab` — Android App Bundle format (required by Play Store).

The release is uploaded as `release_status: "draft"`, meaning it does not roll out to testers automatically. A human must promote the draft to active in the Play Console.

---

## Required Env Vars

| Variable                    | Purpose                                               |
| --------------------------- | ----------------------------------------------------- |
| `ANDROID_KEYSTORE_FILE`     | Path to the `.jks` / `.keystore` signing file         |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password                                     |
| `ANDROID_KEY_ALIAS`         | Key alias within the keystore                         |
| `ANDROID_KEY_PASSWORD`      | Key password                                          |
| `API_URL`                   | Backend API base URL embedded in the generated bundle |
| `API_KEY`                   | API key embedded in the bundle                        |
| `CRYPTO_KEY`                | AES key for deep-link authentication token decryption |
| `LIVE_UPDATE_URL`           | OTA update endpoint (when `USE_LIVE_UPDATE=true`)     |

::: warning Keep CRYPTO_KEY in sync
`CRYPTO_KEY` must match the value configured in the backend. A mismatch causes silent decryption failures during patient deep-link authentication.
:::

---

## Credentials

### Google Play service account

The Play Store upload uses a Google service account JSON key: `medipal-play-console.json`.

To set up the service account:

1. Create a service account in Google Cloud Console with the **Service Account User** role
2. In Google Play Console → Setup → API access, link the service account and grant **Release Manager** permissions
3. Download the JSON key and store it securely — reference its path in `json_key` (Fastfile) or `SUPPLY_JSON_KEY` env var

::: danger Do not commit credentials
`medipal-play-console.json` must never be committed to version control. Store it in CI secrets and inject it at build time (e.g., write the base64-decoded content to a temp file).
:::

### Android signing keystore

The release keystore is used by Gradle's `signingConfig` to sign the `.aab`. Store the keystore file and its passwords in CI secrets:

```bash
# Example: decode base64-encoded keystore from CI secret
echo "$KEYSTORE_BASE64" | base64 --decode > android/app/release.keystore
```

---

## Package Name

| Field               | Value                              |
| ------------------- | ---------------------------------- |
| Package name        | `com.medipal.sigil`                |
| Distribution target | Google Play internal testing track |
| Min SDK             | Android 8.0 (API 26)               |

---

## CI Integration

In CI (GitHub Actions via `mp-github-actions`), the `internal` lane runs automatically. Required secrets:

- `ANDROID_KEYSTORE_FILE` (base64-encoded keystore content)
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`
- `GOOGLE_PLAY_JSON_KEY` (base64-encoded service account JSON)
- Runtime env vars (`API_URL`, `API_KEY`, `CRYPTO_KEY`, `LIVE_UPDATE_URL`)

---

## Promoting a Release

After the `internal` lane runs successfully:

1. Open [Google Play Console](https://play.google.com/console) → `com.medipal.sigil`
2. Testing → Internal testing → find the uploaded draft release
3. Click **Promote release** to make it available to internal testers
4. To promote further: Internal → Closed → Open → Production

---

## See Also

- [iOS Build](./ios-build) — TestFlight distribution
- [Mobile App Builder Architecture](./mobile-app-builder) — why the builder repo exists
- [Mobile App Architecture](./mobile-app-overview) — live update, offline sync, authentication
