# Global AI

## Overview

The Global AI is an agentic assistant panel accessible from every page in the Medipal platform. It
uses a **route-aware context module system** — tools, system prompt, and capabilities change
automatically based on which page the user is viewing.

The feature is gated behind:

- **`FEATURE_AI_TOOLS`** runtime flag — must be `true`
- **`ai:read`** scope — required to see the trigger button
- **`ai:execute`** scope — required server-side to call the chat endpoint

**Supported LLM providers:** Anthropic (default), OpenAI, Google Gemini. The provider and model are
configured via environment variables; the application uses the Vercel AI SDK as a provider-agnostic
transport layer.

---

::: warning Security considerations

The `/api/ai/chat` endpoint is **JWT-authenticated** — `server/middleware/auth.ts` verifies
Bearer tokens (HS256, expiry check, access-token-only filtering) on all `/api/*` routes, and the
handler enforces the `ai:execute` scope. The client sends the token automatically via `useGlobalAI`
with `fetchWithRefresh` handling 401 refresh flows. However, the following concerns remain:

- **Client-supplied system prompt and tools.** The request body contains `systemPrompt` and
  `tools`. The server uses them as-is without validation. A malicious authenticated client can
  inject arbitrary instructions or tool definitions.
- **No rate limiting or input-size validation.** A single request can trigger up to 10 agentic
  steps, each potentially generating thousands of tokens.

Before exposing in a high-risk environment, consider adding:

- a server-owned, non-overridable system prompt
- rate limiting and request-size caps

:::

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  GlobalAITrigger.vue                                            │
│  (navbar button, scope-gated, streaming spinner)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ toggles
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  globalAI store (Pinia) — isOpen, messages (localStorage)       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ controls
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  GlobalAIChat.vue                                               │
│  (chat UI, tool display, rollback/context/read-only banners,    │
│   file upload, askUser widget, reasoning blocks)                │
└──────────────────────────┬──────────────────────────────────────┘
                           │ uses
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  useGlobalAI() composable (singleton via createGlobalState)     │
│  ┌───────────────────────────────────┐                          │
│  │ Chat (Vercel AI SDK)              │ ──── POST /api/ai/chat   │
│  │ + DefaultChatTransport            │ ◄─── streaming response  │
│  └───────────────────────────────────┘                          │
│  ┌───────────────────────────────────┐                          │
│  │ ContextModule (resolved by route) │                          │
│  │  ├─ tools + systemPrompt          │                          │
│  │  ├─ executeToolCall()             │                          │
│  │  └─ features (rollback, lock...) │                          │
│  └───────────────────────────────────┘                          │
│  ┌───────────────────────────────────┐                          │
│  │ executeToolCall() dispatch        │                          │
│  │  ├─ askUser → UI pause            │                          │
│  │  ├─ shared tools → executeSharedTool()                       │
│  │  └─ module tools → mod handler    │                          │
│  └───────────────────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  server/api/ai/chat.post.ts                                     │
│  Vercel AI SDK streamText()  ──── LLM provider (stream)         │
│  Tool schemas forwarded; execution is client-side only          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration

| Variable            | Default             | Notes                                                            |
| ------------------- | ------------------- | ---------------------------------------------------------------- |
| `FEATURE_AI_TOOLS`  | `false`             | Public runtime config. Set `true` to enable the Global AI panel. |
| `AI_PROVIDER`       | `anthropic`         | Server-side. `anthropic` / `openai` / `google`                   |
| `AI_MODEL`          | `claude-sonnet-4-6` | Server-side. Model ID for the chosen provider.                   |
| `ANTHROPIC_API_KEY` | —                   | Required when `AI_PROVIDER=anthropic`                            |
| `OPENAI_API_KEY`    | —                   | Required when `AI_PROVIDER=openai`                               |
| `GOOGLE_AI_API_KEY` | —                   | Required when `AI_PROVIDER=google`                               |

`FEATURE_AI_TOOLS` is declared in `nuxt.config.ts` under `runtimeConfig.public`; the other
variables are private server-only config.

---

## Key Source Files

