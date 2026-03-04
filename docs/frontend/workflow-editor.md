# Visual Workflow Editor

The visual workflow editor lets administrators design event-driven automation workflows through a node-based canvas powered by **Rete.js v2** with an Unreal Engine 4 Blueprint aesthetic.

---

## Overview

| Property     | Value                                     |
| ------------ | ----------------------------------------- |
| Route        | `/admin-panel/workflows`                  |
| Feature flag | `FEATURE_WORKFLOWS=true`                  |
| Main page    | `app/pages/admin-panel/workflows.vue`     |
| Store        | `app/stores/workflowEditor.ts`            |
| Node types   | ACTION, COMPUTE, SWITCH, JOIN, DELAY, END |

---

## Architecture

### `useWorkflowEditorStore` Pinia store

Manages the full Rete.js lifecycle inside a Nuxt context, with integrated undo/redo history:

| Method / State        | Description                                                |
| --------------------- | ---------------------------------------------------------- |
| `init(el)`            | Creates editor, area, and all extensions                   |
| `loadGraph(g)`        | Converts backend graph → Rete nodes via `backendToRete()`  |
| `exportGraph()`       | Converts Rete state → backend format via `reteToBackend()` |
| `addNode(type)`       | Adds a new node of the given type at center                |
| `removeNode(id)`      | Removes the selected node (with snapshot for undo)         |
| `destroy()`           | Tears down Rete editor and removes DOM listeners           |
| `undo()` / `redo()`   | Snapshot-based undo/redo (max 30 entries)                  |
| `canUndo` / `canRedo` | Computed booleans for UI button state                      |

**VuePlugin context sharing** — `VuePlugin.setup()` copies Nuxt `provides`, `globalProperties`, `components`, and `directives` into the Rete Vue root so that `useColorMode()`, sockets, and other Nuxt composables work inside node components.

**History** — implemented in `stores/workflowEditor/history.ts` using snapshot-based stacks (same pattern as `stores/designer/history.ts`). Snapshots capture node positions, config, and connections. Each mutation (add/remove/move/edit) saves a snapshot before applying changes.

### Key files

| File                                    | Role                                                                                      |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| `app/types/workflow.ts`                 | `EventSubscription`, `WorkflowNode/Edge`, `WorkflowGraph`, `Run`, `RunNode`               |
| `app/types/plugin.ts`                   | `PluginDefinition`, `PluginInstance`, `PluginAction`                                      |
| `app/stores/workflow.ts`                | CRUD for subscriptions, graph, runs, test execution                                       |
| `app/stores/workflowEditor.ts`          | Pinia store — Rete lifecycle + undo/redo                                                  |
| `app/stores/workflowEditor/history.ts`  | Snapshot-based undo/redo composable                                                       |
| `app/stores/workflowEditor/types.ts`    | `WorkflowSnapshot`, `WorkflowSnapshotNode`, `WorkflowSnapshotConnection`                  |
| `app/stores/plugin.ts`                  | Pinia store — `fetch()`, `getActionsForInstance()`, `getDefinitionForInstance()`          |
| `app/utils/workflow/reteTypes.ts`       | `WorkflowNode`, `WorkflowConnection`, `FlowSocket`, `DataSocket`, `Schemes`               |
| `app/utils/workflow/nodeDefinitions.ts` | `NODE_DEFINITIONS` — 6 types with label, icon, glowColor, inputs, outputs, defaultConfig  |
| `app/utils/workflow/graphConverter.ts`  | `backendToRete()` / `reteToBackend()`, positions in `config._position`                    |
| `app/utils/workflow/keyPropagation.ts`  | `replaceNodeKeyInGraph()`, `validateNodeKey()` — updates references when node key changes |
| `app/utils/workflow/schemaFields.ts`    | `extractSchemaFieldPaths()` — extracts field paths from JSON schemas for autocomplete     |

---

## Node Types

| Type    | Config fields                                          | Description                            |
| ------- | ------------------------------------------------------ | -------------------------------------- |
| ACTION  | `plugin_instance_id`, `plugin_action`, `input_mapping` | Calls a plugin action                  |
| COMPUTE | `logic` (JSON Logic object)                            | Evaluates a JSON Logic expression      |
| SWITCH  | _(conditions defined on outgoing edges)_               | Branches flow based on edge conditions |
| JOIN    | `mode`, `n_required`                                   | Waits for predecessor nodes            |
| DELAY   | `delay_ms`, `until_template`                           | Pauses execution                       |
| END     | _(no config)_                                          | Terminal node                          |

**JOIN modes:**

- `ALL` — waits for all predecessor nodes to complete (default)
- `ANY` — proceeds as soon as any single predecessor completes
- `N_OF_M` — proceeds when `n_required` predecessors have completed

