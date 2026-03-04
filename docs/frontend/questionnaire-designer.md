# Questionnaire Designer

The core feature of the application. A visual editor for building questionnaires with conditional logic, variables, scoring, and multi-language support.

**Route:** `/questionnaire/[id]/designer`
**Page:** `app/pages/questionnaire/[id]/designer.vue`
**Root component:** `app/components/Designer/Designer.vue`

## Data Model

A questionnaire `payload` has this structure:

```typescript
{
  sections: Section[]
  definitions: {
    translations?: {
      use_multiple_languages: boolean
      languages: string[]           // ["en", "fr", "de", ...]
      default_language: string
    }
    scoring?: {
      functions: CustomFunction[]
    }
  }
}

type Section = {
  id: string
  title: string | Record<string, string>   // "My Section" or {en: "...", fr: "..."}
  questions: Question[]
}

type Question = {
  id: string
  name: string      // unique identifier used in conditions/expressions
  type: string      // "single_choice" | "multiple_choice" | "text" | "numeric" | etc.
  text: string | Record<string, string>
  actions: {
    on_answer?: ActionGroup[]
    on_enter?: ActionGroup[]
  }
  conditions?: ConditionBlock[]
}

type ActionGroup = {
  condition: ConditionBlock[]
  actions: ActionBlock[]
  else_actions?: ActionBlock[]
}
```

## Component Hierarchy

```
Designer.vue
├── DesignerSidepanel.vue              Left panel — section/question tree + tools
│   └── DesignerHierarchyPanel.vue     Tree overview of all sections/questions
├── [main content area]
│   ├── DesignerSection.vue            Section wrapper
│   │   ├── DesignerSectionHeader.vue
│   │   └── DesignerQuestion.vue       (one per question)
│   │       ├── DesignerQuestionHeader.vue
│   │       ├── DesignerQuestionBody.vue
│   │       ├── DesignerQuestionConditions.vue
│   │       │   └── DesignerQuestionConditionsBlock.vue
│   │       ├── DesignerQuestionConfiguration.vue
│   │       └── DesignerQuestionActions.vue
│   │           ├── DesignerActionsPanel.vue
│   │           │   ├── DesignerActionsTrigger.vue
│   │           │   ├── DesignerActionsCondition.vue
│   │           │   │   └── DesignerActionsConditionAction.vue
│   │           │   └── DesignerActionsConditionActions.vue
│   │           ├── DesignerOnQuestionAnswerAction.vue
│   │           └── DesignerOnQuestionEnterAction.vue
│   └── DesignerAddQuestion.vue
├── DesignerFunctionsPanel.vue         Custom JS functions panel
├── DesignerVariablesPanel.vue         Variable definitions panel
└── DesignerActionEditor.vue           Shared action expression editor
```

## State Management

The designer uses `useDesignerStore` — the largest store (~36 KB). See [State Management](./state-management) for the full API.

The store maintains two copies of the questionnaire:

- `state` — the live edited version
- `originalState` — snapshot at load time, used for dirty-checking (`isChanged`)

**Undo/redo**: Before every mutation, `saveState()` pushes `state` to a history stack. `undo()` pops from history, `redo()` reverses.

### Key Actions

| Action                                                  | Description                                           |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `initializeState(questionnaire)`                        | Load questionnaire into store                         |
| `saveState()`                                           | Push current state to history (call before mutations) |
| `undo()` / `redo()`                                     | Navigate history                                      |
| `addSection()` / `deleteSection()` / `moveSection()`    | Section CRUD                                          |
| `addQuestion()` / `deleteQuestion()` / `moveQuestion()` | Question CRUD                                         |
| `copyQuestion()` / `pasteQuestion()`                    | Clipboard operations                                  |
| `saveQuestionnaire()`                                   | PATCH via questionnaireStore                          |
| `publishQuestionnaire()`                                | Opens PublishQuestionnaireModal                       |

## Block Editor (Expression Builder UI)

`app/components/Designer/BlockEditor/`

A visual block-based expression editor. Expressions are built from typed blocks:

| Block Component                 | Type                                    |
| ------------------------------- | --------------------------------------- |
| `BlockEditorStringBlock.vue`    | String literal                          |
| `BlockEditorNumberBlock.vue`    | Number literal                          |
| `BlockEditorBooleanBlock.vue`   | Boolean literal                         |
| `BlockEditorReferenceBlock.vue` | Reference to question answer / variable |
| `BlockEditorOperatorBlock.vue`  | Comparison / logical operator           |
| `BlockEditorMethodBlock.vue`    | Built-in method call                    |
| `BlockEditorCommandBlock.vue`   | Command / action                        |
| `BlockEditorTernaryBlock.vue`   | Ternary expression                      |