| File                                                        | Responsibility                                                                                             |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Composables & Stores**                                    |                                                                                                            |
| `app/composables/useGlobalAI.ts`                            | Main composable (singleton). Owns `Chat` instance, tool dispatch, rollback, askUser, store lock, messages. |
| `app/stores/globalAI.ts`                                    | Pinia store: `isOpen`, `messages` (localStorage persistence), `pendingContextChange`, `quotaExceeded`.     |
| **Components**                                              |                                                                                                            |
| `app/components/GlobalAI/GlobalAITrigger.vue`               | Navbar button, scope-gated (`ai:read`), streaming spinner indicator.                                       |
| `app/components/GlobalAI/GlobalAIChat.vue`                  | Chat UI. Message rendering, tool groups, banners, file upload, askUser widget, reasoning blocks.           |
| **Plugin**                                                  |                                                                                                            |
| `app/plugins/globalAI.client.ts`                            | Registers `GlobalAITrigger` into `navbar-actions` extensible slot when `FEATURE_AI_TOOLS` is enabled.      |
| **Global AI Core** (`app/utils/ai/global/`)                 |                                                                                                            |
| `index.ts`                                                  | Re-exports: shared tools layer, system prompt builder, context providers, types.                           |
| `types.ts`                                                  | `GlobalToolContext`, `GlobalToolHandler`, `GlobalToolDefinition` type definitions.                         |
| `systemPrompt.ts`                                           | `buildGlobalSystemPrompt()` — base system prompt for the default module.                                   |
| `contextProviders.ts`                                       | `getPageContext()` — route-to-description mapper for system prompt context.                                |
| `sharedTools.ts`                                            | Shared tools aggregation: definitions, handlers, hints, merge helpers, classification sets.                |
| **Shared Tools** (`app/utils/ai/global/tools/`)             |                                                                                                            |
| `getCurrentPageInfo.ts`                                     | Returns route info + page context description.                                                             |
| `askUser.ts`                                                | Clarifying question with options (no handler — intercepted by composable).                                 |
| `navigateTo.ts`                                             | `router.push()` navigation with route-prefix allowlist.                                                    |
| **Context Modules** (`app/utils/ai/global/contextModules/`) |                                                                                                            |
| `types.ts`                                                  | `ContextModule` interface definition.                                                                      |
| `index.ts`                                                  | `resolveModuleId()` route mapper + `createModule()` factory.                                               |
| `defaultModule.ts`                                          | Default module — shared tools only, no rollback/lock.                                                      |
| `designerModule.ts`                                         | Designer module — 31 designer tools + 3 shared, full features.                                             |
| `schedulingModule.ts`                                       | Scheduling module — 8 scheduling tools + 3 shared, rollback + readOnlyGuard.                               |
| `engineEditorModule.ts`                                     | Engine Editor module — 14 engine tools + 3 shared, rollback + storeLock.                                   |
| **Domain Tools**                                            |                                                                                                            |
| `app/utils/ai/designer/`                                    | `index.ts`, `systemPrompt.ts`, `types.ts`, `tools/*.ts` (31 tool modules).                                 |
| `app/utils/ai/scheduling/`                                  | `index.ts`, `systemPrompt.ts`, `types.ts`, `schemas.ts`, `tools/*.ts` (8 tool modules).                    |
| `app/utils/ai/engineEditor/`                                | `index.ts`, `systemPrompt.ts`, `types.ts`, `tools/*.ts` (14 tool modules).                                 |
| **Shared Utilities** (`app/utils/ai/shared/`)               |                                                                                                            |
| `fetchWithRefresh.ts`                                       | `createFetchWithRefresh()` — wraps fetch with automatic 401 → token refresh retry.                         |
| `fileAttachments.ts`                                        | `addFilesToList()`, `removeFileFromList()` — file validation, type remapping, size filtering.              |
| **Validation**                                              |                                                                                                            |
| `app/utils/ai/validateAIQuestionConfig.ts`                  | AJV validator — checks question config against engine JSON Schema.                                         |
| `app/utils/ai/validateQuestionnairePayload.ts`              | AJV validator — checks full questionnaire payload against API Swagger spec.                                |
| **Server**                                                  |                                                                                                            |
| `server/api/ai/chat.post.ts`                                | Nitro endpoint. Provider selection, streaming, input sanitization, tool schema forwarding.                 |
| `server/middleware/auth.ts`                                 | JWT authentication middleware — verifies Bearer tokens on all `/api/*` routes.                             |

---

## Server Endpoint (`server/api/ai/chat.post.ts`)

### Request body

```ts
{
  messages: UIMessage[],      // Vercel AI SDK message format
  systemPrompt: string,       // Built client-side by the active context module
  tools: Record<string, {     // Tool JSON Schemas from active module
    description: string,
    parameters: Record<string, unknown>
  }>
}
```

### Scope check

The handler calls `requireScope(event, "ai:execute")` before processing. This ensures only users
with the `ai:execute` scope can invoke the AI endpoint.

### Provider selection

