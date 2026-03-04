# TypeScript Conventions

This page documents the TypeScript patterns and conventions used across the mp-frontend codebase.

## Type Inference from API

Types are **derived from the API client** rather than manually declared. This ensures types stay in sync automatically when `@medipal/mp-frontend-api` is updated.

### Pattern

```typescript
// types/questionnaire.ts
const { api: _api } = useApi();

export type Questionnaire = Awaited<
  ReturnType<typeof _api.questionnaireDetail>
>["data"];
```

### How It Works

1. `typeof _api.questionnaireDetail` — extracts the function signature from the API client
2. `ReturnType<...>` — gets the return type (a `Promise`)
3. `Awaited<...>` — unwraps the `Promise` to get the resolved value
4. `["data"]` — accesses the `data` property of the Axios response

::: warning
Never manually duplicate API response types. Always derive them from the API client. If you need a subset, use `Pick` or `Omit` on the inferred type.
:::

### When to Create Manual Types

- **UI-only state** that has no API counterpart (e.g., form state, UI toggles)
- **Transformed data** that combines multiple API responses
- **Utility types** used across multiple features

---

## Type vs Interface

### Use `type` for

- Type aliases and unions
- Intersection types
- Mapped and conditional types
- Function signatures
- Inferred API types

```typescript
// Union type
type QuestionnaireStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

// Intersection
type QuestionnaireWithDesigner = Questionnaire & { designer: Designer };

// Function signature
type FormatErrorFn = (error: unknown) => string;

// Inferred from API
type Questionnaire = Awaited<
  ReturnType<typeof _api.questionnaireDetail>
>["data"];
```

### Use `interface` for

- Extensible contracts that other code may augment
- Component prop definitions (when complex)
- Object shapes that benefit from declaration merging

```typescript
// Extensible contract
interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  actions: PluginAction[];
}

// Augmentable
interface RuntimeConfig {
  public: {
    FEATURE_AI_TOOLS: boolean;
    FEATURE_WORKFLOWS: boolean;
  };
}
```

::: tip
When in doubt, use `type`. The codebase predominantly uses `type` for its flexibility with unions and intersections.
:::

---

## Naming Conventions

| Category           | Convention                                   | Example                                         |
| ------------------ | -------------------------------------------- | ----------------------------------------------- |
| Types              | PascalCase                                   | `Questionnaire`, `PluginAction`                 |
| Interfaces         | PascalCase, no `I` prefix                    | `PluginDefinition`, NOT ~~`IPluginDefinition`~~ |
| Generic parameters | Single uppercase letter or `T` prefix        | `T`, `TData`, `TKey`                            |
| Variables          | camelCase                                    | `questionnaireList`, `isPublished`              |
| Constants          | camelCase or UPPER_SNAKE_CASE                | `defaultLimit`, `MAX_RETRIES`                   |
| Functions          | camelCase                                    | `formatAxiosError`, `fetchQuestionnaires`       |
| Composables        | camelCase with `use` prefix                  | `useAuth`, `useFormatAxiosError`                |
| Stores             | camelCase with `use` prefix + `Store` suffix | `useQuestionnaireStore`                         |
| Enums              | PascalCase (but prefer unions)               | Prefer `type Status = "DRAFT" \| "PUBLISHED"`   |

::: danger
Never use the `I` prefix for interfaces (`IUser`, `IConfig`). This is a legacy C# convention that is not used in modern TypeScript.
:::

---

## Generics

### Store Generics

Stores use generics when the same store logic applies to different data types:

```typescript
// Typed ref with generic initial value
const items = ref<Item[]>([]);
const item = ref<Item | null>(null);
```

### Composable Generics

Composables use generics for reusable logic:

```typescript
function useList<T>(fetchFn: () => Promise<T[]>) {
  const items = ref<T[]>([]) as Ref<T[]>;
  const loading = ref(false);

  const fetch = async () => {
    loading.value = true;
    items.value = await fetchFn();
    loading.value = false;
  };

  return { items, loading, fetch };
}
```

### Utility Generics

```typescript
// Constrained generic
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}

// Default generic
function createRef<T = string>(value: T) {
  return ref(value);
}
```

---

## Strict Typing

### Avoid `any`

Use `unknown` instead of `any` for values of uncertain type, then narrow with type guards:

```typescript
// WRONG
function handleError(error: any) {
  console.error(error.message);
}

// CORRECT
function handleError(error: unknown) {
  if (error instanceof Error) {
    console.error(error.message);
  }
}
```

::: info
The only exception is the expression builder (`app/utils/expression_builder/`), where `any` is used extensively due to the dynamic nature of the DSL. This exception is reflected in the ESLint configuration.
:::

### Type Guards

Use type guards to narrow types safely:

```typescript
// Type predicate
function isQuestionnaire(item: unknown): item is Questionnaire {
  return (
    typeof item === "object" &&
    item !== null &&
    "questionnaire_status_id" in item
  );
}

// Narrowing with in operator
function processItem(item: Questionnaire | Folder) {
  if ("questionnaire_status_id" in item) {
    // item is Questionnaire here
  }
}
```