`DesignerBlockEditor.vue` is the container component. `DesignerBlockEditorElement.vue` resolves which block component to render based on `element_type`.

## Expression Builder (Logic Layer)

`app/utils/expression_builder/` — pure TypeScript utilities, no Vue dependencies.

### Operators (`operators.ts`)

`hydrateOperators()` returns grouped operator items for the command panel:

| Category    | Operators                                    |
| ----------- | -------------------------------------------- |
| Arithmetic  | `+`, `-`, `*`, `/`, `%`, `**`                |
| Comparison  | `==`, `!=`, `<`, `>`, `<=`, `>=`, `includes` |
| Type checks | `typeof`                                     |
| Logical     | `&&`, `\|\|`, `!`                            |
| Grouping    | `(`, `)`                                     |

### Action Templates

Available actions in the command panel:

| Template                      | Behavior                   |
| ----------------------------- | -------------------------- |
| `go_to_question_index_action` | Jump to question by index  |
| `go_to_question_id_action`    | Jump to question by ID     |
| `next_question_action`        | Proceed to next question   |
| `skip_question_action`        | Skip current question      |
| `set_variable_action`         | Assign value to a variable |
| `end_questionnaire_action`    | Terminate questionnaire    |

### Command Panel Sources

The `DesignerCommandPanel.vue` palette assembles items from:

1. Built-in operators
2. Question references (answers from other questions)
3. Variable references
4. Built-in methods (`checkAnswer`, `getRawAnswerValue`, `currentQuestionAnswer`)
5. Custom functions (from `payload.scoring.functions`)
6. Action templates

## Custom Functions

Defined in `payload.definitions.scoring.functions`. Managed via `DesignerFunctionsPanel.vue`.

### Function Schema

```json
{
  "name": "myFn",
  "label": "My Function",
  "description": "What this function does",
  "return_type": "number",
  "arguments": [
    { "name": "score", "type": "number" },
    { "name": "multiplier", "type": "number" }
  ],
  "code": "return score * multiplier;"
}
```

### Template Generation

`buildFunctionTemplate(func)` produces an IIFE template:

```typescript
buildFunctionTemplate({
  name: "myFn",
  arguments: [{ name: "x" }],
  code: "return x + 1",
});
// → "(function myFn(x) {\n  return x + 1\n})(${x})"
```

### Reference Sync

When a function is renamed or its arguments change, call `syncFunctionReferences(payload)`. It walks all question action/condition expression blocks and updates:

- `template` — regenerated IIFE template
- `label` — updated display name
- `arguments` — merged (existing values preserved, new args added, removed args dropped)

::: warning
Always call `syncFunctionReferences(payload)` after mutating `payload.definitions.scoring.functions`. Failing to do so leaves stale expression blocks in the payload.
:::

## Multi-Language Support

When `use_multiple_languages === true`:

- Question `text` and section `title` are `Record<string, string>` keyed by language code
- `current_language` in the store determines which language is displayed in the editor
- Language selector in the toolbar switches `current_language`
- Default language: `questionnaire_default_language`

Languages available for selection come from `useProviderStore` (fetched from the backend), separate from the UI language controlled by `@nuxtjs/i18n`.

## Payload Mutation Rules

1. Always call `designerStore.saveState()` **before** any mutation (enables undo)
2. After mutating `payload.definitions.scoring.functions`, call `syncFunctionReferences(payload)`
3. The payload is serialized as-is and sent to the backend — no transformation layer
4. `isChanged` is computed via `lodash.isEqual(state, originalState)` deep comparison

## Validation

`app/utils/designerValidations.ts` runs on the full payload and produces warnings/errors:

- Invalid question name references in conditions and actions
- Forward references (referencing a question that appears later in the flow)
- Empty question names or duplicate names
- Empty question text for configured languages

## Questionnaire Config Pages

Accessed at `/questionnaire/[id]/config`:

| Tab       | Route               | Purpose                              |
| --------- | ------------------- | ------------------------------------ |
| General   | `/config/general`   | Name, description, folder assignment |
| Engine    | `/config/engine`    | Questionnaire engine selection       |
| Languages | `/config/languages` | Multi-language setup                 |
| Legal     | `/config/legal`     | Legal/consent text                   |
| Access    | `/config/access`    | Permission management                |

