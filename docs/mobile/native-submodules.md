# Native Submodules

The native iOS and Android projects are maintained in separate repositories and included as git submodules in both `mp-mobile-app` and `mp-mobile-app-builder`.

## Repositories

- `mp-mobile-app-ios-native` — Xcode project with native iOS configuration (Swift)
- `mp-mobile-app-android-native` — Android Studio project with native Android configuration (Kotlin)

## Submodule Mounts

Both repositories are mounted as submodules in two consumers:

| Consumer                | Mount path         | Purpose                                    |
| ----------------------- | ------------------ | ------------------------------------------ |
| `mp-mobile-app`         | `ios/`, `android/` | Local development and debugging            |
| `mp-mobile-app-builder` | `ios/`, `android/` | App store distribution builds via Fastlane |

After cloning either consumer, initialise submodules with:

```bash
git submodule update --init --recursive
```

## Native Configuration

Each native project contains platform-specific configuration including app icons, splash screens, permissions, and build settings.

## Capacitor Integration

Capacitor bridges the web layer (Nuxt) with native APIs. Custom native plugins are registered in the respective native projects.
