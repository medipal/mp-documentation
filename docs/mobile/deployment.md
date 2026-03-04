# Build & Deployment

## Build Command

```bash
npm run generate
```

Runs `nuxt generate` which outputs static files to `.output/public/`, then runs `scripts/generate_live_update_package.js` which creates the live update ZIP + manifest.

All rendering is client-side (SPA, `ssr: false`). Secrets are injected at build time.

## Live Updates

The app supports OTA (over-the-air) content updates without going through the App Store or Google Play.

### How It Works

1. `nuxt generate` builds the static files
2. `scripts/generate_live_update_package.js` creates:
   - `dist/update/live-update.zip` — compressed web assets
   - `dist/update/manifest.json` — version descriptor
3. The ZIP + manifest are deployed to the live update server
4. On app launch, `@medipal/mp-mobile-app-live-update` checks for a newer manifest version
5. If found, downloads and extracts the ZIP, then reloads the app

### When to Use

Live updates are suitable for content-only changes (UI text, style tweaks, questionnaire logic). Native code changes (`capacitor.config.ts`, new Capacitor plugins, `ios/`, `android/`) still require a full App Store submission.

## Docker

Multi-stage build:

```dockerfile
# Stage 1: Builder
FROM node:20-alpine AS builder
# Installs deps, runs nuxt generate
# Secrets mounted via BuildKit

# Stage 2: Runtime
FROM nginx:alpine
# Copies .output/public/
# Serves static files via Nginx
# No Node.js in production image
```

### BuildKit Secrets

Secrets are mounted from `.secrets/` (never committed) via Docker BuildKit — they are not baked into the image:

| Secret            | Description                                    |
| ----------------- | ---------------------------------------------- |
| `GIGET_AUTH`      | GitHub PAT for private `@medipal` npm packages |
| `NPM_TOKEN`       | npm registry token for `@medipal` packages     |
| `API_URL`         | Main backend URL                               |
| `TRACKER_API_URL` | Tracker API URL                                |
| `TRACKER_API_KEY` | Tracker API key                                |
| `CRYPTO_KEY`      | AES key for deep link decryption               |

### Nginx

The Nginx runtime stage serves the SPA with:

- All routes fall back to `index.html` (required for client-side routing)
- Gzip compression for static assets
- Cache headers for versioned assets

## CI/CD

### Branch → Environment

| Branch        | Environment                        |
| ------------- | ---------------------------------- |
| `development` | Dev                                |
| `staging`     | Staging                            |
| `main`        | Production (manual trigger or tag) |

### Pipeline

```
Push to branch
    → GitHub Actions (shared from medipal/mp-github-actions)
    → Docker build (BuildKit secrets)
    → Push to AWS ECR
    → Deploy to AWS EC2 (pull new image, restart container)
```

## Native App Builds

Native builds (iOS/Android) are a separate process from the web deployment:

```bash
# 1. Build web assets
npm run generate

# 2. Sync to native projects
npx cap sync

# iOS
npx cap open ios      # Opens Xcode
# Archive → distribute via TestFlight / App Store

# Android
npx cap open android  # Opens Android Studio
# Build signed APK → Google Play
```

::: tip Live updates reduce native releases
Most UI and logic changes can be shipped via live update without a new native binary. Only ship a new native binary when Capacitor plugins, native permissions, or `capacitor.config.ts` change.
:::

## Version Bumping

When releasing:

1. Update `CHANGELOG.md` — move unreleased entries to a versioned section
2. Bump `version` in `package.json`:
   - `MAJOR` — breaking changes
   - `MINOR` — new features (backward-compatible)
   - `PATCH` — bug fixes

Both in the same commit as the change.
