# AI Designer

## Overview

The AI Designer is an agentic assistant embedded directly inside the Questionnaire Designer. It
understands the full structure of the questionnaire being edited and can autonomously add, edit,
move, and configure questions and sections, set conditional logic, manage scoring variables and
functions, translate content, and navigate the designer UI — all from plain natural-language
instructions.

The feature is gated behind the `FEATURE_AI_TOOLS` runtime flag (see [Configuration](#configuration)).
When the flag is enabled an **AI** tab appears in the designer sidepanel.

**Supported LLM providers:** Anthropic (default), OpenAI, Google Gemini. The provider and model are
configured via environment variables; the application uses the Vercel AI SDK as a provider-agnostic
transport layer.

---

::: warning Remaining security considerations

The `/api/ai/chat` endpoint is **JWT-authenticated** — `server/middleware/auth.ts` verifies
Bearer tokens (HS256, expiry check, access-token-only filtering) on all `/api/*` routes. The
client sends the token automatically via `useAIDesigner.ts` with `fetchWithRefresh` handling 401
refresh flows. However, the following concerns remain:

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
┌─────────────────────────────────────────────────────────┐
│  DesignerAIChat.vue                                     │
│  (chat UI, tool display, rollback banner, file upload)  │
└────────────────────┬────────────────────────────────────┘
                     │ uses
                     ▼
┌─────────────────────────────────────────────────────────┐
│  useAIDesigner() composable                             │
│  ┌─────────────────────────────┐                        │
│  │ Chat (Vercel AI SDK)        │ ──── POST /api/ai/chat │
│  │ + DefaultChatTransport      │ ◄─── streaming response│
│  └─────────────────────────────┘                        │
│  ┌─────────────────────────────┐                        │
│  │ executeToolCall()           │                        │
│  │  ├─ UI_ONLY_TOOLS  ──────────── UI state only        │
│  │  └─ mutating tools ──────────── DESIGNER_TOOL_HANDLERS
│  │                                  └─ designerStore    │
│  └─────────────────────────────┘                        │
└─────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│  server/api/ai/chat.post.ts                             │
│  Vercel AI SDK streamText()  ──── LLM provider (stream) │
│  Tool schemas forwarded; execution is client-side only  │
└─────────────────────────────────────────────────────────┘
```

---

## Configuration

| Variable            | Default             | Notes                                                                 |
| ------------------- | ------------------- | --------------------------------------------------------------------- |
| `FEATURE_AI_TOOLS`  | `false`             | Public runtime config. Set `true` to show the AI tab in the designer. |
| `AI_PROVIDER`       | `anthropic`         | Server-side. `anthropic` / `openai` / `google`                        |
| `AI_MODEL`          | `claude-sonnet-4-6` | Server-side. Model ID for the chosen provider.                        |
| `ANTHROPIC_API_KEY` | —                   | Required when `AI_PROVIDER=anthropic`                                 |
| `OPENAI_API_KEY`    | —                   | Required when `AI_PROVIDER=openai`                                    |
| `GOOGLE_AI_API_KEY` | —                   | Required when `AI_PROVIDER=google`                                    |

`FEATURE_AI_TOOLS` is declared in `nuxt.config.ts` under `runtimeConfig.public`; the other
variables are private server-only config.

---

## Key Source Files

| File                                           | Responsibility                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `server/api/ai/chat.post.ts`                   | Nitro event handler. Receives messages, builds provider instance, calls `streamText`, streams response back.              |
| `server/middleware/auth.ts`                    | JWT authentication middleware — verifies Bearer tokens (HS256) on all `/api/*` routes.                                    |
| `app/composables/useAIDesigner.ts`             | Main composable. Owns `Chat` instance, executes tool calls, manages read-only lock, batch undo/rollback, `askUser` pause. |
| `app/components/Designer/DesignerAIChat.vue`   | Chat UI. Message rendering, tool status rows, rollback banner, file attachment strip.                                     |
| `app/utils/ai/designer/`                       | Modular tool directory (replaces single `designerTools.ts`):                                                              |
| `  index.ts`                                   | Re-exports `DESIGNER_TOOLS`, `READONLY_ALLOWED_TOOLS`, `DESIGNER_TOOL_HANDLERS`, `ACTION_TEMPLATES`.                      |
| `  systemPrompt.ts`                            | `buildDesignerSystemPrompt()` — builds the dynamic system prompt per request.                                             |
| `  types.ts`                                   | `ToolContext`, `ToolHandler` type definitions.                                                                            |
| `  tools/*.ts`                                 | Individual tool modules (~32 files), each exporting a Zod schema and handler.                                             |
| `app/utils/ai/validateAIQuestionConfig.ts`     | AJV validator — checks a question `config` object against the engine-provided JSON Schema for that question type.         |
| `app/utils/ai/validateQuestionnairePayload.ts` | AJV validator — checks the entire questionnaire payload against the API Swagger spec before save.                         |

---

## Server Endpoint (`server/api/ai/chat.post.ts`)

### Request body

```ts
{
  messages: UIMessage[],      // Vercel AI SDK message format
  systemPrompt: string,       // Built client-side by buildDesignerSystemPrompt()
  tools: Record<string, {     // DESIGNER_TOOLS JSON Schemas from designer/index.ts
    description: string,
    parameters: Record<string, unknown>
  }>
}
```

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

---

## `useAIDesigner()` Composable

Located at `app/composables/useAIDesigner.ts`.

### Singleton

`useAIDesignerStatus()` is wrapped with `createSharedComposable` so the streaming status ref is
shared between `DesignerSidepanel` (tab spinner) and `DesignerAIChat`.

`useAIDesigner()` itself is **not** shared-composable; it is instantiated once inside
`DesignerAIChat.vue`.

### Chat setup

```ts
const chat = new Chat({
  transport: new DefaultChatTransport({
    api: "/api/ai/chat",
    headers: () => ({
      Authorization: `Bearer ${auth.accessToken.value}`,
    }),
    fetch: fetchWithRefresh, // auto-refreshes on 401
    body: () => ({
      systemPrompt: systemPrompt.value, // reactive, rebuilt each request
      tools: isQuestionnaireReadOnly.value
        ? getReadOnlyTools() // subset of DESIGNER_TOOLS for published questionnaires
        : DESIGNER_TOOLS,
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

### Tool dispatch (`executeToolCall`)

```
toolName === "askUser"
  └─ set pendingChoiceToolCallId, return null (waits for respondToChoice())

toolName in UI_ONLY_TOOLS  (selectQuestion, setPreviewLanguage, openSidepanelTab, openHierarchyView, readCoreDocumentation)
  └─ run handler, skip snapshot/counter

mutating tool
  └─ if first mutation in this run → take payload snapshot + record history length
  └─ increment agentChangesCount
  └─ run handler from DESIGNER_TOOL_HANDLERS
```

### Read-only lock

While streaming or submitted the composable sets `designerStore.isReadOnly = true` and
`designerStore.isAIProcessing = true`. The original `isReadOnly` value is saved and restored when
the agent finishes.

### Batch undo / rollback

| Variable             | Purpose                                                                   |
| -------------------- | ------------------------------------------------------------------------- |
| `agentSnapshot`      | `JSON.stringify(state.payload)` taken before the first mutating tool call |
| `agentHistoryLength` | Undo history length at that same moment                                   |
| `agentChangesCount`  | Count of mutating tool calls in the current run                           |
| `showRollbackBanner` | `true` when run completes with `agentChangesCount > 0`                    |

`rollbackAgentChanges()` restores `state.payload` from the snapshot, trims the undo history back to
`agentHistoryLength`, and clears the future stack — so Ctrl+Z cannot replay intermediate AI states.

All counters are reset at the start of each new user message (`handleSubmit`). They are **not**
reset on auto-submit (tool round-trips) so multi-step agents accumulate the full change count.

### `askUser` handling

When the agent calls `askUser` the composable stores `toolCallId` in `pendingChoiceToolCallId` and
returns without adding a tool output. Execution is paused. The UI renders choice buttons; when the
user clicks one, `respondToChoice(toolCallId, answerId, chosenLabel)` is called which adds the
tool output and triggers the next auto-submit.

### File attachments

Accepted types: `image/png`, `image/jpeg`, `image/webp`, `application/pdf`, `text/plain`,
`application/json`, `text/csv`. Maximum 10 MB per file.

Files are converted to `FileUIPart[]` via `convertFileListToFileUIParts` and attached to the next
message sent via `chat.sendMessage({ text, files })`.

---

## Dynamic System Prompt (`buildDesignerSystemPrompt()`)

Defined in `app/utils/ai/designer/systemPrompt.ts`. Called via the reactive `systemPrompt` computed in
`useAIDesigner` — it is rebuilt on every request and sent in the request body.

Contents injected per request:

| Section                      | Details                                                                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Questionnaire metadata       | ID, language list, default language                                                                                              |
| Current selection context    | Selected section ID + title, selected question ID + type                                                                         |
| Engine capabilities          | Engine name, available question types with config schema hints (`schemaToHint`)                                                  |
| Full questionnaire structure | All sections with their questions (ID, name, type, translations, config)                                                         |
| Scoring context              | Defined variables (id, name, type) and function signatures                                                                       |
| `ACTION_TEMPLATES`           | Exact JSON string templates for `nextQuestion`, `goToQuestionId`, `endQuestionnaire`, `checkAnswer`, `setVariable`, `customCode` |
| Behavioural rules            | When to use `askUser`; language code format; how to set config overrides; undo preservation policy                               |
| Destructive-action warning   | `changeQuestionType` clears all config and config overrides                                                                      |

---

## Tools Reference

### Question management

| Tool                 | Description                                                       | Key inputs                                                          |
| -------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| `addQuestion`        | Add a new question to a section                                   | `section_id`, `question_type_id`, `question_text`, `config`, `name` |
| `addQuestions`       | Batch-add multiple questions to a section in one call             | `section_id`, `questions[]` (type, text, config, name)              |
| `updateQuestion`     | Update text, name, description, or config of an existing question | `question_id`, `question_text`, `config`, `name`, `description`     |
| `deleteQuestion`     | Remove a question from a section                                  | `section_id`, `question_id`                                         |
| `changeQuestionType` | Replace a question's type (clears config and all overrides)       | `question_id`, `new_question_type_id`, `new_config`, `section_id`   |
| `cloneQuestion`      | Duplicate a question in-place (new UUID, empty name/actions)      | `question_id`, `section_id`                                         |
| `getQuestionActions` | Retrieve the current actions configuration for a question         | `question_id`, `section_id`                                         |

### Section management

| Tool                 | Description                       | Key inputs                            |
| -------------------- | --------------------------------- | ------------------------------------- |
| `addSection`         | Add a new section                 | `title`, `id` (optional)              |
| `deleteSection`      | Remove a section                  | `id`                                  |
| `updateSectionTitle` | Rename a section                  | `section_id`, `title`                 |
| `moveSection`        | Move a section to a 0-based index | `section_id`, `target_position`       |
| `reorderSections`    | Reorder all sections at once      | `section_ids` (complete ordered list) |

### Question organisation

| Tool           | Description                                       | Key inputs                                                          |
| -------------- | ------------------------------------------------- | ------------------------------------------------------------------- |
| `moveQuestion` | Move or reorder a question within/across sections | `question_id`, `target_position`, `target_section_id`, `section_id` |

### Conditional logic

| Tool                 | Description                                                            | Key inputs                             |
| -------------------- | ---------------------------------------------------------------------- | -------------------------------------- |
| `setQuestionActions` | Set `on_answer` / `on_enter` action groups with conditions and actions | `section_id`, `question_id`, `actions` |

### Translations

| Tool                           | Description                                       | Key inputs                                                    |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------- |
| `translateQuestions`           | Bulk-set translations for a target language       | `target_language`, `translations` (map of question_id → text) |
| `setQuestionConfigOverride`    | Add or update a per-language config override      | `question_id`, `language_code`, `config`                      |
| `setQuestionConfigOverrides`   | Batch-set config overrides for multiple questions | `overrides[]` (question_id, language_code, config)            |
| `removeQuestionConfigOverride` | Remove a per-language config override             | `question_id`, `language_code`                                |

### Scoring

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

### UI navigation (UI-only — no undo entry)

| Tool                    | Description                                         | Key inputs                                       |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------ |
| `selectQuestion`        | Scroll to and highlight a question in the designer  | `question_id`, `section_id`                      |
| `setPreviewLanguage`    | Switch the active preview language                  | `language_code`                                  |
| `openSidepanelTab`      | Activate a right-panel tab                          | `tab`: `"details"` / `"actions"` / `"preview"`   |
| `openHierarchyView`     | Switch the left hierarchy panel view                | `view`: `"tree"` / `"description"` / `"flowMap"` |
| `readCoreDocumentation` | Read built-in documentation about designer features | _(no inputs)_                                    |

### User interaction

| Tool      | Description                                         | Key inputs                                       |
| --------- | --------------------------------------------------- | ------------------------------------------------ |
| `askUser` | Pause and present a clarifying question to the user | `question`, `options[]` (id, label, description) |

### Read-only mode (`READONLY_ALLOWED_TOOLS`)

When a questionnaire is published (`isQuestionnaireReadOnly`), only a subset of tools is sent to
the LLM via `getReadOnlyTools()`. The 7 allowed tools are:

`selectQuestion`, `setPreviewLanguage`, `openSidepanelTab`, `openHierarchyView`,
`readCoreDocumentation`, `getQuestionActions`, `askUser`

---

## Validation Layers

Three independent validation checkpoints protect the questionnaire data:

### 1. Zod — tool input schemas

Every tool has a Zod schema defined in its module under `app/utils/ai/designer/tools/`. The schemas
are compiled to JSON Schema via `z.toJSONSchema()` and forwarded to the LLM in `DESIGNER_TOOLS`.
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

## Action Templates

Defined in `app/utils/ai/designer/index.ts` and injected verbatim into the system prompt so the model can use
them as-is in `setQuestionActions` calls.

```ts
export const ACTION_TEMPLATES = {
  // Navigate to the next question in sequence
  nextQuestion:
    '{"id":"nextQuestion","name":"Next Question","expression":[...]}',

  // Jump to a specific question by ID (requires questionId argument)
  goToQuestionId:
    '{"id":"go_to_question_id","name":"Go To Question","expression":[...goToQuestionId(${questionId})...]}',

  // End the questionnaire immediately
  endQuestionnaire:
    '{"id":"endQuestionnaire","name":"End Questionnaire","expression":[...]}',

  // Evaluate a question answer against an operator and value (branching condition)
  checkAnswer:
    '{"id":"get_answer","name":"Check Answer","expression":[...getQuestionAnswer(${questionId})...]}',

  // Set a scoring variable to a value
  setVariable:
    '{"id":"setVariable","name":"Set Variable","expression":[...setVariable(${variable_name}, ${variable_value})...]}',

  // Free-form custom JS action (returned as a custom_code block)
  customCode:
    '{"id":"custom_code","name":"Custom Code","element_type":"custom_code","value":"..."}',
} as const;
```

Each template is a serialised JSON string that must be passed directly into the `expression` or
`actions` array of an action group without modification.

---

## `DesignerAIChat.vue` — UI Notes

### `toolMeta`

A static map from tool name → `{ icon: string; label: string }` (Lucide icon names). Used to
render human-readable labels and icons in the tool status rows instead of raw camelCase names.

### `groupParts()`

Groups consecutive tool calls of the same type into a single row showing a count badge (e.g.
"Updating question ×5"). Groups are reset by any intervening text part so tool calls after agent
prose start a fresh group. `askUser`, `reasoning`, and `text` parts pass through ungrouped.

### `displayMessages` computed

The Vercel AI SDK emits each agentic step as a separate message object. `displayMessages` merges
consecutive tool-only assistant messages (no meaningful text content) into a single logical message
so `groupParts()` can group tool calls across step boundaries.

### Rollback banner

A `UAlert` with `color="warning"` shown after the agent finishes when `agentChangesCount > 0`.
Displays the change count and an "Undo all changes" button wired to `rollbackAgentChanges()`.
The banner is hidden while streaming or submitted to avoid a flash at step boundaries.

### `askUser` widget

A bordered card rendered for `askUser` tool calls. While `state === "input-available"` and
`pendingChoiceToolCallId` matches, the predefined options are rendered as `UButton` elements.
After selection the chosen option is shown as a `UBadge`. For `askUser` without options, a
free-text fallback message is displayed.

### File attachment

- **Drag-and-drop:** the entire chat panel is a drop target. A translucent overlay appears during
  drag. Dropped files are filtered by type and size before being added to `pendingFiles`.
- **Click upload:** a paperclip button in the prompt footer triggers a hidden `<input type="file">`.
- **Pending strip:** attached files appear as chips above the prompt. Images show a thumbnail;
  PDFs and text files show a file icon and truncated name. Each chip has an × button to remove.
- Accepted types: `image/png`, `image/jpeg`, `image/webp`, `application/pdf`, `text/plain`,
  `application/json`, `text/csv`. Files exceeding 10 MB are silently filtered out.

### Reasoning / thinking

When the model returns a `reasoning` part (Anthropic extended thinking / Google thinking), it is
rendered as a collapsible `<details>` block with a brain icon. The block is open while streaming
and collapsed once complete.

---

## Adding a New Tool

Follow these five steps to extend the agent's capabilities:

### Step 1 — Create a tool module (`app/utils/ai/designer/tools/myNewTool.ts`)

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

### Step 2 — Register in `app/utils/ai/designer/index.ts`

Import and add the tool to both `DESIGNER_TOOLS` (JSON Schema map) and `DESIGNER_TOOL_HANDLERS`.

### Step 3 — Classify as UI-only or mutating (`useAIDesigner.ts`)

If the tool only updates UI state (no payload mutation, no undo needed) add it to `UI_ONLY_TOOLS`:

```ts
const UI_ONLY_TOOLS = new Set([
  "selectQuestion",
  "setPreviewLanguage",
  "openSidepanelTab",
  "openHierarchyView",
  "myNewTool", // ← add here if UI-only
]);
```

Omit this step for mutating tools — the snapshot/counter tracking happens automatically.

### Step 4 — `toolMeta` entry (`DesignerAIChat.vue`)

```ts
const toolMeta = {
  // ...existing entries...
  myNewTool: { icon: "lucide:wand-2", label: "Doing something" },
};
```

Without an entry the tool row falls back to `lucide:wrench` and the raw camelCase name.

### Step 5 — Update the system prompt if needed

If the tool requires contextual information (e.g. a list of available items, IDs, or schema hints)
add it to `buildDesignerSystemPrompt()` in `app/utils/ai/designer/systemPrompt.ts` so the model has the data it needs
to use the tool correctly.
