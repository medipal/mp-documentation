# State Management

## Overview

All state is managed via **Pinia** using the **Composition API** style (`defineStore("name", () => { ... })`). No Options API stores. All stores are auto-imported by Nuxt — no `import` needed in `.vue` files.

Store files: `app/stores/*.ts`

## Store Inventory

| Store                     | File                 | Purpose                                        |
| ------------------------- | -------------------- | ---------------------------------------------- |
| `useConfigStore`          | `config.ts`          | App-wide backend config (fetched once on init) |
| `useDesignerStore`        | `designer.ts`        | Questionnaire designer — full editing state    |
| `useEngineEditorStore`    | `engineEditor.ts`    | Questionnaire engine editor state              |
| `useEventBus`             | `eventBus.ts`        | RxJS-based event bus (login/logout events)     |
| `useExtendableSlotsStore` | `extendableSlots.ts` | Dynamic slot injection system                  |
| `useFolderStore`          | `folder.ts`          | Folder tree — CRUD + hierarchy                 |
| `usePatientStore`         | `patient.ts`         | Patient records — CRUD + search                |
| `usePermissionStore`      | `permission.ts`      | Folder + questionnaire permission management   |
| `useProviderStore`        | `provider.ts`        | Language/locale provider data                  |
| `useQuestionnaireStore`   | `questionnaire.ts`   | Questionnaire CRUD + publish workflow          |
| `useUserStore`            | `user.ts`            | Current user profile + login/logout actions    |

## Standard Store Structure

Every store follows this pattern:

```typescript
export const useXxxStore = defineStore("xxx", () => {
  const { api } = useApi();
  const toast = useToast();
  const { t } = useI18n();
  const formatError = useFormatAxiosError();

  // State
  const items = ref<Item[]>([]);
  const item = ref<Item | null>(null);

  // Computed
  const isPublished = computed(() => item.value?.status === "PUBLISHED");

  // Actions
  const fetchItem = async (id: string) => {
    try {
      const { data } = await api.someDetail(id);
      item.value = data;
      return data;
    } catch (error) {
      toast.add({
        title: t("@toasts.domain.failedToFetch"),
        description: formatError({ error }),
        color: "error",
        icon: "lucide:x-circle",
      });
      throw new Error("Failed to fetch item", { cause: error });
    }
  };

  return { items, item, isPublished, fetchItem };
});
```

## Common Patterns

### Modal Pattern

Modals are created at the store level using Nuxt UI's `useOverlay()`. They are never placed directly in templates:

```typescript
// In store:
const overlay = useOverlay();
const createModal = overlay.create(CreateXxxModal);

const showCreateModal = async () => {
  const result = await createModal.open({
    /* props */
  });
  if (result) fetchItems();
};
```

### Toast Notifications

Every action shows a toast on failure:

```typescript
toast.add({
  title: t("@toasts.xxx.failedToCreate"),
  description: formatError({ error }),
  color: "error",
  icon: "lucide:x-circle",
});
```

### Callback Pattern

Actions accept `onSuccess` / `onError` callbacks for component-level side effects:

```typescript
const fetchQuestionnaire = async ({
  id,
  onSuccess = () => {},
  onError = () => {},
}: {
  id: string;
  onSuccess?: (data: Questionnaire) => void;
  onError?: (error: Error) => void;
}) => {
  try {
    const { data } = await api.questionnaireDetail(id);
    questionnaire.value = data;
    onSuccess(data);
    return data;
  } catch (error) {
    onError(error as Error);
    throw error;
  }
};
```

## `useDesignerStore` — Critical Store

The largest store (~36 KB). Owns the entire questionnaire editing session.

### State

```typescript
state; // Ref<{payload: {sections, definitions}}> — live edited copy
originalState; // Ref<...> — snapshot at load, used for diff/dirty check
questionTypes; // Ref<Record> — available question type definitions
isChanged; // Ref<boolean> — dirty flag
isReadOnly; // Ref<boolean>
history; // Ref<any[]> — undo stack
future; // Ref<any[]> — redo stack
canUndo; // ComputedRef<boolean>
canRedo; // ComputedRef<boolean>
selectStates; // Ref<Record> — which section/question is selected
editStates; // Ref<Record> — which section/question is in edit mode
current_language; // Ref<string>
use_multiple_languages; // Ref<boolean>
questionnaire_languages; // Ref<array>
questionnaire_default_language; // Ref<string>
questionnaireEngine; // Ref<any[]> — engine feature config
```

