# Mobile App Architecture

This document covers the architectural internals of `mp-mobile-app` — the patient-facing iOS/Android hybrid app. For the high-level platform overview see [Platform Overview](/overview/platform).

---

## Overview

`mp-mobile-app` is a **Nuxt 4 + Capacitor 7** hybrid application (SPA, `ssr: false`) targeting iOS and Android. It shares the same Nuxt layer and API client infrastructure as `mp-frontend`, but differs in two fundamental ways:

|                   | mp-frontend                  | mp-mobile-app                                    |
| ----------------- | ---------------------------- | ------------------------------------------------ |
| Rendering         | Client-side SPA              | Client-side SPA (Capacitor WebView)              |
| State persistence | Ephemeral Pinia (in-memory)  | Encrypted SQLite (`@capacitor-community/sqlite`) |
| Tenancy           | Single tenant per deployment | Multi-tenant (multiple providers per device)     |
| Auth flow         | Credentials + Azure AD       | Deep-link AES token + Azure AD                   |
| Offline           | Not applicable               | First-class — full offline operation             |

The `ios/` and `android/` directories are git submodules pointing to separate native repositories.

---

## Plugin Boot Sequence

App startup is orchestrated through four Nuxt plugins that must fire in the correct order. The sequence is enforced by Capacitor event hooks rather than import order:

```
plugins/sqlite.ts
  └─ Initializes @capacitor-community/sqlite, runs schema migrations
  └─ Emits: SqlInitializedEvent

     plugins/initializeApp.ts  (waits for SqlInitializedEvent)
       └─ Runs database migrations (if any pending)
       └─ Calls syncDeviceData() — fetches enrollments, questionnaires from API
       └─ Hides the native splash screen
       └─ On network error: 10-second retry loop before giving up
       └─ Emits: DeviceSyncedEvent

plugins/deepLink.ts  (independent — registers Capacitor appUrlOpen listener)
  └─ Handles medipal:// deep links (see Authentication Flow)

plugins/notificationActionHandler.ts  (native platforms only)
  └─ Handles push notification tap actions
```

::: warning Component data access rule
Components and composables must **not** read store data before `DeviceSyncedEvent` fires. The `useAppReady()` composable exposes a `isReady` ref that gates UI rendering until sync is complete.
:::

---

## Authentication Flow

Instead of a login form, `mp-mobile-app` uses a **deep-link AES-encrypted authentication** flow. A clinician generates an invite link from mp-frontend, which the patient taps on their device.

::: tip Web panel device registration
The invite link is created from the **User Profile → Devices tab** in `mp-frontend`. See [Device Management](/frontend/device-management) for how devices are registered and listed from the web panel.
:::

```
Clinician in mp-frontend
  └─ Generates invite → API returns AES-encrypted token

Patient taps link on device
  └─ medipal://authenticate?payload=<AES-encrypted-token>
       └─ plugins/deepLink.ts
            └─ useHandleAuthenticationLink()
                 └─ utils/urlPayloadDecoder.ts
                      └─ AES-CBC decrypt using CRYPTO_KEY env var
                      └─ Extracts: { tenantUrl, apiKey, userId, ... }

/authenticate/[token].vue
  └─ Patient reviews terms of service
  └─ On accept: device.authenticate()
       └─ POST /api/device-login → { access_token, refresh_token }
       └─ Tokens written to SQLite tenants table
       └─ DeviceSyncedEvent fired → home screen shown
```

::: danger CRYPTO_KEY
`CRYPTO_KEY` must match the value configured in the backend. A mismatch silently produces a decryption failure — the user sees a generic error and cannot authenticate. Keep the key in sync when rotating.
:::

The `useMSAuth()` composable from `mp-nuxt-msal-plugin` is also available for Azure AD enterprise login (same as mp-frontend).

---

## Multi-Tenant Architecture

A single device can serve patients enrolled across multiple healthcare providers. Each provider is a **tenant** — a separate row in the `tenants` SQLite table with its own credentials and API endpoint.

```
Device
  ├─ Tenant A  (url: hospital-a.medipal.dev, own tokens)
  │    ├─ enrollments (linked to Tenant A)
  │    └─ questionnaires (linked to Tenant A)
  └─ Tenant B  (url: clinic-b.medipal.dev, own tokens)
       ├─ enrollments (linked to Tenant B)
       └─ questionnaires (linked to Tenant B)
```

**Per-tenant API client:**

```ts
const api = useTenantApi(tenantId);
await api.enrollmentList();
```