The handler reads `AI_PROVIDER` from `runtimeConfig` and instantiates the appropriate SDK client
(`createAnthropic`, `createOpenAI`, or `createGoogleGenerativeAI`). If the required API key is
missing a `403` error is returned immediately.

### Extended thinking

When `AI_PROVIDER` is `anthropic` or `google` the handler enables extended thinking with an
8 000-token budget:

- **Anthropic:** `providerOptions.anthropic.thinking = { type: "enabled", budgetTokens: 8000 }`
- **Google:** `providerOptions.google.thinkingConfig = { thinkingBudget: 8000, includeThoughts: true }`

`maxTokens` is set to 16 000 for these providers to accommodate thinking tokens.

### Agentic steps

`stopWhen: stepCountIs(10)` limits the agent to a maximum of 10 tool-call / response cycles per
request.

### Tool execution

Tool schemas are forwarded to the LLM so it knows what tools exist and what arguments they accept.
**Tool execution happens entirely on the client** — the server never calls `execute()`. The
`toUIMessageStreamResponse()` helper streams tool calls and results back to the browser in the
format expected by the Vercel AI SDK `Chat` class.

### Input sanitization

Two sanitization passes protect against malformed tool-call inputs that would cause the Anthropic
API to reject with "tool_use.input: Input should be a valid dictionary":

1. **Pre-sanitization** — raw UI messages are cleaned before `convertToModelMessages()`. When
   `state === "output-error"` and `input` is undefined, the fallback `rawInput` (a malformed JSON
   string) is parsed or replaced with `{}`. The `rawInput` property is also deleted to prevent
   further fallback.
2. **Post-sanitization** — model messages are cleaned after `convertToModelMessages()` as a safety
   net, ensuring all `tool-call` parts have plain object inputs.

---

## `useGlobalAI()` Composable

Located at `app/composables/useGlobalAI.ts`.

### Singleton Pattern

`useGlobalAI` is wrapped with `createGlobalState` from VueUse — it persists across navigation and
component mount/unmount cycles. This ensures chat state, messages, and module context survive page
transitions.

`useGlobalAIStatus()` is a lightweight readonly ref (also `createGlobalState`) that exposes just
the streaming status string. Used by `GlobalAITrigger.vue` to show a spinner without instantiating
the full composable.

### Context Module Resolution

`activeModule` is a `shallowRef<ContextModule>` resolved from the current route. Module alignment
happens on each `handleSubmit` call by comparing `resolveModuleId(routeName())` to
`activeModule.value.id`.

Module switching is **intentionally NOT done via route watcher** because `createGlobalState` uses a
detached `effectScope` where `flush:'post'` watchers don't fire reliably, and `flush:'pre'` causes
race conditions with page transitions. Switching on submit is simple and predictable.

`activeContextInfo` is a computed that detects when the user has navigated away from the module's
page — enabling the context banner in the UI.

### Chat Instance

```ts
const chat = new Chat({
  transport: new DefaultChatTransport({
    api: "/api/ai/chat",
    headers: () => ({ Authorization: `Bearer ${auth.accessToken.value}` }),
    fetch: fetchWithRefresh,
    body: () => ({
      systemPrompt: activeModule.value.systemPrompt.value,
      tools: activeModule.value.tools.value,
    }),
  }),
  onToolCall: async ({ toolCall }) => {
    /* dispatch to executeToolCall */
  },
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
});
```

`sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls` causes the SDK to automatically
re-submit after every tool round-trip, enabling multi-step agentic behaviour without explicit user
interaction.

### Tool Dispatch (`executeToolCall`)

```
toolName === "askUser" && features.askUser
  └─ set pendingChoiceToolCallId, return null (waits for respondToChoice())

toolName NOT in uiOnlyTools && features.rollback
  └─ if first mutation → take snapshot via mod.takeSnapshot()
  └─ increment agentChangesCount

delegate to mod.executeToolCall(toolCall)
  └─ module calls executeSharedTool() first
  └─ falls back to domain-specific handler
```

### Store Lock

During streaming: when `features.storeLock` is enabled, the composable locks the module's store
(`isReadOnly = true`, `isAIProcessing = true`) on `status === "streaming" | "submitted"`. The
original `isReadOnly` value is saved in `_baseReadOnly` and restored when the agent finishes.

### Batch Undo / Rollback

| Variable             | Purpose                                                      |
| -------------------- | ------------------------------------------------------------ |
| `agentSnapshot`      | Serialized payload taken before the first mutating tool call |
| `agentHistoryLength` | Undo history length at that same moment                      |
| `agentChangesCount`  | Count of mutating tool calls in the current run              |
| `showRollbackBanner` | `true` when run completes with `agentChangesCount > 0`       |

