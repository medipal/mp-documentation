# Coding Standards

This page documents the coding patterns and conventions that must be followed across the mp-frontend codebase.

## Component Patterns

### Naming

| Convention        | Rule                            | Example                                                |
| ----------------- | ------------------------------- | ------------------------------------------------------ |
| File name         | PascalCase                      | `DesignerSection.vue`                                  |
| Domain prefix     | Group by feature                | `QuestionnaireCard.vue`, `QuestionnaireList.vue`       |
| Modal suffix      | All modal components            | `CreateQuestionnaireModal.vue`                         |
| Partial directory | Sub-components scoped to a page | `pages/questionnaire/[id]/config/_partial/general.vue` |

### Script-Template-Style Order

Every `.vue` file must follow this order:

```vue
<script setup lang="ts">
// 1. Imports (only for non-auto-imported modules)
// 2. Props & Emits
// 3. Composables & Stores
// 4. State (refs, reactive)
// 5. Computed
// 6. Methods
// 7. Watchers
// 8. Lifecycle hooks
</script>

<template>
  <!-- Template markup -->
</template>

<style scoped>
/* Scoped styles (only when needed) */
</style>
```

### Props

Props destructuring is **disabled** (`propsDestructure: false`). Always access props via the `props` object:

```vue
<script setup lang="ts">
const props = defineProps<{
  questionnaireId: string;
  isPublished: boolean;
}>();

// CORRECT
const title = computed(() => (props.isPublished ? "Published" : "Draft"));

// WRONG
// const { questionnaireId, isPublished } = defineProps<{...}>();
</script>
```

### Events

Modals and overlays must use `emit("close")` to close. Never call a prop callback:

```vue
<script setup lang="ts">
const emit = defineEmits<{
  close: [];
}>();

// CORRECT
const handleCancel = () => emit("close");

// WRONG — never use prop callbacks for closing
// props.onClose?.();
</script>
```

For forms inside modals, use an async `onSubmit` prop:

```vue
<script setup lang="ts">
const props = defineProps<{
  onSubmit: (data: FormData) => Promise<void>;
}>();
const emit = defineEmits<{
  close: [];
}>();

const handleSubmit = async () => {
  try {
    await props.onSubmit(formData);
    emit("close");
  } catch {
    // Modal stays open — user can retry
  }
};
</script>
```

---

## Store Patterns

### Standard Setup

Every Pinia store follows the Composition API pattern with a consistent set of injected composables:

```typescript
export const useXxxStore = defineStore("xxx", () => {
  // 1. Inject composables
  const { api } = useApi();
  const toast = useToast();
  const { t } = useI18n();
  const formatError = useFormatAxiosError();
  const scopeStore = useScopeStore();

  // 2. State
  const items = ref<Item[]>([]);
  const item = ref<Item | null>(null);
  const loading = ref(false);

  // 3. Computed
  const isPublished = computed(() => item.value?.status === "PUBLISHED");

  // 4. Actions
  const fetchItems = async () => {
    if (!scopeStore.hasScope("item:read")) return;
    try {
      const { data } = await api.itemList();
      items.value = data;
    } catch (error) {
      toast.add({
        title: t("@toasts.item.failedToFetch"),
        description: formatError(error),
        color: "error",
        icon: "lucide:x-circle",
      });
    }
  };

  // 5. Return
  return { items, item, loading, isPublished, fetchItems };
});
```

### Modal Management

Create modal instances once at the store level using `useOverlay()`:

```typescript
export const useQuestionnaireStore = defineStore("questionnaire", () => {
  const overlay = useOverlay();

  // Create once
  const createModal = overlay.create(CreateQuestionnaireModal);

  // Open when needed
  const openCreateModal = () => {
    createModal.open({
      onSubmit: async (data) => {
        await createQuestionnaire(data);
      },
    });
  };

  return { openCreateModal };
});
```

### Scope Checks

Always check user permissions before API calls:

```typescript
const fetchItems = async () => {
  if (!scopeStore.hasScope("item:read")) return;
  // ... proceed with API call
};

const deleteItem = async (id: string) => {
  if (!scopeStore.hasScope("item:delete")) return;
  // ... proceed with deletion
};
```

### Array Mutations

Use immutable patterns for array updates. Never mutate arrays directly:

