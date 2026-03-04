# State Management

State is managed with **Pinia 3**. Stores are in `app/stores/` and are auto-imported by Nuxt.

## Boot Order Requirement

::: warning
Do not read SQLite-dependent store data before `DeviceSyncedEvent` is received. The boot sequence is:

```
sqlite.ts emits SqlInitializedEvent
    → initializeApp.ts runs migrations + syncDeviceData()
        → DeviceSyncedEvent emitted
            → Components can safely read stores
```

Use `useEventBus().on(DeviceSyncedEvent, ...)` to wait for sync completion.
:::

## `app/stores/device.ts`

The core store. Manages authentication state, tenant data, enrollments, locale, and sync orchestration.

### State

| Property           | Type           | Description                         |
| ------------------ | -------------- | ----------------------------------- |
| `isAuthenticated`  | `boolean`      | Device has valid auth tokens        |
| `tenants`          | `Tenant[]`     | Registered tenants from SQLite      |
| `enrollments`      | `Enrollment[]` | Active enrollments                  |
| `userLocale`       | `string`       | Current locale code (e.g., `en_GB`) |
| `colorMode`        | `string`       | `light` / `dark` / `system`         |
| `zoomLevel`        | `number`       | Accessibility zoom level (80–140%)  |
| `availableLocales` | `Locale[]`     | Supported locales list              |

### Actions

| Action                          | Description                                                                 |
| ------------------------------- | --------------------------------------------------------------------------- |
| `authenticate(token)`           | Decrypts deep link token, calls `deviceLogin`, stores credentials in SQLite |
| `register()`                    | Registers device with tenant                                                |
| `acceptEnrollment(id)`          | Accepts enrollment consent, persists to SQLite                              |
| `dropEnrollment(id)`            | Removes an enrollment                                                       |
| `syncDeviceData()`              | Fetches latest data from all tenant APIs, updates SQLite                    |
| `downloadQuestionnaireEngine()` | Downloads questionnaire engine ZIP for offline use                          |
| `scheduleAccessWindows()`       | Computes access windows and schedules local notifications                   |

## `app/stores/questionnaires.ts`

Manages questionnaire definitions and enrollment state from local SQLite.

### State

| Property             | Type              | Description                            |
| -------------------- | ----------------- | -------------------------------------- |
| `questionnaires`     | `Questionnaire[]` | All questionnaire definitions          |
| `enrollments`        | `Enrollment[]`    | Enrollments with schedule/availability |
| `pendingSubmissions` | `PendingSubmit[]` | Submissions queued for sending         |

### Actions

| Action                        | Description                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------- |
| `loadQuestionnairesFromSQL()` | Reads questionnaire rows from SQLite into store                                 |
| `loadEnrollmentsFromSQL()`    | Reads enrollment rows from SQLite into store                                    |
| `sendPendingSubmissions()`    | Sends each pending submission via `useTenantApi`, moves to `submits` on success |

## `app/stores/eventBus.ts`

Lightweight pub/sub system using RxJS `Subject`. Used to coordinate async initialization across plugins and stores.

### Events

| Event                    | Published When               | Consumed By                   |
| ------------------------ | ---------------------------- | ----------------------------- |
| `SqlInitializedEvent`    | SQLite ready                 | `initializeApp` plugin        |
| `DeviceSyncedEvent`      | `syncDeviceData()` completes | Components needing fresh data |
| `AuthenticatedEvent`     | Device authenticates         | Auth-gated UI                 |
| `NotAuthenticatedEvent`  | Auth check fails / logout    | Redirect logic                |
| `RequestDeviceSyncEvent` | Component requests sync      | `device.ts`                   |

### Usage

```ts
const { publish, on } = useEventBus();

// Publish
publish(new DeviceSyncedEvent());

// Subscribe
on(DeviceSyncedEvent, () => {
  loadData();
});
```