## Preview & Publish

| Component                       | Purpose                                              |
| ------------------------------- | ---------------------------------------------------- |
| `QuestionnairePreview.vue`      | Embedded live preview using the engine               |
| `PreviewQuestionnaireModal.vue` | Modal wrapper for preview                            |
| `PublishQuestionnaireModal.vue` | Confirms publish, calls `api.questionnairePublish()` |
| `SubmissionPreviewModal.vue`    | Read-only view of a past submission                  |

## Scheduling

`/questionnaire/[id]/scheduling` — schedule-based enrollment triggers.

`EditQuestionnaireScheduleModal` has 4 tabs: General, Planning, Variables, Summary.

`app/utils/scheduleToDates.ts` converts schedule config objects to concrete `Date` arrays.

---

## Expression Builder — Deep Dive

This section documents the full architecture of the expression builder: how it is structured across two repos, how expressions are stored in the payload, how hydration functions build the command palette, how the bridge wires UI selections into reactive mutations, and how expressions are evaluated at runtime.

### 1. Architecture Overview

The system spans three layers:

```
┌─────────────────────────────────────────────────────────┐
│  Hydration Layer  (app/utils/expression_builder/*.ts)   │
│  Pure TS — builds searchable command-palette items from  │
│  questionnaire state. No Vue dependencies.              │
└────────────────────────┬────────────────────────────────┘
                         │ onSelect closures call bridge[method]
┌────────────────────────▼────────────────────────────────┐
│  Bridge Layer  (DesignerQuestionActions.vue)             │
│  Thin mutation adapter — defines addElement, addAction,  │
│  and addArgument. Mutates Vue reactive arrays directly.  │
└────────────────────────┬────────────────────────────────┘
                         │ v-model → designerStore.state
┌────────────────────────▼────────────────────────────────┐
│  Block Editor Layer  (Designer/BlockEditor/)             │
│  Vue UI — renders expression arrays as typed blocks.     │
│  Backed by DesignerBlockEditor.vue +                    │
│  DesignerBlockEditorElement.vue                          │
└────────────────────────┬────────────────────────────────┘
                         │ payload saved to backend as-is
┌────────────────────────▼────────────────────────────────┐
│  Runtime  (mp-questionnaire-core-builder)                │
│  QuestionnaireCore.vue evaluates expressions via         │
│  new Function() with an explicit context object.         │
└─────────────────────────────────────────────────────────┘
```

**Repos involved:**

- `mp-frontend` — designer UI + hydration utilities + bridge
- `mp-questionnaire-core-builder` — runtime evaluation engine

---

### 2. Expression Data Structures

#### Primitive block

The simplest element — stored directly in `condition[]` arrays:

```json
{ "element_type": "operator", "name": "==",    "value": " == " }
{ "element_type": "operator", "name": "&&",    "value": " && " }
{ "element_type": "string",                     "value": "" }
{ "element_type": "number",                     "value": "" }
{ "element_type": "boolean",  "name": "true",  "value": "true" }
{ "element_type": "reference","name": "$score", "value": "getVariable(\"var_1\").value" }
```

Note: operators store surrounding spaces in `value` (e.g. `" == "`, `" && "`) so that the joined JS string is syntactically valid without any post-processing.

#### Function block

Used for submission methods (`checkAnswer`, `getRawAnswerValue`) and custom scoring functions. Has a nested `expression[0]` object that carries the template and argument slots:

```json
{
  "id": "get_answer",
  "name": "Check Answer",
  "element_type": "function",
  "expression": [
    {
      "type": "function",
      "name": "question_id",
      "template": "(() => { const question_answer = \"${questionId}\" === \"this_question\" ? answer : getQuestionAnswer(\"${questionId}\")?.answer; switch (question_answer?.value_type) { case \"string\": return question_answer.value ${operator} ${value}; case \"number\": return question_answer.value ${operator} ${value}; case \"array\": return question_answer.value?.includes(${value}); default: return false; } })()",
      "value": "<evaluated template — updated whenever an argument is filled>",
      "arguments": {
        "questionId": {
          "id": "questionId",
          "type": "action",
          "reference_type": "question",
          "action_collection": "questions",
          "value": "q_abc",
          "name": "question",
          "label": "Age"
        },
        "operator": {
          "id": "operator",
          "type": "action",
          "reference_type": "operator",
          "action_collection": "operators",
          "value": "==",
          "label": "=="
        },
        "value": {
          "id": "value",
          "type": "string",
          "value": "42",
          "label": ""
        }
      }
    }
  ]
}
```

