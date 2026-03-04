# Data Flow

## Request Lifecycle (Authenticated)

```
User action (e.g. button click)
         │
         ▼
Component calls a store action
  e.g. questionnaireStore.fetchQuestionnaire({ id })
         │
         ▼
Store calls API method
  const { data } = await api.questionnaireDetail(id)
         │
         ▼
Axios request interceptor
  Injects: Authorization: Bearer <accessToken>
         │
         ▼
HTTP request → backend
         │
         ▼
Response interceptor
  200 → pass through
  401/403 → token refresh → retry original request
  other error → reject with toast
         │
         ▼
Store updates reactive state
  questionnaire.value = { ...data }
         │
         ▼
Vue reactivity propagates to components
         │
         ▼
Component re-renders
```

## Token Refresh During Concurrent Requests

When multiple requests fail with 401 simultaneously, only one refresh call is made:

```
Request A → 401
  ├─ isRefreshing = false → start refresh
  │    isRefreshing = true

Request B → 401 (while refresh is in-flight)
  ├─ isRefreshing = true → push B to failedQueue

Refresh completes → new access token
  ├─ processQueue(null, newToken) → replay A and B with new token
  └─ isRefreshing = false
```

This pattern is implemented in `app/api.config.ts`. See [Authentication](./authentication) for full interceptor logic.

## Bootstrap Sequence

On page load, the following sequence runs before the user sees any authenticated content:

```
Browser loads app
         │
         ▼
app/plugins/initialize.client.ts
  ├─ api.configList() → set auth.forceMfa from backend config
  ├─ auth.refreshAccessToken() using stored refresh_token
  │   ├─ Success → setTimeout(500ms) → eventBus.userLoggedIn.emit()
  │   └─ Failure → stay on /login page
         │
         ▼ (after userLoggedIn event)
app/app.vue
  ├─ user.fetchProfile()
  ├─ folderStore.fetchUserFolders()
  ├─ providerStore.fetch()
  └─ start 10-min token refresh interval
         │
         ▼
app/middleware/auth.global.ts (on first navigation)
  ├─ Validates token (calls userProfile)
  ├─ Checks shouldChangePassword / MFA requirements
  └─ Allows navigation or redirects appropriately
```

## Designer Data Flow

The questionnaire designer has its own data flow for editing state:

```
Page mounts: /questionnaire/[id]/designer
         │
         ▼
questionnaireStore.fetchQuestionnaire({ id })
         │
         ▼
designerStore.initializeState(questionnaire)
  ├─ state.value = deepClone(questionnaire.payload)
  ├─ originalState.value = deepClone(questionnaire.payload)
  ├─ setLanguages(questionnaire)
  └─ load questionTypes from engine config

User edits a question
         │
         ▼
designerStore.saveState()  ← push to history stack (enables undo)
         │
         ▼
designerStore.updateQuestion(id, changes)
  ├─ mutate state.value
  └─ isChanged = !isEqual(state, originalState)

User clicks Save
         │
         ▼
designerStore.saveQuestionnaire()
         │
         ▼
api.questionnairePartialUpdate(id, { payload: state.value.payload })
  ├─ Success → originalState = deepClone(state), isChanged = false
  └─ Error → toast notification
```

## Store Interdependencies

```
useUserStore
  └─ uses: useAuth, useEventBus, useApi, useRouting

useDesignerStore
  └─ uses: useQuestionnaireStore (for save/publish),
           useConfirm, useOverlay, useI18n, useRouting

useQuestionnaireStore
  └─ uses: useApi, useRouting, useI18n, useFormatAxiosError

usePermissionStore
  └─ uses: useApi, useOverlay, useI18n, useFormatAxiosError

useFolderStore
  └─ uses: useApi, useOverlay, useI18n, useFormatAxiosError

usePatientStore
  └─ uses: useApi, useOverlay, useI18n, useFormatAxiosError

useEventBus
  └─ standalone (no store dependencies) — used by all others
```

## Where State Lives

| Use case                          | Where                                   |
| --------------------------------- | --------------------------------------- |
| Server data (fetched entities)    | Pinia store                             |
| UI preferences (collapsed, theme) | `useLocalConfig` → localStorage         |
| Selected item within a page       | Component `ref` or store `selectStates` |
| Modal open/close                  | `useOverlay()` in store                 |
| Form dirty state                  | Store `isChanged` flag                  |
| Auth tokens                       | `useAuth` composable → localStorage     |
| Toast notifications               | `useToast()` — ephemeral, not persisted |

## Component → Store Communication Rules

Components **never** directly mutate store state. They call store **actions**:

```typescript
// WRONG — direct mutation
designerStore.state.value.sections.push(newSection);

// CORRECT — action
designerStore.addSection();
```

Stores expose reactive refs that components read via template bindings:

```typescript
const designer = useDesignerStore();
// Template: v-for="section in designer.state.payload.sections"
```

## Event Bus Usage

```typescript
// Emit (from useUserStore.login):
eventBus.userLoggedIn.emit({ access_token, refresh_token, ... })

// Listen (in app.vue):
const unsub = eventBus.userLoggedIn.listen(() => {
  user.fetchProfile()
  folderStore.fetchUserFolders()
  providerStore.fetch()
})

// Clean up on unmount:
onUnmounted(unsub)
```
