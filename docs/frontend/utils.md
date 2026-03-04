# Utilities

Pure TypeScript utilities in `app/utils/`. Auto-imported by Nuxt — no explicit `import` needed in `.vue` files or stores. No Vue/Nuxt dependencies unless noted.

## `attrs.ts`

### `splitAttrs(attrs)`

Splits `$attrs` into separate `props` (non-function values) and `listeners` (function values). Useful when forwarding attrs to multiple child elements.

```typescript
const { props, listeners } = splitAttrs(attrs);
```

---

## `badgeStyles.ts`

Helpers for computing Nuxt UI badge/button appearance from entity status.

### `getAccessBadgeStyle(status, t)`

Returns `{ color, icon, label }` for permission level strings: `"OWNER"`, `"EDITOR"`, `"VIEWER"`.

### `getRecursiveBadgeStyle(payload, t)`

Returns badge props based on `payload.recursive` (boolean | null). Used in permission tables.

### `getButtonStyle(payload, folders, questionnaires, t)`

Returns `{ label, icon, to }` for a permission record referencing a `folder_id` or `questionnaire_id`. Resolves the entity name from provided arrays and returns a router `to` object for navigation.

---

## `describeConditions.ts`

### `describeCondition(condition)`

Converts a condition triple `[left, operator, right]` into a human-readable English string.

```typescript
describeCondition([{ name: "age" }, { value: "greater_than" }, { value: 18 }]);
// → '"age" is greater than "18"'
```

**Supported operators:** `equals`, `not_equals`, `contains`, `not_contains`, `greater_than`, `less_than`, `is_empty`, `is_not_empty`

---

## `describeSchedule.ts`

### `describeSchedule(schedule)`

Converts a schedule config object into a human-readable English sentence.

```typescript
describeSchedule({
  availability: "restricted",
  startAfterDays: 0,
  endAfterDays: 30,
  repeatable: true,
  repeatConfig: {
    intervalUnit: "week",
    intervalValue: 1,
    weekdays: ["monday"],
  },
});
// → "Scheduled from day 0 to day 30, Repeats every 1 week, on Monday."
```

---

## `designerValidations.ts`

Validates the questionnaire payload and populates a reactive `validationErrors` ref.

### `validationErrors`

`ref<Array<{ question_id, type, code, tab, message }>>` — module-level reactive ref. Reset to `[]` before each validation run.

### `argumentReferenceValidation({ type, questions, question, argument, current_language, $t })`

Validates a single expression argument that references a question or variable. Clears stale references and validates forward references.

### `validateQuestionActions(questionnaire, $t)`

Walks all question action/condition expression blocks and calls `argumentReferenceValidation` on each argument. Called from `useDesignerStore` after mutations.

### `validateQuestionNames(questionnaire, $t)`

Validates that question `name` fields are non-empty and unique within the questionnaire.

### `validateQuestionText(questionnaire, $t)`

Validates that question text fields are non-empty for all configured languages.

---

## `evaluateExpression.ts`

### `evaluateTemplateFromArguments(expression)`

Evaluates an expression's `template` string by replacing `${argName}` placeholders with resolved argument values. Wraps `string` and `reference` type values in quotes.

```typescript
evaluateTemplateFromArguments({
  template: "setVariable(${variable_name}, ${variable_value})",
  arguments: {
    variable_name: { type: "reference", value: "var_id" },
    variable_value: { type: "number", value: 42 },
  },
});
// → 'setVariable("var_id", 42)'
```

---

## `formatAxiosError.ts`

### `formatAxiosError({ error, t })`

Pure function (no Vue dependencies). Extracts a readable error string from an Axios error response. Handles structured API error bodies, network errors, and fallback messages.

Used internally by `useFormatAxiosError()` composable — prefer the composable in components/stores.

---

## `getQuestionText.ts`

### `getQuestionText(question, language)`

Extracts plain text from a question's `payload.translations.question_text`. Handles both array format (takes first item's `.text`) and object format (keyed by language code). Uses a temporary DOM element for HTML-to-text conversion.

```typescript
getQuestionText(question, "fr"); // → plain text string
```

---

## `jsonFormRenderer.ts`

Utilities for the Questionnaire Engine Editor.

### `createAppTemplate({ componentName, type, current_language })`

Returns a complete Vue SFC string as a development template for new question type components. Includes a two-tab layout (Mobile preview + JSON Form configuration).

### `createPayload(type)`

Returns a JSON string of a minimal questionnaire payload containing one question of the specified type.

### `jsonFormRenderer` (export array)

Array of `rankWith` entries mapping JSON Schema / UI schema patterns to custom renderer components. Priority order matters — higher rank wins.

