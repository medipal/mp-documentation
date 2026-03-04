# Mobile Ecosystem

The Medipal mobile application is built with Nuxt 4 and Capacitor 7, targeting both iOS and Android platforms.

## Repositories

| Repository                                                                              | Description                                |
| --------------------------------------------------------------------------------------- | ------------------------------------------ |
| [mp-mobile-app](https://github.com/medipal/mp-mobile-app)                               | Main Nuxt 4 + Capacitor mobile application |
| [mp-mobile-app-api](https://github.com/medipal/mp-mobile-app-api)                       | Auto-generated TypeScript API client       |
| [mp-mobile-app-tracker-api](https://github.com/medipal/mp-mobile-app-tracker-api)       | Auto-generated TypeScript tracker client   |
| [mp-mobile-app-live-update](https://github.com/medipal/mp-mobile-app-live-update)       | OTA live-update Capacitor plugin           |
| [mp-mobile-app-builder](https://github.com/medipal/mp-mobile-app-builder)               | Native distribution builds                 |
| [mp-mobile-app-ios-native](https://github.com/medipal/mp-mobile-app-ios-native)         | Native iOS project                         |
| [mp-mobile-app-android-native](https://github.com/medipal/mp-mobile-app-android-native) | Native Android project                     |
| [mp-nuxt-api-layer](https://github.com/medipal/mp-nuxt-api-layer)                       | Shared Nuxt API layer                      |
| [mp-nuxt-msal-plugin](https://github.com/medipal/mp-nuxt-msal-plugin)                   | Azure AD MSAL authentication plugin        |

## Key Features

- **Offline-first** — SQLite-backed local storage with background sync
- **Live updates** — OTA updates without app store resubmission
- **Shared layers** — reuses `mp-nuxt-api-layer` with the frontend

## Getting Started

See the [Getting Started](/mobile/getting-started) guide to set up the mobile development environment.