`rollbackAgentChanges()` calls `mod.applyRollback()` which restores the payload from the snapshot,
trims the undo history back to `agentHistoryLength`, and clears the future stack — so Ctrl+Z cannot
replay intermediate AI states.

All counters are reset at the start of each new user message (`handleSubmit`). They are **not**
reset on auto-submit (tool round-trips) so multi-step agents accumulate the full change count.

### `askUser` Handling

When the agent calls `askUser` the composable stores `toolCallId` in `pendingChoiceToolCallId` and
returns without adding a tool output. Execution is paused. The UI renders choice buttons; when the
user clicks one, `respondToChoice(toolCallId, answerId, chosenLabel)` is called which adds the
tool output and triggers the next auto-submit.

### Message Persistence

Messages are persisted to localStorage via the Pinia store (`globalAIStore.messages`) with a
debounced 1-second watcher that only writes when `status === "ready"`.

- **Max messages:** `MAX_MESSAGES = 50` — older messages are pruned on persist.
- **Quota exceeded recovery:** strips file parts, keeps last 10 messages, shows a warning toast.
- **Restore on init:** messages are loaded from the store into the `Chat` instance on composable
  creation.

---

## Context Module System

### `ContextModule` Interface

```ts
interface ContextModule {
  id: "default" | "designer" | "engineEditor" | "scheduling";
  tools: ComputedRef<Record<string, any>>;
  systemPrompt: ComputedRef<string>;
  toolMeta: ComputedRef<Record<string, { icon: string; label: string }>>;
  executeToolCall: (toolCall: {
    toolName: string;
    toolCallId: string;
    input: unknown;
  }) => Promise<unknown>;
  features: {
    rollback: boolean;
    askUser: boolean;
    readOnlyGuard: boolean;
    storeLock: boolean;
  };
  uiOnlyTools: Set<string>;
  isReadOnly: ComputedRef<boolean>;
  contextLabel?: ComputedRef<string | undefined>;
  contextRoute?: ComputedRef<RouteLocationRaw | undefined>;
  cleanup?: () => void;

  // Module-managed state for snapshot/rollback and store locking
  takeSnapshot?: () => { data: string; historyLength: number };
  applyRollback?: (snapshot: { data: string; historyLength: number }) => void;
  lockStore?: () => boolean;
  unlockStore?: (baseReadOnly: boolean) => void;
}
```

### Route Resolution (`resolveModuleId`)

| Route name                    | Module ID      |
| ----------------------------- | -------------- |
| `questionnaire-id-designer`   | `designer`     |
| `questionnaire-id-scheduling` | `scheduling`   |
| `admin-panel-engines`         | `engineEditor` |
| Everything else               | `default`      |

### Module: Default

- **Tools:** 3 shared tools only (`getCurrentPageInfo`, `askUser`, `navigateTo`)
- **Features:** `askUser: true`, all others `false`
- **System prompt:** `buildGlobalSystemPrompt()` with user name, page context, tool hints
- **No rollback, no store lock, no read-only guard**

### Module: Designer

- **Tools:** 31 designer tools + 3 shared = 34 total
- **Features:** `rollback: true`, `askUser: true`, `readOnlyGuard: true`, `storeLock: true`
- **System prompt:** `buildDesignerSystemPrompt()` — dynamic per-request with questionnaire
  structure, question types, variables, functions, action templates, validation issues
- **Read-only mode:** 6 allowed tools + shared (`selectQuestion`, `setPreviewLanguage`,
  `openSidepanelTab`, `openHierarchyView`, `readCoreDocumentation`, `getQuestionActions`)
- **UI-only tools:** `selectQuestion`, `setPreviewLanguage`, `openSidepanelTab`,
  `openHierarchyView`, `readCoreDocumentation` + shared
- **Store lock:** `designerStore.isReadOnly` + `designerStore.isAIProcessing`
- **Snapshot/rollback:** serializes/restores `state.payload`, trims undo history

### Module: Scheduling

- **Tools:** 8 scheduling tools + 3 shared = 11 total
- **Features:** `rollback: true`, `askUser: true`, `readOnlyGuard: true`, `storeLock: false`
- **System prompt:** `buildSchedulingSystemPrompt()` — schedule data model, current schedules as
  JSON, sections, questionnaire status
- **Read-only mode:** 5 allowed tools + shared (`getSchedules`, `getScheduleDetails`,
  `previewAccessWindows`, `describeSchedule`, `validateScheduleSections`)
