# Plugin Management

Plugin management lets administrators register and configure plugin instances that workflow ACTION nodes call at runtime.

---

## Overview

| Property     | Value                                               |
| ------------ | --------------------------------------------------- |
| Route        | `/admin-panel/system` → **Plugins** tab             |
| Feature flag | None (always visible in the System tab)             |
| Page partial | `app/pages/admin-panel/system/_partial/plugins.vue` |
| Store        | `app/stores/plugin.ts`                              |
| Types        | `app/types/plugin.ts`                               |

---

## Data Model

Types are derived from the API via `ApiResponseArrayItem` (see `types/plugin.ts`).

```ts
// Key fields on PluginDefinition
interface PluginDefinition {
  id: string;
  name: string;
  description?: string;
  version: string;
  actions: PluginAction[];
  instance_config_schema?: object; // JSON Schema — drives the config form in CreatePluginInstanceModal
}

// Key fields on PluginInstance
interface PluginInstance {
  id: string;
  display_name: string;
  plugin_definition_id: string;
  config_json: Record<string, unknown>; // Instance-specific configuration (may contain vault refs)
  enabled: boolean;
}

interface PluginAction {
  key: string;
  label: string;
  description?: string;
  input_schema?: object; // JSON Schema — drives dynamic JsonForms in ACTION node config
  output_schema?: object;
}
```

---

## Config Form Rendering

When a plugin definition provides an `instance_config_schema`, the `CreatePluginInstanceModal` renders a dynamic config form using the following pipeline:

```
instance_config_schema → sanitizeSchema() → generateVaultUischema() → JsonForms
```

1. **`sanitizeSchema()`** (`app/utils/sanitizeSchema.ts`) — cleans the JSON Schema for AJV compatibility: removes `null` values from numeric/string/array keywords, simplifies Pydantic `anyOf` Optional patterns
2. **`generateVaultUischema()`** (`app/utils/generateVaultUischema.ts`) — generates a UI schema that enables the vault reference picker on all eligible fields (string, integer, number, boolean — excluding enum, oneOf, date-time)
3. **`JsonForms`** (`app/components/JsonForms/JsonForms.vue`) — renders the form with custom renderers; `VaultReferenceRenderer` (rank 9) activates on fields with the `vaultReference` format option

Vault references in `config_json` (e.g. `$secret:API_KEY`, `$var:BASE_URL`) are resolved server-side at plugin execution time. See [Vault Management](./vault-management.md) for details on the reference format and validation flow.

### Modal Components

| Component                   | File                                                         | Purpose                                                               |
| --------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| `CreatePluginInstanceModal` | `app/components/Modals/Plugin/CreatePluginInstanceModal.vue` | Create or edit a plugin instance (basic fields + dynamic config form) |
| `PluginInvokeModal`         | `app/components/Modals/Plugin/PluginInvokeModal.vue`         | Invoke a specific plugin action with input parameters                 |
| `PluginActionsModal`        | `app/components/Modals/Plugin/PluginActionsModal.vue`        | Browse and select actions for a plugin definition                     |

---

## `usePluginStore` (Pinia Store)

A Pinia store that caches plugin definitions and instances. It is consumed by both the **Plugin Management** admin UI and the **Workflow Editor** ACTION node configuration.

```ts
const pluginStore = usePluginStore();
await pluginStore.fetch();
```

| Method / Getter                | Description                                                     |
| ------------------------------ | --------------------------------------------------------------- |
| `fetch()`                      | Fetches all definitions and instances; no-ops if already loaded |
| `getActionsForInstance(id)`    | Returns the `PluginAction[]` for the given instance             |
| `getDefinitionForInstance(id)` | Returns the `PluginDefinition` for the given instance           |

---

## API Mappings

| Method                 | Endpoint                 |
| ---------------------- | ------------------------ |
| `pluginList`           | `v1PluginDefinitionList` |
| `pluginInstanceList`   | `v1PluginInstanceList`   |
| `pluginInstanceDetail` | `v1PluginInstanceDetail` |

---

## i18n Keys

- `@pages.adminPanel.tabs.system.plugins.*` — table headers, actions, empty state
- `@modals.plugin.*` — create / edit / invoke modals
- `@toasts.pluginInstance.*` — success / error toasts