```typescript
// CORRECT — immutable
items.value = items.value.filter((i) => i.id !== id);
items.value = items.value.map((i) =>
  i.id === id ? { ...i, name: newName } : i,
);
items.value = [...items.value, newItem];

// WRONG — mutating
items.value.splice(index, 1);
items.value.push(newItem);
items.value[index].name = newName;
```

---

## Composable Patterns

### Naming & Auto-Import

All composables live in `app/composables/` with the `use` prefix and are auto-imported by Nuxt:

```typescript
// app/composables/useFormatAxiosError.ts
export function useFormatAxiosError() {
  const { t } = useI18n();

  return (params: any) =>
    formatAxiosError({
      ...params,
      t: (key: string, fallback: string) => t(key, fallback) as string,
    });
}
```

### Singleton Pattern

For composables that should share state across components, use `createSharedComposable()`:

```typescript
import { createSharedComposable } from "@vueuse/core";

const _usePluginData = () => {
  const definitions = ref<PluginDefinition[]>([]);
  const instances = ref<PluginInstance[]>([]);

  const fetchDefinitions = async () => {
    /* ... */
  };

  return { definitions, instances, fetchDefinitions };
};

export const usePluginData = createSharedComposable(_usePluginData);
```

### Return Types

Composables should return either:

- **Reactive refs** — for state that components need to track
- **Plain objects** — for static configuration or methods
- **Functions** — for utility wrappers (like `useFormatAxiosError`)

```typescript
// Reactive refs
function useCounter() {
  const count = ref(0);
  const increment = () => count.value++;
  return { count, increment }; // count is reactive
}

// Function wrapper
function useFormatDate() {
  const { locale } = useI18n();
  return (date: string) =>
    new Intl.DateTimeFormat(locale.value).format(new Date(date));
}
```

### Cleanup

Always clean up side effects:

```typescript
function useWebSocket(url: string) {
  const ws = ref<WebSocket | null>(null);

  onMounted(() => {
    ws.value = new WebSocket(url);
  });

  onUnmounted(() => {
    ws.value?.close();
    ws.value = null;
  });

  return { ws };
}
```

---

## Error Handling

### Store Actions

Every store action that calls an API must use try/catch:

```typescript
const createItem = async (payload: CreatePayload) => {
  try {
    const { data } = await api.itemCreate(payload);
    items.value = [...items.value, data];
    toast.add({
      title: t("@toasts.item.created"),
      color: "success",
      icon: "lucide:check-circle",
    });
    return data;
  } catch (error) {
    toast.add({
      title: t("@toasts.item.failedToCreate"),
      description: formatError(error),
      color: "error",
      icon: "lucide:x-circle",
    });
    throw error; // Re-throw so callers can handle
  }
};
```

### Error Formatting

Use `useFormatAxiosError()` to generate user-friendly error messages from Axios errors:

```typescript
const formatError = useFormatAxiosError();

// In catch block
catch (error) {
  const message = formatError(error);
  toast.add({
    title: t("@toasts.questionnaire.failedToSave"),
    description: message,
    color: "error",
    icon: "lucide:x-circle",
  });
}
```

### Modal Error Handling

When an error occurs during a modal form submission, the modal must **stay open** so the user can retry:

```typescript
// In the modal component
const handleSubmit = async () => {
  try {
    await props.onSubmit(formData);
    emit("close"); // Only close on success
  } catch {
    // Do NOT close — user can fix and retry
  }
};
```

### Rules

- Never swallow errors silently — always show a toast or log
- Re-throw errors from store actions so component code can react
- Use `color: "error"` and `icon: "lucide:x-circle"` for error toasts
- Use `color: "success"` and `icon: "lucide:check-circle"` for success toasts

---

## i18n Patterns

### Key Structure

Translation keys follow a hierarchical naming convention:

| Pattern                 | Example                                | Usage                 |
| ----------------------- | -------------------------------------- | --------------------- |
| `@toasts.domain.action` | `@toasts.questionnaire.failedToCreate` | Toast notifications   |
| `@confirms.action`      | `@confirms.deleteQuestionnaire`        | Confirmation dialogs  |
| `@common.action`        | `@common.save`, `@common.cancel`       | Shared UI labels      |
| `@pages.section.key`    | `@pages.questionnaire.tabs.designer`   | Page-specific content |
| `@components.name.key`  | `@components.modalWrapper.aria.close`  | Component-specific    |
| `@common.aria.key`      | `@common.aria.closeModal`              | Accessibility labels  |

### Usage

Always use `t()` in templates and script — never hardcode strings:

