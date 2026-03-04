# Architecture Overview

## Rendering Mode

**SPA-only** — `ssr: false`. Nuxt 4 generates static files at build time (`nuxt generate`). These are served by Nginx inside a Docker container. There is no server-side rendering; all logic runs in the browser / Capacitor WebView.

## Plugin Boot Sequence

Plugins execute in order. The app has a strict initialization sequence:

```
1. app/plugins/sqlite.ts
       ↓ emits SqlInitializedEvent
2. app/plugins/initializeApp.ts
       ↓ runs migrations, syncs device data, starts retry loop
       ↓ emits DeviceSyncedEvent
3. app/plugins/deepLink.ts
4. app/plugins/notificationActionHandler.ts
```

### `sqlite.ts`

- Injects `<jeep-sqlite>` custom element into `document.body`
- Waits for the element to mount
- Opens the SQLite database connection named `"nuxt"`
- Emits `SqlInitializedEvent` via the RxJS event bus

### `initializeApp.ts`

- Waits for `SqlInitializedEvent`
- Runs Kysely `BrowserMigrator` (idempotent, skips applied migrations)
- Hides the native splash screen
- Calls `syncDeviceData()` — fetches latest enrollments, questionnaires, schedules from all tenant APIs
- Starts a `setInterval` (10s) to retry pending submissions while the app is open
- Reads `bgCompletedIds` from Preferences, removes those entries from SQLite

### `deepLink.ts`

- Listens to Capacitor `App.addListener('appUrlOpen', ...)`
- Handles `medipal://authenticate?payload=<AES-encrypted>` deep links
- Calls `useHandleAuthenticationLink()` which decrypts and routes to the authentication page

### `notificationActionHandler.ts`

- Registers a Capacitor local notification action listener
- Navigates to the relevant page when a notification is tapped
- Active on native platforms only (`Capacitor.isNativePlatform()`)

## Nuxt Layer Extension

```ts
// nuxt.config.ts
extends: ['github:medipal/mp-nuxt-api-layer']
```

Pulls shared composables and utilities from a private GitHub repo at dev/build time. Requires `GIGET_AUTH` env var (GitHub Classic PAT with `repo` scope).

## Authentication Flow

```
medipal://authenticate?payload=<AES-encrypted-JSON>
        │
        ↓ app/plugins/deepLink.ts
        │
        ↓ useHandleAuthenticationLink()
        │
        ↓ app/utils/urlPayloadDecoder.ts (AES decrypt with CRYPTO_KEY)
        │
        ↓ app/pages/authenticate/[token].vue
          (user reviews & accepts terms)
        │
        ↓ device.authenticate(token)
        │
        ↓ API: deviceLogin → access_token + refresh_token
        │
        ↓ SQLite: tenants table (tokens stored)
```

Subsequent API calls use `useTenantApi()` which reads tokens from SQLite and attaches them as Bearer headers.

On `401`: the interceptor calls `refreshToken`, queues concurrent requests, retries them with the new token. If refresh fails, `NotAuthenticatedEvent` is emitted.

## Data Flow

```
Backend API
    ↓ useTenantApi (Axios + auto token refresh)
    ↓ useSql composable (Kysely queries)
    ↓ SQLite (local DB — single source of truth)
    ↓ Pinia stores (device, questionnaires)
    ↓ Vue components
```

## Event Bus (RxJS)

`app/stores/eventBus.ts` provides a pub/sub system using RxJS `Subject`. All cross-plugin communication goes through here.

| Event                    | Publisher          | Subscriber              |
| ------------------------ | ------------------ | ----------------------- |
| `SqlInitializedEvent`    | `sqlite.ts`        | `initializeApp.ts`      |
| `DeviceSyncedEvent`      | `stores/device.ts` | Components loading data |
| `AuthenticatedEvent`     | `stores/device.ts` | Auth-gated UI           |
| `NotAuthenticatedEvent`  | `stores/device.ts` | Redirect logic          |
| `RequestDeviceSyncEvent` | Any component      | `stores/device.ts`      |

```ts
// Publish
const { publish } = useEventBus();
publish(new DeviceSyncedEvent());

// Subscribe
const { on } = useEventBus();
on(DeviceSyncedEvent, () => {
  /* ... */
});
```

**Rule:** Components must not read SQLite-dependent store data before `DeviceSyncedEvent` is received.

## Multi-Tenant Architecture

A single device can be registered with multiple healthcare providers:

- Each tenant = one row in the `tenants` SQLite table
- Each tenant has its own API URL, `api_key`, and auth tokens
- `useTenantApi(tenantId)` creates a per-tenant Axios instance
- All operations are scoped by `tenant_id`

## Background Sync

### The Problem

When a user submits a questionnaire offline, the submission is queued in `pending_submits`. The foreground `setInterval` retries while the app is open. But if the app is killed, nothing is sent until the user manually reopens the app.

### The Solution

`@capacitor/background-runner` wakes the app every ~15 minutes in the background to retry submissions.

### Architecture

The background runner runs in a **separate JS environment** — no access to SQLite, Vue, or Pinia. It can only use `CapacitorKV` (same native storage as `@capacitor/preferences`) and `fetch`.

```
MAIN APP (WebView)
    │
    SQLite ──── copy ────► @capacitor/preferences ────► CapacitorKV
    (source of truth)        (bridge keys)                     │
                                                        BACKGROUND RUNNER
                                                               │
                                                         fetch() to API
                                                               │
                             @capacitor/preferences ◄──────────
                             (bgCompletedIds key)
    │
    SQLite ◄──── cleanup on next app launch
```

### Preferences Keys

| Key                  | Written by        | Read by           | Content                                                                       |
| -------------------- | ----------------- | ----------------- | ----------------------------------------------------------------------------- |
| `pendingSubmissions` | main app          | background runner | `{ [id]: { tenant_id, instance_id, payload } }`                               |
| `tenantCredentials`  | main app          | background runner | `{ ["tenantId::instanceId"]: { url, api_key, access_token, refresh_token } }` |
| `bgCompletedIds`     | background runner | main app          | `string[]` — IDs of submissions sent in background                            |

Data is synced to Preferences:

- After `sql.addPendingSubmit()` in the questionnaire submission page
- After `sendPendingSubmissions()` in `stores/questionnaires.ts`
- On every app startup in `initializeApp.ts`

### iOS Notes

- `Info.plist` must list `com.medipal.sigil.background` in `BGTaskSchedulerPermittedIdentifiers`
- `UIBackgroundModes` must contain `processing`
- The OS schedules tasks opportunistically — 15 minutes is the minimum, not a guarantee

## QuestionnaireEngine

Questionnaires can optionally be rendered inside an isolated `<iframe>` sandbox:

```
Host page
    │
    ├── postMessage({ type: 'init', data: { schema, uiSchema, formData, ... } })
    │
    ↓ iframe: QuestionnaireEngineRenderer.vue
    │
    └── postMessage({ type: 'submit', data: { formData } })
        postMessage({ type: 'exit' })
        postMessage({ type: 'haptics', data: { type: 'light' } })
```

The host forwards haptic events to `useHaptics()` for native feedback.