- **UI-only tools:** shared only
- **Snapshot/rollback:** serializes/restores schedule array via
  `questionnaireStore.updateQuestionnaire()`

### Module: Engine Editor

- **Tools:** 14 engine tools + 3 shared = 17 total
- **Features:** `rollback: true`, `askUser: true`, `readOnlyGuard: false`, `storeLock: true`
- **System prompt:** `buildEngineEditorSystemPrompt()` — engine metadata, component code, shared
  files, Vue 3 guidelines
- **UI-only tools:** `selectComponent`, `selectSharedFiles` + shared
- **Store lock:** `engineEditorStore.isReadOnly` + `engineEditorStore.isAIProcessing`
- **Snapshot/rollback:** serializes/restores full engine editor state, trims undo history

---

## Shared Tools Layer

### Architecture

`sharedTools.ts` aggregates 3 tools from `global/tools/` and provides merge helpers that inject
shared tools into every context module. This eliminates tool duplication and ensures consistent
behaviour across all modules.

### Shared Tools (3)

| Tool                 | Description                                                                 | Key inputs                                       |
| -------------------- | --------------------------------------------------------------------------- | ------------------------------------------------ |
| `getCurrentPageInfo` | Returns route name, path, params, query, and page context description       | _(none)_                                         |
| `askUser`            | Pause and present a clarifying question with predefined options to the user | `question`, `options[]` (id, label, description) |
| `navigateTo`         | Navigate the user to a different page via `router.push()`                   | `routeName`, `params?`                           |

### `navigateTo` Route Allowlist

Only the following route prefixes are permitted:

`index`, `patients`, `patient-id`, `questionnaire-id`, `admin-panel`, `enrollments`,
`user-profile`, `role-id`, `workflow-run-id`, `folder`

### Merge Pattern

```ts
// Inject shared tool definitions into module tools (module takes precedence)
mergeWithSharedTools(moduleTools)  → { ...SHARED_TOOL_DEFINITIONS, ...moduleTools }

// Inject shared hints into module hint list
mergeWithSharedHints(moduleHints)  → [...SHARED_TOOL_HINTS, ...moduleHints]

// Execute a shared tool — returns { handled: true, result } or { handled: false }
executeSharedTool(name, input, ctx)

// Get shared tool meta (icons + i18n labels) for the UI
getSharedToolMeta(t)
```

### Classification Sets

| Set                          | Contents                                      | Purpose                                  |
| ---------------------------- | --------------------------------------------- | ---------------------------------------- |
| `SHARED_UI_ONLY_TOOLS`       | `{ askUser }`                                 | No state mutation, no undo entry         |
| `SHARED_READONLY_SAFE_TOOLS` | `{ getCurrentPageInfo, askUser, navigateTo }` | Allowed even on published questionnaires |

---

## Tools Reference

### Shared Tools (3)