`useTenantApi(tenantId)` creates an Axios instance scoped to that tenant's `url`, `api_key`, and tokens. It implements the same token-refresh queue pattern as `mp-frontend`'s `app/api.config.ts` — a single in-flight refresh promise shared across concurrent requests, with a request queue that drains once the new token is written back to SQLite.

::: warning Always use useTenantApi()
All API calls must go through `useTenantApi(tenantId)`. Do not construct Axios instances directly or implement token refresh elsewhere — the queue guard against concurrent refreshes is in `useTenantApi()` only.
:::

---

## Database Schema (Key Tables)

| Table             | Key Columns                                                         | Purpose                                                               |
| ----------------- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `tenants`         | `id`, `url`, `api_key`, `access_token`, `refresh_token`, `active`   | One row per healthcare provider; `active` = currently selected tenant |
| `enrollments`     | `id`, `tenant_id`, `remote_id`, `questionnaire_id`, `schedule_json` | Patient's enrolled questionnaires with schedule metadata              |
| `questionnaires`  | `id`, `tenant_id`, `remote_id`, `engine_version`, `payload_json`    | Cached questionnaire definitions (schema + i18n)                      |
| `pending_submits` | `id`, `tenant_id`, `enrollment_id`, `answers_json`, `created_at`    | Completed but **not yet sent** responses — the outbox                 |
| `submits`         | `id`, `tenant_id`, `remote_id`, `enrollment_id`, `submitted_at`     | Successfully synced submissions — audit log only                      |

::: danger pending_submits vs submits
`pending_submits` is the outbox — rows exist until the sync confirms the server accepted them. `submits` is the immutable audit log — rows are written after server confirmation and never deleted. Never read `submits` to determine whether a submission is still pending; always read `pending_submits`.
:::

All sensitive columns (`answers_json`, `access_token`, `refresh_token`) are stored in an AES-encrypted SQLite database via `@capacitor-community/sqlite`'s built-in encryption.

---

## Background Sync Architecture

The most unique aspect of `mp-mobile-app` — not present in mp-frontend.

**Problem:** A patient may fill in a questionnaire while offline or with poor connectivity. The response is written to `pending_submits`. If the user kills the app before connectivity is restored, the submission never reaches the server.

**Solution:** `@capacitor/background-runner` wakes the app roughly every 15 minutes (platform-dependent) to flush `pending_submits`.

**Critical constraint:** The background runner executes in a **separate JS environment** — isolated from the main WebView. It has no access to SQLite, Vue, Pinia, or any Capacitor plugin that requires the main thread.

```
Main App (foreground)
  └─ Before going background:
       └─ Reads pending_submits from SQLite
       └─ Reads tenant credentials from SQLite
       └─ Writes serialized data to @capacitor/preferences

Background Runner (separate JS sandbox)
  └─ Wakes every ~15 min
  └─ Reads from @capacitor/preferences (CapacitorKV in runner context)
  └─ Sends submissions via fetch() directly to tenant API
  └─ On 200 OK: appends submission ID to bgCompletedIds preference key

Main App (next foreground session)
  └─ Reads bgCompletedIds from preferences
  └─ Deletes matching rows from pending_submits
  └─ Moves them to submits table
  └─ Clears bgCompletedIds
```

**Preferences keys bridge:**

| Key                  | Written by        | Read by           | Contents                                                    |
| -------------------- | ----------------- | ----------------- | ----------------------------------------------------------- |
| `pendingSubmissions` | Main app          | Background runner | JSON array of `{ id, tenantId, enrollmentId, answersJson }` |
| `tenantCredentials`  | Main app          | Background runner | JSON map of `tenantId → { url, apiKey, accessToken }`       |
| `bgCompletedIds`     | Background runner | Main app          | JSON array of successfully sent `pending_submits.id` values |

**iOS requirements (`Info.plist`):**

```xml
<key>BGTaskSchedulerPermittedIdentifiers</key>
<array>
  <string>com.medipal.app.backgroundSync</string>
</array>
```

Android uses `WorkManager` via Capacitor's background runner adapter — no manifest changes required beyond standard Capacitor setup.

::: warning Refresh tokens in background
The background runner uses the `accessToken` directly. If it receives a 401, it cannot perform a token refresh (no SQLite access to write the new token back). The failed submission remains in `pending_submits` and will be retried in the next foreground session when the main app handles the refresh normally.
:::

---

## API Layer

Three distinct API clients are active in `mp-mobile-app`:

