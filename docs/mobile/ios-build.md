# iOS Build

This page covers building and distributing the Medipal iOS app through TestFlight using `mp-mobile-app-builder` and Fastlane.

---

## Overview

`mp-mobile-app-builder` is a separate repository from `mp-mobile-app`. It exists solely for producing signed, distributable native app packages. It keeps the main development repo (`mp-mobile-app`) free of app store build tooling and certificate management.

See [Mobile App Builder Architecture](./mobile-app-builder) for an explanation of why the repos are separated.

---

## Prerequisites

- **Xcode** 15+ installed on macOS
- **Fastlane** — `brew install fastlane` or `gem install fastlane`
- **Node.js / npm** — for the Nuxt static generation step
- Access to the `mp-fastlane-certificates` private repository
- App Store Connect API key (see [Required Env Vars](#required-env-vars))

---

## Repository Structure

```
mp-mobile-app-builder/
  ios/                          ← git submodule → mp-mobile-app-ios-native
    App/
      fastlane/
        Fastfile                ← Fastlane lane definitions
        Appfile                 ← App ID and team configuration
  android/                      ← git submodule → mp-mobile-app-android-native
  ...nuxt.config.ts / package.json
```

The `ios/` directory is a git submodule pointing to `mp-mobile-app-ios-native`. Always initialize submodules after cloning:

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

# 2. Sync web bundle into the iOS native project
npx cap sync ios

# 3. Open in Xcode (optional — for manual inspection / archiving)
npx cap open ios
```

### Shortcut

```bash
npm run build:ios
```

This single command runs the Nuxt static generation and Capacitor sync in sequence.

---

## Fastlane Beta Lane

The `beta` lane automates the full TestFlight upload pipeline. Run it from the root of `mp-mobile-app-builder`:

```bash
fastlane ios beta
```

### What the lane does (`ios/App/fastlane/Fastfile`)

```ruby
lane :beta do
  setup_ci                    # configure keychain for CI environments
  increment_build_number      # bump CFBundleVersion
  sync_code_signing(          # fetch/create certs via fastlane match
    type: "appstore"
  )
  build_app                   # xcodebuild archive + export
  upload_to_testflight        # upload IPA to App Store Connect
end
```

| Step                     | Purpose                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `setup_ci`               | Creates a temporary keychain on CI; no-op on local macOS                              |
| `increment_build_number` | Queries App Store Connect for current build number and increments by 1                |
| `sync_code_signing`      | Pulls distribution certificate + provisioning profile from `mp-fastlane-certificates` |
| `build_app`              | Produces a signed `.ipa` archive                                                      |
| `upload_to_testflight`   | Uploads to TestFlight under the `com.medipal.sigil` app ID                            |

---

## Required Env Vars

| Variable                            | Purpose                                                        |
| ----------------------------------- | -------------------------------------------------------------- |
| `APP_STORE_CONNECT_API_KEY_ID`      | Key ID from App Store Connect → Users and Access → Keys        |
| `APP_STORE_CONNECT_API_ISSUER_ID`   | Issuer ID from the same page                                   |
| `APP_STORE_CONNECT_API_KEY_CONTENT` | Full content of the `.p8` private key file (base64 or raw)     |
| `MATCH_PASSWORD`                    | Passphrase to decrypt `mp-fastlane-certificates` (OpenSSL AES) |
| `API_URL`                           | Backend API base URL embedded in the generated bundle          |
| `API_KEY`                           | API key embedded in the bundle                                 |
| `CRYPTO_KEY`                        | AES key for deep-link authentication token decryption          |
| `LIVE_UPDATE_URL`                   | OTA update endpoint (when `USE_LIVE_UPDATE=true`)              |

::: warning Keep CRYPTO_KEY in sync
`CRYPTO_KEY` must match the value configured in the backend. A mismatch causes silent decryption failures during patient deep-link authentication.
:::

---

## Code Signing via Fastlane Match

Code signing certificates and provisioning profiles are stored encrypted in the `mp-fastlane-certificates` private repository and managed by `fastlane match`.

### mp-fastlane-certificates structure

```
mp-fastlane-certificates/
  certs/
    distribution/             ← Apple Distribution certificates (.cer + .p12)
    development/              ← Apple Development certificates
  profiles/
    appstore/                 ← App Store provisioning profiles
    development/              ← Development provisioning profiles
```

All files are encrypted with OpenSSL using the `MATCH_PASSWORD` passphrase. `fastlane match` decrypts them on demand and installs them into the macOS keychain.

::: danger Repository must remain private
`mp-fastlane-certificates` must stay private. The passphrase (`MATCH_PASSWORD`) is stored separately — in CI secrets, never committed to any repository.
:::

To manually sync certificates to the local machine:

```bash
fastlane match appstore --readonly
```

`--readonly` prevents accidental certificate rotation. Omit it only when you intentionally need to renew or create new certificates.

---

## App ID

| Field               | Value                  |
| ------------------- | ---------------------- |
| Bundle ID           | `com.medipal.sigil`    |
| Distribution target | TestFlight → App Store |
| Platform            | iOS 16+                |

---

## CI Integration

In CI (GitHub Actions via `mp-github-actions`), the `beta` lane runs automatically. Required secrets must be set in the repository or organization secrets:

- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY_CONTENT`
- `MATCH_PASSWORD`
- Runtime env vars (`API_URL`, `API_KEY`, `CRYPTO_KEY`, `LIVE_UPDATE_URL`)

---

## See Also

- [Android Build](./android-build) — Play Store distribution
- [Mobile App Builder Architecture](./mobile-app-builder) — why the builder repo exists
- [Mobile App Architecture](./mobile-app-overview) — live update, offline sync, authentication
