# Vault Management

Vault management provides a secure storage for secrets (API keys, credentials, tokens) and variables used by plugin configurations in workflows.

---

## Overview

| Property     | Value                                                           |
| ------------ | --------------------------------------------------------------- |
| Route        | `/admin-panel/system` → **Vault** tab                           |
| Feature flag | None (always visible in the System tab)                         |
| Page partial | `app/pages/admin-panel/system/_partial/vault.vue`               |
| Renderer     | `app/components/JsonForms/renderers/VaultReferenceRenderer.vue` |

---

## Vault References

Vault entries are referenced in plugin configurations using the following format:

| Kind     | Format          | Example              |
| -------- | --------------- | -------------------- |
| Secret   | `$secret:{key}` | `$secret:OPENAI_KEY` |
| Variable | `$var:{key}`    | `$var:BASE_URL`      |

Vault references are **resolved server-side** — the frontend never sees the actual secret values.

### `VaultReferenceRenderer`

A custom JsonForms renderer that provides a vault picker UI for plugin config fields. It consists of:

- **Text input** — displays the current value; highlighted with a lock icon when a vault reference is detected
- **Vault picker popover** — opened via a vault button; contains:
  - Search input to filter entries by key or description
  - Kind filter (SECRET / VAR) — can be restricted via `vaultKind` UI schema option
  - Grouped entry list (Secrets, Variables) with icons and descriptions
- **Clear button** — appears when a vault reference is set; resets the field to `undefined`

Selecting an entry from the popover writes the full reference (e.g. `$secret:MY_KEY`) into the form field.

### Renderer registration

`VaultReferenceRenderer` is registered in `app/utils/jsonFormRenderer.ts` with rank **9** (highest priority), matched via the `vaultReference` UI schema format option:

```ts
{
  tester: rankWith(9, uischemaMatches("vaultReference")),
  renderer: VaultReferenceRenderer,
}
```

---

## Supported Field Types

The vault reference picker is available on fields whose JSON Schema type is one of:

- `string`
- `integer`
- `number`
- `boolean`

Fields with `enum`, `oneOf`, or `format: "date-time"` are **excluded** — these use their own dedicated renderers (select, radio, date picker).

---

## `generateVaultUischema` Utility

**File:** `app/utils/generateVaultUischema.ts`

Generates a JsonForms UI schema that applies the `vaultReference` format option to all eligible top-level properties in a given JSON Schema.

```ts
const uischema = generateVaultUischema(schema);
// Returns a VerticalLayout with { options: { format: "vaultReference" } }
// on each eligible control element
```

This utility handles nullable types including:

- Plain type strings (`"string"`)
- Array types (`["string", "null"]`)
- `anyOf` patterns (`[{type:"string"}, {type:"null"}]`)

Used by `CreatePluginInstanceModal.vue` to automatically enable vault reference pickers on plugin config forms. See [Plugin Management](./plugin-management.md#config-form-rendering) for the full rendering pipeline.

---

## Validation Flow

Vault references need special handling during client-side validation because they don't match the expected JSON Schema types (e.g. a vault ref string `$secret:KEY` would fail `type: "integer"` validation).

The `JsonForms.vue` wrapper component handles this via `stripVaultRefs()`:

1. **Before AJV validation** — `stripVaultRefs()` recursively removes all vault-referenced fields from the data and their corresponding schema definitions (including `required` constraints)
2. **AJV validates** the cleaned data against the cleaned schema — vault ref fields are invisible to the validator
3. **Original data preserved** — the full data (including vault refs) is emitted as the form value
4. **Server resolves** — vault references are resolved to actual values server-side at execution time

**File:** `app/components/JsonForms/JsonForms.vue` (`stripVaultRefs` function)

---

## i18n Keys

- `@pages.adminPanel.tabs.system.vault.*` — table headers, actions, empty state
- `@modals.vault.*` — create / edit modals
- `@toasts.vault.*` — success / error toasts
- `@components.vaultRenderer.aria.*` — accessibility labels (open picker, search vault, clear value)
- `@components.vaultRenderer.noEntriesFound` — empty search state