`expression[0].value` always holds the pre-evaluated JS string produced by `evaluateTemplateFromArguments`. The runtime reads this field directly.

#### ActionGroup

Stored in `question.actions.on_answer[]` or `question.actions.on_enter[]`:

```json
{
  "trigger_type": "on_answer",
  "name": "Route by age",
  "description": "",
  "condition": [],
  "actions": [],
  "else_actions": []
}
```

`condition` is a `Block[]` array (primitive + function blocks). `actions` and `else_actions` are `ActionBlock[]` arrays.

#### ActionBlock

Each item inside `actions[]` or `else_actions[]`:

```json
{
  "id": "goToQuestionId",
  "name": "Go to question",
  "element_type": "function",
  "expression": [
    {
      "type": "function",
      "name": "goToQuestionId",
      "template": "goToQuestionId(${questionId})",
      "value": "goToQuestionId(\"q_result\")",
      "arguments": {
        "questionId": {
          "id": "questionId",
          "type": "string",
          "element_type": "action",
          "reference_type": "question",
          "action_collection": "questions",
          "value": "q_result",
          "name": "question",
          "label": "Result Question"
        }
      }
    }
  ]
}
```

Action blocks with no arguments (e.g. `nextQuestion`, `skipQuestion`, `endQuestionnaire`) still carry `expression[0].value` as a ready-to-evaluate string — no argument interpolation needed.

---

### 3. Hydration Functions

**Pattern:** Each hydration function takes configuration including a `bridge` object, a `context` reference, and a `method` name string. It returns an array of command-panel items where each item has an `onSelect` closure that calls `bridge[method](context, element)`.

`context` is always the **live reactive array** that the new element should be inserted into (or `{ item, arg }` for argument-level mutations). Because Vue's reactivity system tracks mutations to the same object reference, there is no need to emit events or reassign arrays — mutating `context` directly propagates changes through all `v-model` bindings up to `designerStore.state`.

| Function                        | File                                  | Reads from          | Inserts `element_type`                                                                                                 |
| ------------------------------- | ------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `hydrateOperators`              | `operators.ts`                        | —                   | `operator` for all basic operators; `function` for `includes` (which is a method call)                                 |
| `hydrateValueTypes`             | `value_types.ts`                      | —                   | `string`, `number`, `boolean`                                                                                          |
| `hydrateVariableValues`         | `variables.ts`                        | `scoring.variables` | `reference` with `value: getVariable("id").value`                                                                      |
| `hydrateVariableReferences`     | `variables.ts`                        | `scoring.variables` | `reference` with `value: variableId` (the raw ID, no accessor)                                                         |
| `hydrateSubmissionMethods`      | `submission_methods.ts`               | —                   | `function` — `checkAnswer` IIFE or `getRawAnswerValue` IIFE                                                            |
| `hydrateSubmissionActions`      | `submission_actions.ts`               | —                   | `function` — `answer` (current question answer shorthand)                                                              |
| `hydrateFunctions`              | `functions.ts`                        | `scoring.functions` | `function` — custom IIFE built via `buildFunctionTemplate`                                                             |
| `hydrateQuestions`              | `questions.ts`                        | `payload.sections`  | Called in argument selection only — `onSelect` receives the question object and callers mutate argument slots directly |
| `hydrateGoToQuestionIdAction`   | `actions/go_to_question_id_action.ts` | —                   | `function` action: `goToQuestionId(${questionId})`                                                                     |
| `hydrateSkipQuestionAction`     | `actions/skip_question_action.ts`     | —                   | `function` action: `skipQuestion()` (no arguments)                                                                     |
| `hydrateNextQuestionAction`     | `actions/next_question_action.ts`     | —                   | `function` action: `nextQuestion()` (no arguments)                                                                     |
| `hydrateEndQuestionnaireAction` | `actions/end_questionnaire_action.ts` | —                   | `function` action: `endQuestionnaire()` (no arguments)                                                                 |
| `hydrateSetVariableActions`     | `actions/set_variable_action.ts`      | `scoring.variables` | `function` action: `setVariable(${variable_name}, ${variable_value})` — one menu item per variable                     |

