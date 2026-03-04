# Native Submodules

::: info
This section is under development.
:::

The native iOS and Android projects are maintained in separate repositories and included as submodules in the mobile app build process.

## Repositories

- `mp-mobile-app-ios` — Xcode project with native iOS configuration
- `mp-mobile-app-android` — Android Studio project with native Android configuration

## Native Configuration

Each native project contains platform-specific configuration including app icons, splash screens, permissions, and build settings.

## Capacitor Integration

Capacitor bridges the web layer (Nuxt) with native APIs. Custom native plugins are registered in the respective native projects.
