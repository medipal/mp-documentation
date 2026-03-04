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

```ts
// app/types/plugin.ts

interface PluginDefinition {
  id: string;
  name: string;
  description?: string;
  actions: PluginAction[];
}

interface PluginInstance {
  id: string;
  name: string;
  plugin_definition_id: string;
  config: Record<string, unknown>;
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
- `@modals.pluginInstance.*` — create / edit modals
- `@toasts.pluginInstance.*` — success / error toasts