**`hydrateVariableValues` vs `hydrateVariableReferences`:**

- `hydrateVariableValues` — inserts a `reference` block whose `value` is `getVariable("id").value`. Used in condition expressions where you want to read the variable's current value.
- `hydrateVariableReferences` — inserts a `reference` block whose `value` is just the variable's ID string. Used to fill the `variable_name` argument of `setVariable`, where the runtime needs the raw ID to look up which variable to assign.

---

### 4. The Bridge Pattern

`DesignerQuestionActions.vue` defines a single `bridge` object with three methods. The bridge is passed as a prop down to `DesignerOnQuestionAnswerAction` and `DesignerOnQuestionEnterAction`, which in turn forward it to all hydration calls.

```typescript
const bridge = {
  // Inserts element into context[] at index, or appends if index is null.
  // Used for condition expression blocks.
  addElement: ({ context, index }, element) => {
    if (typeof index === "number") {
      context.splice(index, 0, element);
    } else {
      context.push(element);
    }
  },

  // Appends element to context[].
  // Used when adding a new ActionBlock to actions[] or else_actions[].
  addAction: (context, element) => {
    context.push(element);
  },

  // Mutates a specific argument slot inside a function block.
  // Used when picking a question/operator/variable to fill an argument.
  addArgument: ({ item, arg }, { value, name, element_type }) => {
    item.expression[0].arguments[arg.id].value = value;
    item.expression[0].arguments[arg.id].label = name;
  },
};
```

All three methods mutate Vue reactive arrays or objects **in place** — no events are emitted upward. Reactivity propagates via the `v-model` bindings through `DesignerActionsCondition` → `DesignerActionsTrigger` → `DesignerOnQuestion*Action` → `DesignerQuestionActions` → `DesignerQuestion` → `designerStore.state`.

---

### 5. Action Triggers — How Command Groups Are Composed

`DesignerActionsTrigger.vue` accepts a `commandGroups` prop. This prop is an object (not an array) with three keys that are called at different points in the UI:

```typescript
// Shape of commandGroups prop consumed by DesignerActionsTrigger
{
  // Called when opening the condition block editor palette.
  // Returns an object with named sub-palettes keyed by argument collection name.
  condition_groups: (context: Block[]) => {
    root: CommandGroup[],       // top-level condition palette
    actions: GlobalActionsFn,   // argument-level sub-palettes for function blocks
  },

  // Called when opening the "Add action" popover.
  // Returns a flat CommandGroup[] for the action picker.
  action_groups: (context: ActionBlock[]) => CommandGroup[],

  // Called when a function block's argument slot is clicked.
  // Keys map to the action block's id (e.g. "goToQuestionId", "setVariable").
  argument_actions: {
    [actionId: string]: (context: ActionBlock, argument?: Argument) => SubPaletteMap
  }
}
```

#### `on_enter` vs `on_answer`

Both triggers share identical `condition_groups` (same five command categories). They differ in their `action_groups`:

|                                 | `on_enter`                                               | `on_answer`                                                                                                   |
| ------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Available navigation actions    | `goToQuestionId`, **`skipQuestion`**, `endQuestionnaire` | `goToQuestionId`, **`nextQuestion`**, `endQuestionnaire`                                                      |
| `setVariable`                   | Yes                                                      | Yes                                                                                                           |
| "This Question Answer" shortcut | No (no current answer yet)                               | Yes — `get_answer` argument palette exposes a "This Question" option that sets `questionId = "this_question"` |

#### Condition command categories

Both trigger types assemble `conditionCommands` as the same five groups:

```typescript
[
  { id: "questionnaire_submission", items: hydrateSubmissionMethods(...) },
  { id: "variables",                items: hydrateVariableValues(...) },
  { id: "functions",                items: hydrateFunctions(...) },
  { id: "value types",              items: hydrateValueTypes(...) },
  { id: "operators",                items: hydrateOperators(...) },
]
```

#### `globalActions` — argument-level sub-palettes

`globalActions` is a factory function `({ item, onCallback }) => SubPaletteMap`. It is passed as the `actions` property of `condition_groups`. `DesignerBlockEditorElement` calls it when a function block's argument chip is clicked.

Two argument collections are handled:

- **`get_answer`** — called when the `checkAnswer` function's arguments are edited. Returns:
  - `questions` key: question picker (includes "This Question Answer" shortcut in `on_answer`)
  - `operators` key: comparison operators subset

