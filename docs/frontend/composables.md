# Composables

All composables live in `app/composables/`. Nuxt auto-imports them — no `import` statement needed in `.vue` files or stores.

## `useAuth`

**File**: `app/composables/useAuth.ts`

Token management composable. All auth state is backed by `localStorage`. Never access token keys directly — always use this composable.

```typescript
const {
  accessToken, // Ref<string>
  refreshToken, // Ref<string>
  issuedAt, // Ref<string>
  expiresAt, // Ref<string>
  tokenType, // Ref<string>  — "mfa_challenge" = MFA challenge flow
  authMethod, // Ref<string>  — "azure_ad" = OAuth session
  isAuthenticated, // Ref<boolean>
  forceMfa, // Ref<boolean> — set from backend config
  setTokens, // (data) => void — persist all token fields
  clearTokens, // () => void — wipe all fields from localStorage
  refreshAccessToken, // (refreshFn, grant_type?) => Promise<string|null>
} = useAuth();
```

`refreshAccessToken` returns `null` on failure, which triggers logout via the event bus.

---

## `useConfirm`

**File**: `app/composables/useConfirm.ts`

Opens `ConfirmModal` programmatically. Side effects happen in the `onConfirm` callback.

```typescript
const confirm = useConfirm()

confirm.open({
  title: "Delete item?",
  description: "This action cannot be undone.",
  alert?: UAlertProps,                   // optional alert box inside modal
  confirmButtonProps?: Record<string, any>,  // Nuxt UI UButton props
  onConfirm: () => { /* proceed */ },
  onClose?: () => { /* cancelled */ },
})
```

---

## `useJsonModal`

**File**: `app/composables/useJsonModal.ts`

Opens `JsonFormModal` programmatically — renders any JSON Schema form inside a modal.

```typescript
const jsonModal = useJsonModal()

jsonModal.open({
  title: "Edit configuration",
  data: { ... },           // initial form data
  schema?: { ... },        // JSON Schema
  uischema?: { ... },      // JSON Forms UI schema
  submitButtonProps?: { ... },
  debug?: boolean,
  onSubmit: (data) => { /* handle submitted data */ },
  onClose?: () => {},
})
```

---

## `useFormatAxiosError`

**File**: `app/composables/useFormatAxiosError.ts`

Returns a function that formats Axios errors into a human-readable string using i18n.

```typescript
const formatError = useFormatAxiosError();

toast.add({
  description: formatError({ error }),
});
```

Delegates to the pure `formatAxiosError` utility, injecting `t()` from `useI18n()`.

---

## `useLocalConfig<T>`

**File**: `app/composables/useLocalConfig.ts`

Reactive `ref` backed by `localStorage`. Values are stored wrapped in a typed envelope: `{ type, value }`.

```typescript
const collapsed = useLocalConfig("sidepanel-collapsed", false);
// localStorage: {"type":"boolean","value":false}
collapsed.value = true; // auto-persists to localStorage
```

Used for: UI preferences, flags, collapsed states.

---

## `useLocalStorage<T>`

**File**: `app/composables/useLocalConfig.ts` (second export)

Simpler localStorage ref — stores raw JSON without the type envelope.

```typescript
const lang = useLocalStorage("user-language", { value: "en_GB" });
// localStorage: {"value":"en_GB"}
```

Used for: user language preference (read by `i18n.client.ts` plugin).

---

## `useRouting`

**File**: `app/composables/useRouting.ts`

Typed wrapper around Vue Router. Centralizes route name→path mapping.

```typescript
const { navigateTo, route, router } = useRouting();

navigateTo("index", {});
navigateTo("questionnaire-id-designer", { id: "abc" });
navigateTo("patient-id", { id: patientId });
```

Route names follow Nuxt's auto-generated convention from file paths.

---

## `useFrontendApi`

**File**: `app/composables/useFrontendApi.ts`

Direct `$fetch` wrapper that injects the current access token from localStorage as `Authorization: Bearer`.

```typescript
const { fetch } = useFrontendApi();
const data = await fetch<MyType>("/some/url", { method: "GET" });
```

::: warning
Does not benefit from the Axios interceptor's token refresh logic. Prefer `useApi()` for all main application requests.
:::

---

## `useFlattenedSearchGroups`

**File**: `app/composables/useFlattenedSearchGroups.ts`

Flattens a nested group tree into searchable flat groups based on a query string. Used in the command panel and search components.

```typescript
const groups = ref([
  {
    id: "section1",
    label: "Section 1",
    items: [
      { label: "Item A", children: [{ label: "Sub-item 1", value: "..." }] },
    ],
  },
]);

const { query, filteredGroups } = useFlattenedSearchGroups(groups);
// query.value = "sub" → filteredGroups shows "Section 1 › Item A" as breadcrumb
```

**Returns:**

- `query` — `Ref<string>` search input
- `filteredGroups` — `ComputedRef` of matched groups with breadcrumb labels

---

## `useAnimation`

**File**: `app/composables/useAnimation.ts`

Applies a CSS animation class to a DOM element and removes it after `animationend`.

```typescript
const { playAnimation } = useAnimation();
playAnimation(el as HTMLBodyElement, "shake");
```

---

## `useSelectorWatcher`

**File**: `app/composables/useSelectorWatcher.ts`

Uses `MutationObserver` to reactively track whether a CSS selector matches any element in the DOM. Useful for detecting dynamically rendered elements.

```typescript
const { elementVisible } = useSelectorWatcher(
  "[data-headlessui-state='open']",
  100, // debounce ms for removal detection
);
// elementVisible.value === true when selector matches
```

Cleans up the observer automatically on `onBeforeUnmount`.
