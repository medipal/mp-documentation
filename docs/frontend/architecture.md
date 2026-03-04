# Architecture Overview

## Repository Layout

```
/
├── app/                         Nuxt app directory (Nuxt 4 convention)
│   ├── app.vue                  Root component — listens for auth events
│   ├── app.config.ts            Nuxt UI theme overrides
│   ├── api.config.ts            API client factory + method map
│   ├── assets/css/main.css      Global CSS
│   ├── components/              Vue SFCs (PascalCase)
│   ├── composables/             Auto-imported composables (use* prefix)
│   ├── config/                  Static JSON config (sidepanel menu, etc.)
│   ├── layouts/
│   │   ├── default.vue          Shell: Sidepanel + NaviBar + PageHeader + slot
│   │   └── empty.vue            Bare background — used for auth pages
│   ├── middleware/
│   │   └── auth.global.ts       Runs on every navigation
│   ├── pages/                   File-based routes
│   ├── plugins/
│   │   ├── initialize.client.ts Bootstrap (config fetch, token refresh)
│   │   └── i18n.client.ts       Locale hydration from localStorage
│   ├── stores/                  Pinia stores (useXxxStore pattern)
│   └── utils/                   Pure utility functions
│       └── expression_builder/  Domain DSL for questionnaire logic
├── server/                      Nuxt server routes (minimal — proxy pattern)
├── types/                       Shared TypeScript types (inferred from API)
├── i18n/
│   ├── locales/                 JSON translation files (~130 KB each)
│   └── i18n.config.ts
├── public/                      Static assets
├── nginx/                       Nginx config for Docker deployment
├── nuxt.config.ts
├── package.json
├── tsconfig.json
└── eslint.config.js
```

## Nuxt 4 `app/` Directory

All application code lives under `app/`. This is the Nuxt 4 convention — `components/`, `pages/`, `stores/`, etc. are all scoped within `app/`. The `~` and `@` path aliases both resolve to `app/`.

## Layers

The project extends `@medipal/mp-nuxt-api-layer` via `nuxt.config.ts extends`. This layer provides:

- `useApi()` composable that returns the typed API client
- API client instantiation logic

## Conventions

### File Naming

| Type         | Convention                           | Example               |
| ------------ | ------------------------------------ | --------------------- |
| Vue SFCs     | PascalCase                           | `DesignerSection.vue` |
| Composables  | camelCase, `use` prefix              | `useAuth.ts`          |
| Pinia stores | camelCase, exported as `useXxxStore` | `useDesignerStore`    |
| Utilities    | camelCase                            | `formatAxiosError.ts` |
| Types        | camelCase                            | `questionnaire.ts`    |

### Auto-Imports

Nuxt auto-imports:

- All composables from `app/composables/`
- All stores from `app/stores/`
- All utilities from `app/utils/`
- All Vue/Nuxt/Pinia APIs

No explicit `import` statements needed for these in `.vue` files or stores.

### Props Destructuring

`vue.propsDestructure: false` in `nuxt.config.ts`. Always access props as `props.xxx`, not destructured.

### ESLint Overrides

```
@typescript-eslint/no-explicit-any           OFF  (expression builder uses any heavily)
vue/no-mutating-props                        OFF  (used intentionally in some components)
@typescript-eslint/no-dynamic-delete         OFF
vue/no-side-effects-in-computed-properties   WARN
```

### Tailwind CSS

Class-based utility styling. Custom component variants defined in `app.config.ts` via `defineAppConfig`. Theme: `primary: "blue"`, `neutral: "zinc"`.

## Build Configuration

### Vite Chunk Splitting

Heavy dependencies are split into named chunks to improve initial load performance:

| Chunk       | Packages                     |
| ----------- | ---------------------------- |
| `tiptap`    | `@tiptap/*`, `prosemirror-*` |
| `jsonforms` | `@jsonforms/*`               |
| `gsap`      | `gsap`                       |
| `table`     | `@tanstack/*`                |

### Console Stripping

`console.*` and `debugger` statements are dropped by esbuild in all non-development builds.

### Experimental Features

```typescript
experimental: {
  restoreState: true,  // Restore page state on back navigation
}
```

## Architectural Decisions

### Why No SSR?

All authenticated routes run as a client-side SPA. Reasons:

- The `initialize.client.ts` plugin handles bootstrap (token refresh, config fetch)
- Server routes (`server/api/`) are not used for main features
- Simpler deployment: the output is a static bundle served by nginx

### Type Inference from API

Types are derived from the API client rather than manually declared:

```typescript
// types/questionnaire.ts
const { api: _api } = useApi();

export type Questionnaire = Awaited<
  ReturnType<typeof _api.questionnaireDetail>
>["data"];
```

This ensures types stay in sync automatically when `@medipal/mp-frontend-api` is updated.

### Event Bus for Decoupling

`useEventBus` (RxJS `Subject`) decouples login/logout side effects from the code that triggers them. This avoids circular dependencies between stores.