```vue
<script setup lang="ts">
const { t } = useI18n();
</script>

<template>
  <!-- CORRECT -->
  <UButton :label="t('@common.save')" />
  <p>{{ t("@pages.questionnaire.title") }}</p>

  <!-- WRONG -->
  <UButton label="Save" />
  <p>Questionnaire</p>
</template>
```

### Locales

The project supports **11 locales**. All translation files are in `i18n/locales/`:

`en_GB`, `en_US`, `es_ES`, `ar_SA`, `de_DE`, `fr_FR`, `ru_RU`, `pt_PT`, `pl_PL`, `sv_SE`, `en_PS` (pseudo-locale for testing)

::: info
The `ar_SA` locale has 6 additional `PATIENT` keys for right-to-left layout accommodations.
:::

### i18n Scripts

```bash
npm run i18n:coverage    # Check translation coverage across locales
npm run i18n:hardcoded   # Find hardcoded strings that should be translated
npm run i18n:check       # Run all i18n checks
npm run pseudo-locale    # Generate pseudo-locale for UI testing
```

---

## Accessibility Standards

### Icon-Only Buttons

Every button with only an icon (no visible label) must have an `aria-label`:

```vue
<!-- CORRECT -->
<UButton
  icon="lucide:x"
  variant="ghost"
  :aria-label="t('@common.aria.closeModal')"
/>

<!-- WRONG — no aria-label -->
<UButton icon="lucide:x" variant="ghost" />
```

### Decorative Icons

Icons that serve no informational purpose must be hidden from assistive technology:

```vue
<!-- CORRECT -->
<UIcon name="lucide:chevron-right" aria-hidden="true" />

<!-- WRONG — decorative icon exposed to screen readers -->
<UIcon name="lucide:chevron-right" />
```

### Semantic Roles

Use appropriate ARIA roles for structural elements:

| Element            | Role                 | Example              |
| ------------------ | -------------------- | -------------------- |
| Top navigation bar | `role="banner"`      | `NaviBar.vue`        |
| Main content area  | `role="main"`        | `default.vue` layout |
| Side navigation    | `<aside aria-label>` | `Sidepanel.vue`      |

### Keyboard Navigation

- All interactive elements must be focusable
- Modal focus should be trapped within the modal
- Escape key should close modals and popovers
- Tab order should follow visual order

---

## General Principles

### DRY — Don't Repeat Yourself

Reuse existing utilities, composables, and components:

- Check `app/utils/` before writing a new utility
- Check `app/composables/` before creating a new composable
- Check `app/components/` before building a new component

### KISS — Keep It Simple

Choose the simplest solution that works:

- Three similar lines of code are better than a premature abstraction
- Don't design for hypothetical future requirements
- Don't add configurability unless explicitly needed

### Immutability

Prefer immutable data operations:

```typescript
// Spread for adding
const updated = [...items, newItem];

// Filter for removing
const remaining = items.filter((i) => i.id !== id);

// Map for updating
const modified = items.map((i) => (i.id === id ? { ...i, ...changes } : i));
```

### Single Responsibility

One store manages one domain. One composable serves one purpose:

- `useQuestionnaireStore` — questionnaire CRUD + publish workflow
- `usePatientStore` — patient records + search
- `useFormatAxiosError` — error formatting (nothing else)

### Feature Flags

Feature flags are accessed via runtime config, never via `process.env`:

```typescript
// CORRECT
const config = useRuntimeConfig();
if (config.public.FEATURE_WORKFLOWS) {
  // Show workflow features
}

// WRONG
if (process.env.FEATURE_WORKFLOWS) {
  // This doesn't work in client-side code
}
```

Available feature flags:

| Flag                               | Feature                         |
| ---------------------------------- | ------------------------------- |
| `FEATURE_AI_TOOLS`                 | AI designer tools               |
| `FEATURE_SUPERSET_DASHBOARDS`      | Superset dashboard integration  |
| `FEATURE_ANONYMOUS_QUESTIONNAIRES` | Anonymous questionnaire mode    |
| `FEATURE_ENGINE_BUILDER`           | Questionnaire engine builder    |
| `FEATURE_WORKFLOWS`                | Visual workflow editor          |
| `FEATURE_ROLES`                    | Role management                 |
| `FEATURE_SHARED_DOCUMENTS`         | Shared document library         |
| `FEATURE_QUESTIONNAIRE_REVISIONS`  | Questionnaire revision tracking |
