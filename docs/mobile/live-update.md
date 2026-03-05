# Live Update

::: info
This section is under development.
:::

The `mp-mobile-app-live-update` is a custom Capacitor plugin that enables over-the-air (OTA) updates for the mobile application.

## Purpose

Live updates allow deploying web layer changes to users instantly without going through the app store review process.

## How It Works

1. The app checks for available updates on launch
2. If an update is available, the new bundle is downloaded in the background
3. On next launch, the app loads the updated bundle
4. Rollback is supported if the new bundle fails to load

## Why Custom?

Medipal uses a custom plugin instead of Ionic's paid Appflow service, giving full control over the update infrastructure and reducing external dependencies.

---

## Live Update Manager

The [Live Update Manager](/mobile/live-update-manager) (`mp-live-update-manager`) is the server-side companion that manages the OTA bundle lifecycle:

- **Build orchestration** — queues builds from any git branch/tag of `mp-mobile-app`, runs `nuxt generate`, packages and uploads to S3
- **Environment promotion** — deploy bundles to development, staging, or production with one click
- **CDN invalidation** — automatic CloudFront cache invalidation on deployment
- **Audit trail** — every action (build, deploy, delete) is logged with user and timestamp

`mp-mobile-app-live-update` is the **client-side Capacitor plugin** (runs on device), while `mp-live-update-manager` is the **server-side management tool** (builds and deploys bundles).

See [Live Update Manager](/mobile/live-update-manager) for full documentation.