- **`custom_function`** — called for custom scoring function arguments. Returns a variables list (the argument value is filled with `getVariable("id").value`).

After selection, both call `evaluateTemplateFromArguments(item.expression[0])` and write the result back to `item.value` to keep `expression[0].value` in sync.

#### `argument_actions` — action-level sub-palettes

These are called when an argument chip inside an **action block** (not a condition function block) is clicked:

- **`goToQuestionId(context, argument)`** — returns a `{ questions: [...] }` sub-palette that, on selection, mutates `context.expression[0].arguments[argument.id].value` and `.label` with the selected question's ID and name.

- **`setVariable(context, argument)`** — returns a richer sub-palette keyed by the argument's `action_collection`:
  - `root` — full expression palette (submission methods, variable values, functions, operators, value types) for filling the variable's new value expression
  - `variable_references` — variable reference picker for choosing which variable to assign to (mutates the `variable_name` argument slot directly)
  - `actions` — `globalActions` for nested function argument editing

---

### 6. Template Evaluation in the Designer (`evaluateTemplateFromArguments`)

**File:** `app/utils/evaluateExpression.ts`

```typescript
export function evaluateTemplateFromArguments(expression: any): string {
  return expression.template.replace(/\$\{(\w+)\}/g, (_, key) => {
    const arg = expression.arguments[key];
    const val = arg.value;
    const type = arg.type;
    return ["string", "reference"].includes(type) ? `"${val}"` : (val ?? "");
  });
}
```

Called immediately after any argument slot is filled. Replaces every `${key}` placeholder in `expression.template` with the corresponding argument value:

- Arguments with `type: "string"` or `type: "reference"` → wrapped in double quotes
- All other types (`"number"`, `"action"`, raw JS expressions) → inserted as-is

The result is written to `expression[0].value`, which becomes the JS string the runtime evaluates.

**Example — `goToQuestionId`:**

```
template:  "goToQuestionId(${questionId})"
arguments.questionId.type  = "string"
arguments.questionId.value = "q_result"

→ value: 'goToQuestionId("q_result")'
```

**Example — `checkAnswer` (partial fill):**

```
template:  "(() => { ... \"${questionId}\" ... ${operator} ... ${value} ... })()"
arguments.questionId.type  = "action"   → no quotes
arguments.questionId.value = "q_abc"
arguments.operator.type    = "action"   → no quotes
arguments.operator.value   = "=="
arguments.value.type       = "string"   → wrapped in quotes
arguments.value.value      = "42"

→ value: '(() => { ... "q_abc" ... == ... "42" ... })()'
```

The `checkAnswer` template is a self-executing function that branches on `question_answer.value_type` (`"string"`, `"number"`, `"array"`) so that the same template handles all answer shapes without needing separate blocks.

---

### 7. Runtime Evaluation in Core Builder (`evaluateExpression`)

**File:** `mp-questionnaire-core-builder/src/QuestionnaireCore.vue` (lines 90–116, 230–276)

#### Expression serialization

At runtime, a `condition[]` or `expression[]` array is serialized to a single JS string by joining all elements' `value` fields:

```typescript
const expression = Array.isArray(formula)
  ? formula.map((el: any) => el.value).join("")
  : typeof formula === "string"
    ? formula
    : "";
```

This is why:

- Primitive blocks store pre-spaced values (`" == "`, `" && "`, `" ( "`, `" ) "`) — the join produces valid JS without extra processing
- Function blocks store their evaluated template in `expression[0].value` — the nested object structure is only for the designer UI; the runtime only sees the flat `.value` string

#### Execution sandbox

The joined string is executed via `new Function`:

```typescript
const wrapExpression = (expr: string) => {
  const trimmed = expr.trim();
  if (/^(const|let|var|function|\{)/.test(trimmed)) return expr;
  return `return (${expr})`;
};

const fn = new Function(...Object.keys(context), wrapExpression(expression));
const result = fn(...Object.values(context));
```

Non-block expressions are wrapped in `return (...)` so they produce a value. Block-statement expressions (starting with `const`, `let`, `var`, `function`, or `{`) are passed through unchanged.

The expression has access **only** to the explicitly injected context keys — no globals leak in.

#### Trigger context

Both `on_enter` and `on_answer` evaluations receive a context built from `{ ...trigger, ...methods }`:

