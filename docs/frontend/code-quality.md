# Code Quality & Tooling

This page documents the linting, formatting, and build quality standards enforced in the mp-frontend codebase.

## ESLint Configuration

The project uses **ESLint 9** with Nuxt's generated flat config. The configuration file is `eslint.config.js` at the project root.

### Base Setup

```javascript
// eslint.config.js
import withNuxt from "./.nuxt/eslint.config.mjs";
import notice from "eslint-plugin-notice";

export default withNuxt(/* rules */);
```

ESLint covers all source files:

| Scope            | Glob                   |
| ---------------- | ---------------------- |
| App code         | `app/**/*.{ts,vue,js}` |
| Server routes    | `server/**/*.ts`       |
| Type definitions | `types/**/*.ts`        |
| i18n config      | `i18n/**/*.ts`         |

### Rule Overrides

Several rules are intentionally disabled or relaxed. Each override has a documented reason:

| Rule                                         | Level | Reason                                                                             |
| -------------------------------------------- | ----- | ---------------------------------------------------------------------------------- |
| `@typescript-eslint/no-explicit-any`         | OFF   | The expression builder DSL uses `any` extensively for dynamic schema evaluation    |
| `vue/no-mutating-props`                      | OFF   | Some components intentionally mutate props for two-way binding patterns            |
| `@typescript-eslint/no-dynamic-delete`       | OFF   | Dynamic property deletion is used in form/config management                        |
| `no-delete-var`                              | OFF   | Allows variable deletion in specific cleanup scenarios                             |
| `vue/no-side-effects-in-computed-properties` | WARN  | Warns but does not block — some computed properties trigger side effects by design |
| `vue/no-multiple-template-root`              | OFF   | Multiple root elements are valid in Vue 3                                          |
| `vue/multi-word-component-names`             | OFF   | Single-word component names are allowed (e.g., partial components)                 |

::: warning
Do not re-enable `@typescript-eslint/no-explicit-any` without first refactoring the expression builder (`app/utils/expression_builder/`). The DSL relies on dynamic typing that cannot be easily narrowed.
:::

### Copyright Notice Plugin

The `eslint-plugin-notice` is configured but currently turned **off**. When enabled, it enforces a `Copyright (c)` header at the top of every source file.

---

## Formatting

### Prettier

The project uses **Prettier 3.8** with a minimal configuration:

```json
{
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

All Prettier defaults apply:

| Setting                | Value                      |
| ---------------------- | -------------------------- |
| Print width            | 80                         |
| Tab width              | 2 (spaces)                 |
| Semicolons             | Yes                        |
| Quotes                 | Double                     |
| Trailing commas        | `all` (Prettier 3 default) |
| Tailwind class sorting | Automatic via plugin       |

### Lint-Staged

Pre-commit hooks (via **Husky**) run lint-staged on every commit:

```json
{
  "*.{js,ts,vue,json,css,md,yaml,yml}": "prettier --write",
  "*.{js,ts,vue}": "eslint --fix"
}
```

::: tip
Formatting is enforced automatically. You should never need to run `npm run format` manually unless fixing a large batch of files.
:::

### Available Scripts

```bash
npm run lint          # Check for linting errors
npm run lint:fix      # Auto-fix linting errors
npm run format        # Format all files with Prettier
npm run check-types   # Run TypeScript type checking (tsc --noEmit)
```

---

## CSS Rules

### Tailwind v4

The project uses **Tailwind CSS v4** with the CSS-first configuration approach. Styles are imported in `app/assets/css/main.css`:

```css
@import "tailwindcss";
@plugin "@tailwindcss/typography";
@import "@nuxt/ui";
```

### Do Not Use `theme()`

::: danger
Never use the `theme()` function in CSS. Tailwind v4 does not support `theme()` in the same way as v3. Use raw CSS values instead.
:::

```css
/* WRONG */
.my-element {
  color: theme("colors.blue.500");
  border: 1px solid theme("colors.neutral.200");
}

