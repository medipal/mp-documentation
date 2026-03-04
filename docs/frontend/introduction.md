# Introduction

Medipal Frontend is a **Nuxt 4 + Vue 3** single-page application for managing medical questionnaires. It provides:

- A visual **questionnaire designer** — the flagship feature — for building questionnaires with conditional logic, variables, scoring rules, and multi-language content
- Patient and enrollment management
- Folder-based organization with granular permission control
- Multi-tenant architecture served via a generated API client package

## Technology Stack

| Layer             | Technology                           | Version |
| ----------------- | ------------------------------------ | ------- |
| Framework         | Nuxt                                 | 4.3.1   |
| UI runtime        | Vue                                  | ≥3.5    |
| Language          | TypeScript                           | ES2024  |
| Build             | Vite (embedded in Nuxt)              | —       |
| Styling           | Tailwind CSS                         | 4.1.x   |
| Component library | Nuxt UI (Radix-based)                | 4.4.x   |
| State             | Pinia                                | 0.11.x  |
| HTTP              | Axios via `@medipal/mp-frontend-api` | —       |
| i18n              | @nuxtjs/i18n                         | 10.2.x  |
| Monitoring        | Sentry                               | 10.x    |

## Key Concepts

### External API Package

The HTTP client is auto-generated and distributed as `@medipal/mp-frontend-api`. The frontend never writes raw Axios calls — it always calls methods on the `api` object returned by `useApi()`. A companion package `@medipal/mp-nuxt-api-layer` is extended via `nuxt.config.ts`.

### No SSR

The app runs as a client-side SPA for all authenticated routes. The `initialize.client.ts` plugin handles bootstrapping. This simplifies deployment — the build output is a static bundle served by nginx.

### Type Inference from API

Types are not manually declared. They are inferred from the API client's return types:

```typescript
type Questionnaire = Awaited<
  ReturnType<typeof _api.questionnaireDetail>
>["data"];
```

This ensures types automatically stay in sync when the API package is updated.

### Event Bus

`useEventBus` (a Pinia store) uses RxJS `Subject` to decouple login/logout side effects. `app.vue` listens for `userLoggedIn` to bootstrap data fetching.

## Next Steps

- [Setup & Installation](./setup) — get the project running locally
- [Architecture Overview](./architecture) — folder structure, conventions, build config
- [Questionnaire Designer](./questionnaire-designer) — the core feature
