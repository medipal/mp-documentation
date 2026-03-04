# Mobile Ecosystem

::: info
This section is under development.
:::

The Medipal mobile application is built with Nuxt 3 and Capacitor 7, targeting both iOS and Android platforms.

## Repositories

| Repository                                                                              | Description                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------ |
| [mp-mobile-app](https://github.com/medipal/mp-mobile-app)                               | Main Nuxt 3 + Capacitor mobile application |
| [mp-frontend-api](https://github.com/medipal/mp-frontend-api)                           | Auto-generated TypeScript API client       |
| [mp-mobile-app-live-update](https://github.com/medipal/mp-mobile-app-live-update)       | OTA live-update Capacitor plugin           |
| [mp-mobile-app-ios-native](https://github.com/medipal/mp-mobile-app-ios-native)         | Native iOS project                         |
| [mp-mobile-app-android-native](https://github.com/medipal/mp-mobile-app-android-native) | Native Android project                     |

## Key Features

- **Offline-first** — SQLite-backed local storage with background sync
- **Live updates** — OTA updates without app store resubmission
- **Shared layers** — reuses `mp-nuxt-api-layer` with the frontend

## Getting Started

See the [Getting Started](/mobile/getting-started) guide to set up the mobile development environment.