/* CORRECT */
.my-element {
  color: #3b82f6;
  border: 1px solid #e4e4e7;
}
```

### Custom Theme Variables

Custom design tokens are defined in the `@theme` block inside `main.css`:

```css
@theme {
  --inset-shadow-innerLeft: inset 6px 0 6px -4px rgba(0, 0, 0, 0.06);
  --shadow-outline: 0 2px 0 0 var(--color-primary-500);
  --drop-shadow-glow: 0 4px 12px rgba(79, 70, 229, 0.35);
}
```

### Component Variants

UI component theme overrides are defined in `app/app.config.ts` via `defineAppConfig()`. The primary color is `blue` and the neutral palette is `zinc`.

---

## Console & Debugger

### Production Stripping

In all non-development builds, **esbuild** strips `console.*` and `debugger` statements automatically:

```typescript
// nuxt.config.ts → vite.esbuild
esbuild: {
  drop: isNotDevelopment ? ["console", "debugger"] : [],
}
```

::: info
The `isNotDevelopment` check is based on the Git branch name. Only the `development` branch retains console output.
:::

### Guidelines

- **Development**: Use `console.log` / `console.warn` freely for debugging — they will be stripped in production
- **Never** rely on console output for application logic
- **Never** commit `debugger` statements — even though they are stripped, they indicate unfinished code
- For user-facing error messages, use the toast system (`useToast()`) instead of console

---

## Auto-Imports

Nuxt auto-imports modules from specific directories. No explicit `import` statements are needed for these in `.vue` files, stores, or other auto-imported modules.

### What Is Auto-Imported

| Source             | Examples                                             |
| ------------------ | ---------------------------------------------------- |
| `app/composables/` | `useAuth()`, `useFormatAxiosError()`, `useOverlay()` |
| `app/stores/`      | `useQuestionnaireStore()`, `useUserStore()`          |
| `app/utils/`       | `formatAxiosError()`, expression builder functions   |
| Vue APIs           | `ref`, `computed`, `watch`, `onMounted`              |
| Nuxt APIs          | `navigateTo`, `useRuntimeConfig`, `definePageMeta`   |
| Pinia APIs         | `defineStore`, `storeToRefs`                         |
| VueUse             | `createSharedComposable` and other utilities         |

### When Explicit Imports Are Needed

- **Type-only imports**: `import type { Questionnaire } from "~/types/questionnaire"`
- **Third-party libraries**: `import { marked } from "marked"`, `import { z } from "zod"`
- **Nuxt UI components**: Components are auto-imported, but types may need explicit import
- **Cross-layer imports**: Types from `@medipal/mp-frontend-api`

::: tip
If TypeScript reports an unresolved module, check `app/composables/`, `app/utils/`, and `app/stores/` first — the function might already exist and be auto-imported.
:::

---

## Build Quality

### Chunk Splitting

Heavy dependencies are split into named chunks to reduce initial bundle size and enable better caching:

| Chunk       | Packages                     | Rationale                                             |
| ----------- | ---------------------------- | ----------------------------------------------------- |
| `tiptap`    | `@tiptap/*`, `prosemirror-*` | Rich text editor — only loaded on designer pages      |
| `jsonforms` | `@jsonforms/*`               | Form rendering — only loaded when forms are displayed |
| `gsap`      | `gsap`                       | Animation library — deferred loading                  |
| `table`     | `@tanstack/*`                | Table virtualizer — loaded on list pages              |
| `rete`      | `rete`, `elkjs`              | Workflow graph editor — admin-only feature            |

### Tree Shaking

- Nuxt's build pipeline automatically tree-shakes unused code
- Feature-flag-gated code (`useRuntimeConfig().public.FEATURE_*`) should be behind dynamic imports where possible to enable tree shaking

### Bundle Size Awareness

- Monitor chunk sizes when adding new dependencies
- Prefer lightweight alternatives (e.g., `date-fns` over `moment`)
- Use dynamic `import()` for heavy libraries only needed on specific routes

---

## Code Review Checklist

Use this checklist when reviewing pull requests:

### Correctness

- [ ] Does the code do what the PR description says?
- [ ] Are edge cases handled (empty arrays, null values, missing data)?
- [ ] Are scope checks in place before API calls (`scopeStore.hasScope()`)?

### Type Safety

- [ ] No new `any` types introduced (unless in expression builder)
- [ ] Types inferred from API where possible (see [TypeScript Conventions](./typescript-conventions))
- [ ] Props and emits are properly typed

### Patterns

- [ ] Follows store/composable/component patterns (see [Coding Standards](./coding-standards))
- [ ] Modal pattern: `emit("close")`, not `props.onClose()`
- [ ] Error handling with `formatAxiosError()` and toast notifications
- [ ] i18n: all user-facing strings use `t()`, no hardcoded text

### Quality

- [ ] No `console.log` left for debugging purposes (stripped in prod, but clutters code)
- [ ] No commented-out code
- [ ] No unused imports or variables
- [ ] CSS follows Tailwind v4 rules (no `theme()`)

### Accessibility

- [ ] Icon-only buttons have `aria-label`
- [ ] Decorative icons have `aria-hidden="true"`
- [ ] Interactive elements are keyboard-accessible