**DELAY config:**

- `delay_ms` (integer) — fixed delay in milliseconds
- `until_template` (string | null) — template string for scheduled delays (e.g. a date/time expression); when set, the delay waits until the evaluated time instead of a fixed duration

---

## UI Components

| Component                                        | Role                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `Workflow/Rete/WorkflowNodeComponent.vue`        | UE4-styled node card with ReteRef sockets and gradient glow                        |
| `Workflow/Rete/WorkflowSocketComponent.vue`      | 16 px circle socket                                                                |
| `Workflow/Rete/WorkflowConnectionComponent.vue`  | Bézier curve connection with CSS stroke                                            |
| `Workflow/Editor/WorkflowEditorToolbar.vue`      | Glassmorphism toolbar — Undo/Redo, Arrange, Zoom, Test                             |
| `Workflow/Editor/WorkflowNodePalette.vue`        | Sidebar palette — click a type to add it to the canvas                             |
| `Workflow/Editor/WorkflowNodeConfigSidebar.vue`  | Shell: header + dynamic config component + delete button                           |
| `Workflow/Editor/WorkflowNodeConfigAction.vue`   | Plugin instance + action dropdowns; JsonForms or JSON textarea for `input_mapping` |
| `Workflow/Editor/WorkflowNodeConfigCompute.vue`  | JSON Logic textarea                                                                |
| `Workflow/Editor/WorkflowNodeConfigSwitch.vue`   | Info panel — conditions live on edges                                              |
| `Workflow/Editor/WorkflowNodeConfigJoin.vue`     | `n_required` integer input                                                         |
| `Workflow/Editor/WorkflowNodeConfigDelay.vue`    | `delay_ms` integer input                                                           |
| `Workflow/Editor/WorkflowNodeConfigEnd.vue`      | Info panel — terminal node                                                         |
| `Workflow/Editor/WorkflowNodeConfigAdvanced.vue` | Timeout, continue-on-error, retry policy (collapsible)                             |
| `Workflow/Editor/WorkflowEdgeConfigSidebar.vue`  | Edge/connection config sidebar — label editing and JSON Logic condition builder    |
| `Workflow/Editor/JsonLogicBuilder.vue`           | Visual JSON Logic condition builder with rule groups (AND/OR) and raw JSON mode    |
| `Workflow/Editor/JsonLogicRule.vue`              | Field / operator / value inputs with dropdown prefix selector                      |

---

## API Mappings

Defined in `app/api.config.ts`:

| Method                                              | Endpoint                           |
| --------------------------------------------------- | ---------------------------------- |
| `eventSubscriptionList/Create/Detail/Update/Delete` | CRUD for workflow subscriptions    |
| `eventSubscriptionGraphList/Update`                 | Read and save the workflow graph   |
| `eventSubscriptionTest`                             | Trigger a test run simulation      |
| `workflowRunList/Detail`                            | Workflow run history and detail    |
| `workflowRunNodeList`                               | Node-level run status within a run |
| `pluginList`                                        | → `v1PluginDefinitionList`         |
| `pluginInstanceList`                                | → `v1PluginInstanceList`           |
| `pluginInstanceDetail`                              | → `v1PluginInstanceDetail`         |

---

## i18n Keys

- `@pages.adminPanel.tabs.workflows.*` — tabs, table, actions, editor, sidebar strings
- `@modals.workflow.*` — create / edit / deleteConfirm modals
- `@toasts.workflow.*` — CRUD success/error toasts

---

## Notes

- Rete's `Ref` is imported as `ReteRef` to avoid collision with Vue's `ref`.
- Node selection uses `AreaExtensions.selectableNodes()`; the selected node ID is tracked in a `selectedNodeId` ref.
- Changing a plugin instance in the ACTION config resets both the `plugin_action` and `input_mapping` fields.
- If a plugin action has an `input_schema`, the ACTION config renders a dynamic JsonForms form; otherwise a raw JSON textarea is shown.
- Connections (edges) are selectable — clicking a connection opens `WorkflowEdgeConfigSidebar` where users can set a label and configure a JSON Logic condition (`conditionJsonlogic`). This is how SWITCH node branching conditions are defined.
- `JsonLogicBuilder` provides two editing modes: a visual builder with AND/OR rule groups and a raw JSON editor for advanced conditions. Context fields (from upstream node output schemas) are available for autocomplete via `extractSchemaFieldPaths()`.
- **Keyboard shortcuts** — `Backspace`/`Delete` deletes the selected node or connection; `Cmd+Z`/`Ctrl+Z` undoes; `Cmd+Shift+Z`/`Ctrl+Shift+Z` redoes. Shortcuts are ignored when typing in sidebar input fields (handled by `defineShortcuts`).