**From the trigger payload:**
| Key | Description |
|---|---|
| `trigger_id` | `"on_answer"` or `"on_enter"` |
| `question` | The current question object |
| `answer` | The submitted answer object (present for `on_answer`) |

**From `methods`:**
| Key | Signature | Description |
|---|---|---|
| `goToQuestionIndex` | `(index: number)` | Navigate by zero-based index |
| `goToQuestionId` | `(id: string)` | Navigate by question ID |
| `nextQuestion` | `()` | Advance to next question (submits if last) |
| `skipQuestion` | `()` | Skip current question (submits if last) |
| `previousQuestion` | `()` | Go back one step |
| `getQuestionAnswer` | `(id: string) → { question, answer, errors, meta }` | Read any submitted answer |
| `getVariable` | `(id: string) → { value, ... }` | Read a scoring variable |
| `setVariable` | `(id: string, value: any)` | Write a scoring variable |
| `endQuestionnaire` | `()` | Finalize and submit |

#### `handleTrigger` flow

```
handleTrigger(trigger)
  ├─ Look up trigger.question.actions[trigger.trigger_id]
  │
  ├─ If no ActionGroups and trigger_id === "on_answer"
  │     → store.nextQuestion()   (default advance)
  │
  └─ For each ActionGroup:
       ├─ Evaluate condition[] in context
       │   └─ Empty condition[] → always true
       │
       ├─ If truthy:
       │     For each item in actions[]:
       │       evaluateExpression(item.expression, context)
       │
       └─ If falsy:
             For each item in else_actions[]:
               evaluateExpression(item.expression, context)
```

After processing all ActionGroups, a `"trigger"` event is emitted with the full trigger payload.

---

### 8. Complete End-to-End Data Flow

Walkthrough: designer builds a "Check Answer → Go to question" rule.

**Step 1 — Designer opens the `on_answer` trigger panel.**

`DesignerOnQuestionAnswerAction` is rendered. It defines `onAnswerActions` — an object with `condition_groups`, `action_groups`, and `argument_actions` — and passes it as `:command-groups` to `DesignerActionsTrigger`.

**Step 2 — Designer clicks "Add Actions Group".**

`DesignerActionsTrigger.onAddCondition()` pushes a new ActionGroup skeleton into `payload.value` (which is `question.actions.on_answer`):

```json
{
  "trigger_type": "on_answer",
  "name": "Actions Group",
  "condition": [],
  "actions": [],
  "else_actions": []
}
```

**Step 3 — Designer opens the condition block editor and selects "Check Answer".**

`DesignerActionsCondition` renders `DesignerBlockEditor` bound to `data.condition`. When the command palette opens, `commandGroups.condition_groups(data.condition)` is called — this returns `{ root: conditionCommands(context), actions: globalActions }`.

The user selects "Check Answer" from the `questionnaire_submission` group. `hydrateSubmissionMethods` built this item with:

```typescript
onSelect: () => {
  bridge.addElement(context, { id: "get_answer", element_type: "function", expression: [{ template: "...", value: "...", arguments: { questionId: {...}, operator: {...}, value: {...} } }] });
}
```

`bridge.addElement({ context: data.condition, index: null }, element)` pushes the function block into `data.condition[]`. Vue reactivity updates the block editor UI immediately.

**Step 4 — Designer fills the `questionId` argument.**

The block editor renders the `get_answer` function block. The user clicks the `questionId` argument chip. `DesignerBlockEditorElement` calls `globalActions({ item, onCallback }).get_answer(arg)` which returns:

```
{ questions: [ ...question list... ], operators: [ ...comparison operators... ] }
```

A sub-palette opens. The user selects "Age" question (`id: "q_abc"`). The `onSelect` closure runs:

```typescript
item.expression[0].arguments["questionId"].label = "Age";
item.expression[0].arguments["questionId"].value = "q_abc";
item.value = evaluateTemplateFromArguments(item.expression[0]);
```

`evaluateTemplateFromArguments` replaces `${questionId}` with `"q_abc"` (quoted because `type: "action"` — wait, actually `type: "action"` is not in `["string", "reference"]` so it inserts the raw value `q_abc`). The designer then fills `operator` via the operators sub-palette and `value` as a string literal.

**Step 5 — Designer adds a "Go to question" action.**

The user clicks "Add action" button. `commandGroups.action_groups(data.actions)` is called which returns the questionnaire core action groups. The user selects "Go to question". `hydrateGoToQuestionIdAction` built this item with `bridge.addAction(context, element)` — it pushes the `goToQuestionId` function block into `data.actions[]`.

