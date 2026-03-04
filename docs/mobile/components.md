# Components

All components are in `app/components/` and are auto-imported by Nuxt (no explicit imports needed).

## Home Components (`app/components/home/`)

### `QuestionnaireBlock`

The main enrollment card on the Home tab. Displays questionnaire name, schedule info, and current status. Contains one or more `QuestionnaireBlockButton` children (one per access window).

### `QuestionnaireBlockButton`

A single action button representing one access window / schedule slot.

- Shows a countdown timer if the window opens in the future
- Shows "Start" when the window is currently open
- Disabled if the window has passed or a submission already exists for this slot

### `NavButton` / `NavMenu`

Bottom navigation. `NavMenu` contains three `NavButton` tabs in a fixed order — this order determines slide transition direction:

| Index | Tab      | Route       |
| ----- | -------- | ----------- |
| 0     | Home     | `/`         |
| 1     | Records  | `/records`  |
| 2     | Settings | `/settings` |

Higher index → slide left; lower index → slide right.

## Shared Components

### `MPButton`

Custom button with squircle shape (CSS Houdini `paint(squircle)`), haptic feedback on press, and loading state support.

Variants: `primary`, `secondary`, `danger`, `ghost`.

### `PageHeader`

Reusable page header with three slots: `title`, `left` (back button area), `right` (action area).

### `PageWrapper`

Scroll-aware wrapper that blurs the header when scrolled and handles safe area insets for notch/home indicator.

### `MessageBlock`

Centered status block for empty states, errors, and loading states. Slots: `icon`, `title`, `description`, `action`.

### `Logo`

App logo. Contains a hidden **easter egg**: tap 6 times to navigate to the debug page.

## Modal Components

### `ModalWrapper`

Base modal with open/close state, close button, and loading overlay. Used as a wrapper for all dialogs.

### `ConfirmModal`

Confirmation dialog built on `ModalWrapper`. Shows a title/message with confirm/cancel buttons. Used via the `useConfirm()` composable:

```ts
const confirm = useConfirm();
const ok = await confirm({
  title: "Delete enrollment?",
  message: "This action cannot be undone.",
});
if (ok) {
  /* proceed */
}
```

## JsonForms Renderers (`app/components/JsonForms/renderers/`)

Custom renderers for `@jsonforms/vue`. Each renderer handles a specific JSON Schema type or format. Registered in `app/utils/jsonFormRenderer.ts`.

| Component             | Schema Pattern                 | Nuxt UI Component                     |
| --------------------- | ------------------------------ | ------------------------------------- |
| `StringRenderer`      | `type: "string"` (text)        | `UInput`                              |
| `TextareaRenderer`    | `type: "string"` multi-line    | `UTextarea`                           |
| `NumberRenderer`      | `type: "number"` / `"integer"` | `UInput`                              |
| `SliderRenderer`      | Numeric range slider           | `USlider`                             |
| `CheckboxRenderer`    | `type: "boolean"`              | `UCheckbox`                           |
| `ToggleRenderer`      | `type: "boolean"` toggle       | `UToggle`                             |
| `SelectRenderer`      | `enum` / `oneOf` dropdown      | `USelect` (`:items`)                  |
| `RadioRenderer`       | `enum` / `oneOf` radio         | `URadioGroup` (`:items`)              |
| `MultiSelectRenderer` | `type: "array"` multi-select   | `USelect`                             |
| `ArrayRenderer`       | Complex `type: "array"`        | Custom                                |
| `FormulaRenderer`     | Computed fields (add/remove)   | `UButton` (`color="neutral"/"error"`) |
| `FormulaElement`      | Formula display sub-component  | `USelect` (`:items`)                  |

::: tip Adding a new renderer

1. Create the component in `app/components/JsonForms/renderers/`
2. Write a tester function (determines schema matching priority)
3. Register `{ tester, renderer }` in `customRenderers` in `app/utils/jsonFormRenderer.ts`
   :::

::: warning Nuxt UI v4 prop names
In Nuxt UI v4: option lists use `:items` (not `:options`). The range slider is `USlider` (not `URange`). Colors `gray` → `neutral`, `red` → `error`.
:::

## QuestionnaireEngine

### `QuestionnaireEngineRenderer`

Renders questionnaires in an isolated `<iframe>` sandbox. Communicates via `postMessage`:

**Host → iframe:**

```ts
iframe.contentWindow?.postMessage(
  {
    type: "init",
    data: { schema, uiSchema, formData, locale },
  },
  "*",
);
```

**iframe → Host:**

```ts
{ type: 'submit', data: { formData: {...} } }
{ type: 'exit' }
{ type: 'haptics', data: { type: 'light' | 'medium' | 'heavy' | 'success' | 'error' } }
```

The host forwards haptic events to `useHaptics()` for native feedback.

## Debug Components (`app/components/debug/`)

Accessible via the `Logo` easter egg (tap 6 times). Not linked from any navigation.

### `PendingSubmissionsTable`

Displays all rows from `pending_submits` SQLite table with retry/delete actions.

### `SqlTable`

Dynamic table viewer — pass a table name as a prop and it renders all rows via `useSql()`.