### Actions

| Action                               | Description                                      |
| ------------------------------------ | ------------------------------------------------ |
| `initializeState(questionnaire)`     | Load questionnaire into store                    |
| `saveState()`                        | Push current state to history (before mutations) |
| `undo()` / `redo()`                  | Navigate history/future stacks                   |
| `addSection()` / `deleteSection()`   | Section management                               |
| `moveSection()` / `cloneSection()`   | Section reordering/copying                       |
| `addQuestion()` / `deleteQuestion()` | Question management                              |
| `moveQuestion()`                     | Question reordering                              |
| `copyQuestion()` / `pasteQuestion()` | Clipboard (uses `navigator.clipboard`)           |
| `saveQuestionnaire()`                | PATCH via questionnaireStore                     |
| `publishQuestionnaire()`             | Opens PublishQuestionnaireModal                  |

## `useQuestionnaireStore`

Beyond basic CRUD, this store exposes:

| Action                                           | Description                           |
| ------------------------------------------------ | ------------------------------------- |
| `fetchQuestionnaires()`                          | Fetch all questionnaires (limit 1000) |
| `fetchQuestionnaire({ id, onSuccess, onError })` | Fetch single questionnaire            |
| `fetchFolderQuestionnaires(folder_id)`           | Questionnaires in a folder            |
| `fetchQuestionnaireCores(coreUrls[])`            | Fetch core manifests from URLs        |
| `fetchQuestionnaireEngines(engineUrls[])`        | Fetch engine manifests from URLs      |
| `createQuestionnaire({ payload })`               | Create new questionnaire              |
| `duplicateQuestionnaire(id, options)`            | Clone to same folder                  |
| `importQuestionnaire({ payload })`               | Import from JSON                      |
| `updateQuestionnaire(id, payload, options)`      | PATCH questionnaire                   |
| `publishQuestionnaire(id, options)`              | Publish via API                       |
| `deleteQuestionnaire(id, options)`               | Delete after confirm dialog           |
| `exportQuestionnaire(id)`                        | Serialize to JSON + trigger download  |
| `archiveQuestionnaire(id, options)`              | Soft-delete                           |
| `restoreQuestionnaire(id, options)`              | Restore from archive                  |

## `useEventBus` Store

A thin RxJS wrapper using `Subject` from `rxjs`:

```typescript
class BaseEvent<T> {
  emit(payload: T); // subject.next(payload)
  listen(cb: (payload: T) => void); // subject.subscribe — returns unsubscribe fn
  get ref(); // useObservable(subject) — Vue reactive ref
}

// Available events:
eventBus.userLoggedIn; // payload: { access_token, refresh_token, ... }
eventBus.userLoggedOut; // payload: void
```

Usage:

```typescript
// Emit:
eventBus.userLoggedIn.emit({ access_token, refresh_token });

// Listen (with cleanup):
const unsub = eventBus.userLoggedIn.listen(handler);
onUnmounted(unsub);
```

## `useUserStore` — App Config

Stores user profile and local app configuration:

```typescript
appConfig = {
  sidepanel_collapsed: true,
  theme: "light",
  language_code: "en-GB",
  calendar_code: "en-GB",
  date_locale: "en-GB",
  isAdmin: false,
};
```

`saveAppConfig()` is called via a watcher in `app.vue` whenever `sidepanel_collapsed` changes.

## `useProviderStore`

Fetches available languages from the backend. Used by the questionnaire designer to populate language selectors. This is separate from `@nuxtjs/i18n` — it represents "languages supported by questionnaire content", not "UI language".

## Local State Composables

### `useLocalConfig<T>(key, defaultValue)`

Stores values wrapped in a typed envelope: `{ type, value }`. Used for structured app preferences.

```typescript
const collapsed = useLocalConfig("sidepanel-collapsed", false);
// Stored as: {"type":"boolean","value":false}
collapsed.value = true; // auto-persists
```

### `useLocalStorage<T>(key, defaultValue)`

Stores raw JSON without type metadata. Used for plain values.

```typescript
const lang = useLocalStorage("user-language", { value: "en_GB" });
// Stored as: {"value":"en_GB"}
```