**Step 6 — Designer fills the `questionId` argument of the action.**

`DesignerActionsConditionActions` renders the action block. The user clicks the `questionId` argument chip. The `argument_actions.goToQuestionId(context, argument)` function is called. The user selects "Result Question" (`id: "q_result"`). The closure mutates:

```typescript
context.expression[0].arguments[argument.id].value = "q_result";
context.expression[0].arguments[argument.id].label = "Result Question";
```

Note: `evaluateTemplateFromArguments` is **not** called automatically here — the `goToQuestionId` action handler mutates the argument directly. The `value` field on `expression[0]` started as `"goToQuestionId(${questionId})"` and would need a template re-evaluation to become `'goToQuestionId("q_result")'`. (This is a known limitation — the argument_actions handlers for top-level actions do not call `evaluateTemplateFromArguments` unlike `globalActions` handlers for condition function blocks.)

**Step 7 — Payload is saved.**

`designerStore.saveQuestionnaire()` PATCHes the payload to the backend. The questionnaire `payload.sections[*].questions[*].actions.on_answer` now contains:

```json
[{
  "trigger_type": "on_answer",
  "name": "Actions Group",
  "condition": [{
    "id": "get_answer",
    "element_type": "function",
    "expression": [{ "type": "function", "value": "(() => { ... })()", "arguments": { ... } }]
  }],
  "actions": [{
    "id": "goToQuestionId",
    "element_type": "function",
    "expression": [{ "type": "function", "value": "goToQuestionId(${questionId})", "arguments": { "questionId": { "value": "q_result", "label": "Result Question", ... } } }]
  }],
  "else_actions": []
}]
```

**Step 8 — Runtime evaluation.**

When the user submits an answer in `QuestionnaireCore.vue`, `QuestionnairePage` emits `trigger` with `{ trigger_id: "on_answer", question, answer }`.

`handleTrigger` looks up `question.actions.on_answer`, finds the ActionGroup, and calls:

```typescript
evaluateExpression(action.condition, { trigger_id, question, answer, goToQuestionId, ... })
```

`action.condition[0].value` is the serialized `checkAnswer` IIFE string. `evaluateExpression` joins all `.value` fields (only one element here), wraps in `return (...)`, and executes via `new Function`. The result is truthy/falsy.

If truthy, `evaluateExpression(action.actions[0].expression, context)` is called. `action.actions[0].expression[0].value` is `'goToQuestionId("q_result")'` (assuming the template was evaluated). This executes `goToQuestionId("q_result")` which calls `store.goToQuestionId("q_result")`, navigating the questionnaire to the result question.

---

### 9. Files Reference

| File                                                                                                 | Role                                                                 |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `app/utils/expression_builder/*.ts`                                                                  | Hydration functions — command palette building                       |
| `app/utils/expression_builder/actions/*.ts`                                                          | Action-specific hydration functions                                  |
| `app/utils/evaluateExpression.ts`                                                                    | `evaluateTemplateFromArguments` — template evaluation at design time |
| `app/components/Designer/DesignerActions/DesignerQuestionActions.vue`                                | Bridge definition (`addElement`, `addAction`, `addArgument`)         |
| `app/components/Designer/DesignerActions/DesignerQuestionActions/DesignerOnQuestionAnswerAction.vue` | `on_answer` command groups                                           |
| `app/components/Designer/DesignerActions/DesignerQuestionActions/DesignerOnQuestionEnterAction.vue`  | `on_enter` command groups                                            |
| `app/components/Designer/DesignerActions/DesignerActionsTrigger.vue`                                 | Trigger wrapper + ActionGroup CRUD                                   |
| `app/components/Designer/DesignerActions/DesignerActionsCondition.vue`                               | Condition block editor + if/else action lists                        |
| `app/components/Designer/BlockEditor/DesignerBlockEditor.vue`                                        | Expression array block editor                                        |
| `app/components/Designer/BlockEditor/DesignerBlockEditorElement.vue`                                 | `element_type` → block component mapping                             |
| `mp-questionnaire-core-builder/src/QuestionnaireCore.vue`                                            | Runtime: `evaluateExpression` + `handleTrigger`                      |
| `mp-questionnaire-core-builder/src/utils/QuestionnaireStore.ts`                                      | Runtime: navigation, variables, scoring                              |