### Non-Null Assertion

Avoid the `!` non-null assertion operator. Use optional chaining or explicit checks:

```typescript
// WRONG
const name = user!.name;

// CORRECT
const name = user?.name;
// or
if (user) {
  const name = user.name;
}
```

---

## Props & Emits Typing

### defineProps

Always type props with a generic parameter. Props destructuring is **disabled** (`propsDestructure: false` in `nuxt.config.ts`). Access props via `props.xxx`.

```vue
<script setup lang="ts">
// CORRECT — typed inline
const props = defineProps<{
  questionnaireId: string;
  isPublished: boolean;
  items?: Item[];
}>();

// Access via props object
const title = computed(() => (props.isPublished ? "Published" : "Draft"));
</script>
```

```typescript
// WRONG — destructuring props
const { questionnaireId, isPublished } = defineProps<{
  questionnaireId: string;
  isPublished: boolean;
}>();
```

### defineEmits

Type emits with a generic parameter:

```vue
<script setup lang="ts">
const emit = defineEmits<{
  close: [];
  submit: [data: FormData];
  update: [id: string, value: unknown];
}>();

// Usage
emit("close");
emit("submit", formData);
</script>
```

### withDefaults

Use `withDefaults` for optional props with default values:

```vue
<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string;
    variant?: "default" | "compact";
    showActions?: boolean;
  }>(),
  {
    variant: "default",
    showActions: true,
  },
);
</script>
```

---

## Utility Types

Use TypeScript built-in utility types to derive types from existing ones:

| Utility          | Use Case                     | Example                                                |
| ---------------- | ---------------------------- | ------------------------------------------------------ |
| `Partial<T>`     | Make all properties optional | `Partial<Questionnaire>` for patch payloads            |
| `Required<T>`    | Make all properties required | `Required<Config>` after validation                    |
| `Pick<T, K>`     | Select specific properties   | `Pick<Questionnaire, "id" \| "name">`                  |
| `Omit<T, K>`     | Exclude specific properties  | `Omit<Questionnaire, "created_at">` for create payload |
| `Record<K, V>`   | Key-value map                | `Record<string, unknown>` for dynamic objects          |
| `Readonly<T>`    | Immutable object             | `Readonly<Config>` for frozen config                   |
| `NonNullable<T>` | Remove null/undefined        | `NonNullable<User \| null>` → `User`                   |
| `ReturnType<T>`  | Extract function return type | `ReturnType<typeof useAuth>`                           |
| `Awaited<T>`     | Unwrap Promise               | `Awaited<ReturnType<typeof fetchData>>`                |

### Composing Utility Types

```typescript
// Create payload = questionnaire without server-generated fields
type CreateQuestionnairePayload = Omit<
  Questionnaire,
  "id" | "created_at" | "updated_at"
>;

// Patch payload = all fields optional except id
type PatchQuestionnairePayload = Partial<Questionnaire> & { id: string };
```

---

## Enums vs Union Types

**Prefer string literal union types** over TypeScript enums:

```typescript
// WRONG — enum
enum QuestionnaireStatus {
  Draft = "DRAFT",
  Published = "PUBLISHED",
  Archived = "ARCHIVED",
}

// CORRECT — union type
type QuestionnaireStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
```

### Why?

- Union types are **erased at compile time** — no runtime overhead
- They work naturally with `===` comparison
- They are compatible with API string values without conversion
- They provide the same autocomplete and type checking benefits

### When Enums Are Acceptable

- When you need reverse mapping (numeric enums)
- When integrating with external libraries that require enums

---

## Do / Don't Examples

### Typing API Responses

```typescript
// DON'T — manually duplicate API types
interface Questionnaire {
  id: string;
  name: string;
  status: string;
  // ... 20 more fields manually maintained
}

// DO — infer from API client
const { api: _api } = useApi();
type Questionnaire = Awaited<
  ReturnType<typeof _api.questionnaireDetail>
>["data"];
```

### Handling Unknown Data

```typescript
// DON'T — use any and hope for the best
function processResponse(data: any) {
  return data.items.map((item: any) => item.name);
}

// DO — type the input, narrow when needed
function processResponse(data: { items: Array<{ name: string }> }) {
  return data.items.map((item) => item.name);
}
```

### Optional Properties

```typescript
// DON'T — use undefined checks manually
const name = user !== undefined && user !== null ? user.name : "Unknown";

// DO — use optional chaining and nullish coalescing
const name = user?.name ?? "Unknown";
```

### Type Assertions

```typescript
// DON'T — cast blindly
const user = response.data as User;

// DO — validate or guard first
if (isUser(response.data)) {
  const user = response.data; // already narrowed
}

// ACCEPTABLE — when you know the shape from the API contract
const { data } = await api.userDetail(id);
// data is already typed by the API client
```