See [Shared Tools Layer](#shared-tools-3) above.

### Designer Tools (31)

#### Question management

| Tool                 | Description                                                       | Key inputs                                                          |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| `addQuestion`        | Add a new question to a section                                   | `section_id`, `question_type_id`, `question_text`, `config`, `name` |
| `addQuestions`       | Batch-add multiple questions to a section in one call             | `section_id`, `questions[]` (type, text, config, name)              |
| `updateQuestion`     | Update text, name, description, or config of an existing question | `question_id`, `question_text`, `config`, `name`, `description`     |
| `deleteQuestion`     | Remove a question from a section                                  | `section_id`, `question_id`                                         |
| `changeQuestionType` | Replace a question's type (clears config and all overrides)       | `question_id`, `new_question_type_id`, `new_config`, `section_id`   |
| `cloneQuestion`      | Duplicate a question in-place (new UUID, empty name/actions)      | `question_id`, `section_id`                                         |
| `getQuestionActions` | Retrieve the current actions configuration for a question         | `question_id`, `section_id`                                         |

#### Section management

| Tool                 | Description                       | Key inputs                            |
| -------------------- | --------------------------------- | ------------------------------------- |
| `addSection`         | Add a new section                 | `title`, `id` (optional)              |
| `deleteSection`      | Remove a section                  | `id`                                  |
| `updateSectionTitle` | Rename a section                  | `section_id`, `title`                 |
| `moveSection`        | Move a section to a 0-based index | `section_id`, `target_position`       |
| `reorderSections`    | Reorder all sections at once      | `section_ids` (complete ordered list) |

#### Question organisation

| Tool           | Description                                       | Key inputs                                                          |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| `moveQuestion` | Move or reorder a question within/across sections | `question_id`, `target_position`, `target_section_id`, `section_id` |

#### Conditional logic

| Tool                 | Description                                                            | Key inputs                             |
| -------------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| `setQuestionActions` | Set `on_answer` / `on_enter` action groups with conditions and actions | `section_id`, `question_id`, `actions` |

#### Translations

| Tool                           | Description                                       | Key inputs                                                    |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------- |
| `translateQuestions`           | Bulk-set translations for a target language       | `target_language`, `translations` (map of question_id → text) |
| `setQuestionConfigOverride`    | Add or update a per-language config override      | `question_id`, `language_code`, `config`                      |
| `setQuestionConfigOverrides`   | Batch-set config overrides for multiple questions | `overrides[]` (question_id, language_code, config)            |
| `removeQuestionConfigOverride` | Remove a per-language config override             | `question_id`, `language_code`                                |

#### Scoring

| Tool              | Description                                    | Key inputs                                                  |
| ----------------- | ---------------------------------------------- | ----------------------------------------------------------- |
| `createVariable`  | Create a scoring variable                      | `name`, `label`, `type`, `defaultValue`                     |
| `createVariables` | Batch-create multiple scoring variables        | `variables[]` (name, label, type, defaultValue)             |
| `updateVariable`  | Update an existing variable                    | `variable_id`, `name`, `label`, `type`, `defaultValue`      |
| `deleteVariable`  | Delete a scoring variable                      | `variable_id`                                               |
| `createFunction`  | Create a custom JS scoring function            | `name`, `label`, `returnType`, `arguments`, `code`          |
| `createFunctions` | Batch-create multiple custom scoring functions | `functions[]` (name, label, returnType, arguments, code)    |
| `updateFunction`  | Update an existing function                    | `function_name`, `label`, `returnType`, `arguments`, `code` |
| `deleteFunction`  | Delete a custom function                       | `function_name`                                             |

#### UI navigation (UI-only — no undo entry)

| Tool                    | Description                                         | Key inputs                                       |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------ |
| `selectQuestion`        | Scroll to and highlight a question in the designer  | `question_id`, `section_id`                      |
| `setPreviewLanguage`    | Switch the active preview language                  | `language_code`                                  |
| `openSidepanelTab`      | Activate a right-panel tab                          | `tab`: `"details"` / `"actions"` / `"preview"`   |
| `openHierarchyView`     | Switch the left hierarchy panel view                | `view`: `"tree"` / `"description"` / `"flowMap"` |
| `readCoreDocumentation` | Read built-in documentation about designer features | _(no inputs)_                                    |

### Scheduling Tools (8)

| Tool                       | Description                                          | Key inputs                                  |
| -------------------------- | ---------------------------------------------------- | ------------------------------------------- |
| `getSchedules`             | List all schedules for the current questionnaire     | _(none)_                                    |
| `getScheduleDetails`       | Get full details of a specific schedule              | `schedule_id`                               |
| `createSchedule`           | Create a new schedule                                | `name`, `sections`, `config`                |
| `updateSchedule`           | Update an existing schedule                          | `schedule_id`, `name`, `sections`, `config` |
| `deleteSchedule`           | Delete a schedule                                    | `schedule_id`                               |
| `previewAccessWindows`     | Preview calculated access windows for a schedule     | `schedule_id`                               |
| `describeSchedule`         | Get a human-readable description of a schedule       | `schedule_id`                               |
| `validateScheduleSections` | Validate that schedule sections reference valid data | `schedule_id`                               |

### Engine Editor Tools (14)

| Tool                      | Description                            | Key inputs                               |
| ------------------------- | -------------------------------------- | ---------------------------------------- |
| `selectComponent`         | Select a component in the editor UI    | `component_name`                         |
| `selectSharedFiles`       | Switch to the shared files view        | _(none)_                                 |
| `getEngineInfo`           | Get engine metadata and component list | _(none)_                                 |
| `getComponentCode`        | Get source code of a component's files | `component_name`                         |
| `getSharedFilesInfo`      | Get list and content of shared files   | _(none)_                                 |
| `createComponent`         | Create a new engine component          | `name`, `description`, `files`           |
| `deleteComponent`         | Delete an engine component             | `component_name`                         |
| `updateComponentMetadata` | Update component name or description   | `component_name`, `name`, `description`  |
| `updateComponentFile`     | Update a component file's content      | `component_name`, `file_name`, `content` |
| `createComponentFile`     | Add a new file to a component          | `component_name`, `file_name`, `content` |
| `deleteComponentFile`     | Remove a file from a component         | `component_name`, `file_name`            |
| `updateSharedFile`        | Update a shared file's content         | `file_name`, `content`                   |
| `createSharedFile`        | Create a new shared file               | `file_name`, `content`                   |
| `deleteSharedFile`        | Delete a shared file                   | `file_name`                              |

---

## Read-only Mode

Read-only mode activates per-module when the questionnaire is not in DRAFT status or the user lacks
the `questionnaire:write` scope.

Each domain module defines its own `READONLY_ALLOWED_TOOLS` set. The read-only guard in
`executeToolCall` checks both the module allowlist and `SHARED_READONLY_SAFE_TOOLS`:

**Designer read-only tools:**
`selectQuestion`, `setPreviewLanguage`, `openSidepanelTab`, `openHierarchyView`,
`readCoreDocumentation`, `getQuestionActions` + shared tools

**Scheduling read-only tools:**
`getSchedules`, `getScheduleDetails`, `previewAccessWindows`, `describeSchedule`,
`validateScheduleSections` + shared tools

**Engine Editor:** does not use `readOnlyGuard` (`features.readOnlyGuard: false`).

---

## Validation Layers

Three independent validation checkpoints protect the questionnaire data:

### 1. Zod — tool input schemas

Every tool has a Zod schema defined in its module under `app/utils/ai/*/tools/`. The schemas
are compiled to JSON Schema via `z.toJSONSchema()` and forwarded to the LLM in the tools payload.
The Zod schemas are also used implicitly because the handlers receive typed, validated input.

### 2. AJV — question config validation (`validateAIQuestionConfig`)

`app/utils/ai/validateAIQuestionConfig.ts` — called inside `addQuestion` and `updateQuestion`
handlers whenever a `config` object is provided. It compiles the engine's JSON Schema for the
question type and runs AJV validation with `removeAdditional: "failing"` and `useDefaults: true`.
If validation fails, the tool returns `{ success: false, error: "...", schema_hint }` so the model
can self-correct on the next step.

### 3. API validator — full questionnaire payload (`validateQuestionnairePayload`)

`app/utils/ai/validateQuestionnairePayload.ts` — validates the complete questionnaire payload
against the Swagger spec path `POST /api/v1/questionnaire`. This is a singleton AJV instance
compiled once at module load (`useApiValidation` from `@medipal/mp-typescript-api-validation`).
This validator is called before the designer saves to the API.

---

## UI Components

### `GlobalAITrigger.vue`

Navbar button registered via the extensible slot system (`globalAI.client.ts` plugin → `navbar-actions` slot).

- **Scope-gated:** only renders when user has `ai:read` scope
- **Streaming indicator:** shows `svg-spinners:ring-resize` icon while AI is streaming or submitted
- **Toggle:** clicks toggle `globalAIStore.isOpen`
- **Beta badge:** displays a "Beta" badge on the button

### `GlobalAIChat.vue`

Full chat panel (~750 lines) using `UChatMessages` + `UChatPrompt` from Nuxt UI.

#### `groupParts()`

Groups consecutive tool calls of the same type into a single row showing a count badge (e.g.
"Updating question ×5"). Groups are reset by any intervening text part so tool calls after agent
prose start a fresh group. `askUser`, `reasoning`, and `text` parts pass through ungrouped.

#### `displayMessages` computed

The Vercel AI SDK emits each agentic step as a separate message object. `displayMessages` merges
consecutive tool-only assistant messages (no meaningful text content) into a single logical message
so `groupParts()` can group tool calls across step boundaries.

#### Banners

- **Context banner** (`UAlert` info) — shown when `activeContextInfo` is set (user navigated away
  from module's page). Has "Go back" action.
- **Rollback banner** (`UAlert` warning) — shown when `showRollbackBanner` is true. Displays
  change count and "Undo all changes" button. Hidden during streaming to avoid flash at step
  boundaries.
- **Read-only banner** (`UAlert` neutral) — shown when `isReadOnly` and module is `designer` or
  `scheduling`.

#### `askUser` widget

A bordered card rendered for `askUser` tool calls. While `state === "input-available"` and
`pendingChoiceToolCallId` matches, the predefined options are rendered as `UButton` elements.
After selection the chosen option is shown as a `UBadge`. For `askUser` without options, a
free-text fallback message is displayed.

#### Reasoning / thinking

When the model returns a `reasoning` part (Anthropic extended thinking / Google thinking), it is
rendered as a collapsible `<details>` block with a brain icon. The block is open while streaming
and collapsed once complete.

#### Drag-and-drop file upload

The entire chat panel is a drop target. A translucent overlay appears during drag. Dropped files
are filtered by type and size before being added to `pendingFiles`.

---

## File Attachments

Accepted MIME types: `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `application/pdf`,
`text/plain`, `text/csv`, `text/html`, `text/markdown`, `text/xml`, `application/json`,
`application/xml`.

Maximum 10 MB per file.

Text-based types are remapped to `text/plain` for Anthropic compatibility. Files are converted to
`FileUIPart[]` via `addFilesToList()` and attached to the next message sent via
`chat.sendMessage({ text, files })`.

Upload methods:

- **Drag-and-drop:** drop onto the chat panel
- **Click upload:** paperclip button in the prompt footer triggers a hidden `<input type="file">`
- **Pending strip:** attached files appear as chips above the prompt with remove buttons

---

## Adding a New Tool

Follow these steps to extend a domain module's capabilities:

### Step 1 — Create a tool module

Create a new file in the domain's tools directory (e.g. `app/utils/ai/designer/tools/myNewTool.ts`):

```ts
import { z } from "zod";
import type { ToolHandler } from "../types";

const schema = z.object({
  question_id: z.string().describe("ID of the question"),
  some_param: z.string().describe("What this parameter does"),
});

const handler: ToolHandler = async (args, { state, designerStore }) => {
  const { question_id, some_param } = args;
  designerStore.saveState(); // required for undo support
  // ... mutate state.payload ...
  return { success: true };
};

export const myNewTool = { schema, handler };
```

Return `{ success: false, error: "..." }` on failure — the model will see the error and can
self-correct.

### Step 2 — Register in domain index

Import and add the tool to the domain's `*_TOOLS` (JSON Schema map), `*_TOOL_HANDLERS`, and
`*_TOOL_SYSTEM_PROMPT_HINTS` exports (e.g. `app/utils/ai/designer/index.ts`).

### Step 3 — Classify in context module

In the domain's context module file (e.g. `designerModule.ts`):

- If UI-only (no payload mutation, no undo needed): add to `UI_ONLY_TOOLS`
- If read-only safe: add to the module's `READONLY_ALLOWED_TOOLS`
- Otherwise: no classification needed — snapshot/counter tracking happens automatically

### Step 4 — Add `toolMeta` entry

In the context module's `toolMeta` computed, add an entry with icon and i18n label:

```ts
myNewTool: { icon: "lucide:wand-2", label: k("myNewTool") },
```

### Step 5 — Add i18n key

Add `@components.globalAI.tools.myNewTool` to all 11 locale files.

### Step 6 — Update system prompt if needed

If the tool requires contextual information (e.g. a list of available items, IDs, or schema hints)
add it to the domain's `build*SystemPrompt()` function.

---

## Adding a Shared Tool

### Step 1 — Create in `global/tools/`

Create a new file (e.g. `app/utils/ai/global/tools/mySharedTool.ts`) exporting:

```ts
export const definition = {
  description: "...",
  parameters: z.toJSONSchema(schema),
};
export const handler: GlobalToolHandler = async (args, ctx) => {
  /* ... */
};
export const systemPromptHint = "mySharedTool(...) — description";
```

### Step 2 — Register in `sharedTools.ts`

Add the tool to all 5 registries:

- `SHARED_TOOL_DEFINITIONS`
- `SHARED_TOOL_HANDLERS` (unless UI-only like `askUser`)
- `SHARED_TOOL_HINTS`
- `SHARED_UI_ONLY_TOOLS` (if applicable)
- `SHARED_READONLY_SAFE_TOOLS` (if applicable)

### Step 3 — Add to `getSharedToolMeta()`

Add an entry with icon and i18n label key.

### Step 4 — Add i18n key

Add `@components.globalAI.tools.mySharedTool` to all 11 locale files.

The tool is **automatically available in all modules** via `mergeWithSharedTools()` and
`mergeWithSharedHints()` — no per-module registration needed.

---

## Adding a New Context Module

### Step 1 — Implement `ContextModule` interface

Create a new factory function (e.g. `createMyModule()`) in `app/utils/ai/global/contextModules/`
that returns a `ContextModule` object with all required fields.

### Step 2 — Add route mapping

In `resolveModuleId()` (`contextModules/index.ts`), add a route name → module ID mapping.

### Step 3 — Register in `createModule()` factory

Add the module ID case to the `createModule()` switch in `contextModules/index.ts`.

### Step 4 — Use shared tools

Call `mergeWithSharedTools()` and `mergeWithSharedHints()` for tool integration so all shared
tools are automatically available.
