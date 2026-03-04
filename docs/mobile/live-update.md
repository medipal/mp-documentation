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