| Client                        | Source                     | Used for                                                   |
| ----------------------------- | -------------------------- | ---------------------------------------------------------- |
| `useTenantApi(tenantId)`      | `mp-mobile-app` composable | All runtime data (enrollments, submissions, device auth)   |
| `useApi()`                    | `mp-nuxt-api-layer`        | Shared layer utilities (MSAL auth flow, definitions fetch) |
| `fetch()` (background runner) | Native browser API         | Submission sync in background runner only                  |

**Error handling policy:**

| HTTP Status / Error        | Handling                                                                         |
| -------------------------- | -------------------------------------------------------------------------------- |
| `401 Unauthorized`         | `useTenantApi()` queues concurrent requests, refreshes token once, replays queue |
| `403 Forbidden`            | Surface error toast; tenant may have been deactivated                            |
| Network timeout / offline  | Write/keep in `pending_submits`; background runner will retry                    |
| `422 Unprocessable Entity` | Log to `submits` with `error` flag; do not retry (data issue)                    |

---

## Live Update Architecture

`mp-mobile-app` supports **OTA (over-the-air) content updates** via the custom `mp-mobile-app-live-update` Capacitor plugin. This allows the web bundle inside the native app to be updated without going through the App Store or Play Store review process.

### How it works

```
App start
  └─ checkForContentUpdate()
       └─ Fetches manifest.json from updates.{env}.medipal.dev
       └─ Compares server hash vs. local content hash
       │
       ├─ hash matches → no update needed, proceed normally
       │
       └─ hash differs → pullContentUpdate()
            └─ Downloads live-update.zip from contentUrl
            └─ Unpacks to device storage
            └─ setWebViewPath(newPath)
                 └─ WebView reloads from the new content root
```

### Plugin API

| Method                    | Purpose                                                |
| ------------------------- | ------------------------------------------------------ |
| `getLocalContent()`       | Returns the current local content path and hash        |
| `checkForContentUpdate()` | Fetches `manifest.json` and compares hash              |
| `pullContentUpdate()`     | Downloads and unpacks the `.zip` bundle                |
| `setWebViewPath(path)`    | Switches the WebView root to the new content directory |

### Manifest format

```json
{
  "hash": "sha256-abc123...",
  "version": "1.4.2",
  "timestamp": "2024-11-01T12:00:00Z",
  "contentUrl": "https://updates.{env}.medipal.dev/live-update.zip"
}
```

### Enabling live update in builder

In `mp-mobile-app-builder`, set `USE_LIVE_UPDATE=true` before running `npm run generate`. This causes the build to additionally produce:

- `live-update.zip` — the compressed web bundle
- `manifest.json` — the hash/version manifest

Both files are deployed to `updates.{env}.medipal.dev` (served by `mp-frontend-nginx-proxy`).

```bash
USE_LIVE_UPDATE=true npm run generate
```

### WebView path switching — known issue

When `setWebViewPath()` is called, the WebView **disconnects and reinitializes**. This tears down all active event listeners registered on the old WebView instance. In particular:

::: warning Deep-link handler must re-register
`plugins/deepLink.ts` registers a Capacitor `App.addListener("appUrlOpen", ...)` listener. After a live update switches the WebView path, this listener is destroyed. The handler must detect the reinitialiation and re-register itself.
:::

Any plugin listener that is registered once at app boot (rather than per-component) must account for this reinitalization if live updates are active.

### Platform support

| Platform | Status                                                  |
| -------- | ------------------------------------------------------- |
| iOS      | Fully implemented (including live updates)              |
| Android  | Fully implemented; OTA live update is not yet supported |

---

## QuestionnaireEngine Integration

The questionnaire engine iframe is embedded in `mp-mobile-app` identically to mp-frontend — a versioned single-file HTML bundle loaded from the CDN (or from local device storage when offline).

Communication between the Nuxt app and the engine iframe uses the `postMessage` protocol — same events (`MEDIPAL_ENGINE_READY`, `MEDIPAL_SUBMIT`, `MEDIPAL_SAVE_DRAFT`, etc.) as in the admin frontend.

See [Questionnaire Core & Engine](/frontend/questionnaire-engine) for the full postMessage protocol, engine versioning, and offline bundle caching strategy.

---

## See Also

- [Mobile App Builder Architecture](./mobile-app-builder) — how native app store packages are built from this app
- [iOS Build](./ios-build) — Fastlane beta lane, code signing via match, TestFlight
- [Android Build](./android-build) — Fastlane internal lane, Play Store internal track
- [Platform Overview](/overview/platform) — how mp-mobile-app fits into the broader Medipal system