| Renderer              | Trigger Condition                               |
| --------------------- | ----------------------------------------------- |
| `StringRenderer`      | string control, no special format               |
| `TextareaRenderer`    | string control + `format: "textarea"`           |
| `ToggleRenderer`      | boolean control + `format: "toggle"`            |
| `CheckboxRenderer`    | boolean control (default)                       |
| `NumberRenderer`      | number or integer control                       |
| `SelectRenderer`      | enum control, `format: "select"`                |
| `SelectMenuRenderer`  | enum control, `format: "selectMenu"`            |
| `RadioRenderer`       | enum control (default)                          |
| `MultiSelectRenderer` | string + array schema + `format: "multiselect"` |
| `SliderRenderer`      | number/integer + `format: "slider"`             |
| `ArrayRenderer`       | array type schema                               |
| `DateRenderer`        | string + `format: "date"`                       |

---

## `mapTreeElements.ts`

### `mapFoldersToTree({ folderMap, folders, questionnaires })`

Builds a tree structure from flat `folders` and `questionnaires` arrays for use in the `FolderTree` component. Populates `folderMap` (a `Map<id, node>`) as a side effect. Each node has `id`, `label`, `icon`, `children`, `onClick`, `onToggle`.

---

## `scheduleToDates.ts`

### `scheduleToDates(schedule, referenceDate)`

Converts a schedule configuration object into an array of concrete `Date` objects. Handles complex repeat rules: daily/weekly/monthly intervals, specific weekdays, specific month days, times of day, start/end offsets relative to `referenceDate`.

Used in `QuestionnaireScheduler` and scheduling preview pages (~14 KB implementation).

---

## `syncFunctionReferences.ts`

### `buildFunctionTemplate(func)`

Produces an IIFE template string for a custom function:

```typescript
buildFunctionTemplate({
  name: "myFn",
  arguments: [{ name: "x" }],
  code: "return x + 1",
});
// → "(function myFn(x) {\n  return x + 1\n})(${x})"
```

### `syncFunctionReferences(payload)`

Walks the entire questionnaire payload and for each expression block of type `"function"`:

1. Regenerates `template` via `buildFunctionTemplate`
2. Updates `label` from the function definition
3. Merges `arguments`: preserves existing values, adds new args, removes deleted args

::: warning
Must be called whenever `payload.definitions.scoring.functions` is mutated (rename, arg changes, deletion). Failure to call this leaves stale expression blocks in the payload.
:::

---

## `expression_builder/` — Expression Builder Utilities

Pure TypeScript utilities with no Vue dependencies. All hydrate functions share this calling convention:

```typescript
hydrateXxx({ bridge, context, method, $t, ...domainArgs });
```

- `bridge` — object that owns the target method (usually the block editor instance)
- `context` — expression context passed to the method
- `method` — method name on `bridge` to call on selection
- `$t` — i18n translation function

| File                                     | Export                           | Purpose                                                  |
| ---------------------------------------- | -------------------------------- | -------------------------------------------------------- |
| `operators.ts`                           | `hydrateOperators`               | Grouped operator items (arithmetic, comparison, logical) |
| `value_types.ts`                         | `hydrateValueTypes`              | Literal value items (string, number, true, false)        |
| `questions.ts`                           | `hydrateQuestions`               | Question reference items grouped by section              |
| `variables.ts`                           | `hydrateVariableValues`          | Variable value items → `getVariable(id).value`           |
| `variables.ts`                           | `hydrateVariableReferences`      | Variable reference items → raw `id`                      |
| `functions.ts`                           | `hydrateFunctions`               | Custom function items from scoring.functions             |
| `submission_methods.ts`                  | `hydrateSubmissionMethods`       | Built-in methods: `checkAnswer`, `getRawAnswerValue`     |
| `submission_actions.ts`                  | `hydrateSubmissionActions`       | Built-in action: `currentQuestionAnswer`                 |
| `actions/go_to_question_index_action.ts` | `hydrateGoToQuestionIndexAction` | Jump to question by index                                |
| `actions/go_to_question_id_action.ts`    | `hydrateGoToQuestionIdAction`    | Jump to question by ID                                   |
| `actions/next_question_action.ts`        | `hydrateNextQuestionAction`      | Proceed to next question                                 |
| `actions/skip_question_action.ts`        | `hydrateSkipQuestionAction`      | Skip current question                                    |
| `actions/set_variable_action.ts`         | `hydrateSetVariableActions`      | Set variable — one item per defined variable             |
| `actions/end_questionnaire_action.ts`    | `hydrateEndQuestionnaireAction`  | End questionnaire                                        |
| `index.ts`                               | re-exports all of the above      | —                                                        |
