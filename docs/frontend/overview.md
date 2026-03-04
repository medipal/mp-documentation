# Architecture Overview

## System Context

The Medipal frontend is a **Nuxt 4 SPA** that communicates with a REST backend, authenticates via Azure AD, and embeds questionnaire engines from a CDN. All data flows through a typed API client backed by Pinia stores.

```
┌──────────────────────────────────────────┐
│           Browser (mp-frontend)          │
│                                          │
│  ┌─────────────┐     ┌────────────────┐  │
│  │    Pages    │────▶│  Components    │  │
│  │  app/pages/ │     │app/components/ │  │
│  └─────────────┘     └───────┬────────┘  │
│                               │           │
│                      ┌────────▼───────┐   │
│                      │  Pinia Stores  │   │
│                      │  app/stores/   │   │
│                      └────────┬───────┘   │
│                               │           │
│                      ┌────────▼───────┐   │
│                      │   API Client   │   │
│                      │ useApi →       │   │
│                      │mp-frontend-api │   │
│                      └────────────────┘   │
└──────────────────────────────────────────┘
        │                        │
  HTTP + Bearer token       OAuth redirect
        │                        │
        ▼                        ▼
 ┌─────────────┐          ┌────────────┐
 │   Backend   │          │  Azure AD  │
 │  REST API   │          └────────────┘
 └──────┬──────┘
        │ Embed token
        ▼
 ┌──────────────┐          ┌──────────┐
 │   Superset   │◀─iframe  │  Sentry  │◀─ Error events
 └──────────────┘          └──────────┘
```

## Layer Summary

| Layer           | Path                                    | Responsibility                                               |
| --------------- | --------------------------------------- | ------------------------------------------------------------ |
| **Pages**       | `app/pages/`                            | File-based routing, layout composition, tab definitions      |
| **Components**  | `app/components/`                       | Reusable UI — modals, panels, designer blocks                |
| **Stores**      | `app/stores/`                           | Server state, mutations, business logic, modal orchestration |
| **API Client**  | `app/api.config.ts` + `mp-frontend-api` | Typed HTTP calls, token injection, 401 refresh               |
| **Composables** | `app/composables/`                      | Routing, local storage, formatting helpers                   |
| **Utils**       | `app/utils/`                            | Pure helpers, auto-imported by Nuxt                          |
| **Config**      | `app/config/`                           | Static JSON — sidebar nav, tab definitions, page labels      |
| **Plugins**     | `app/plugins/`                          | App bootstrap, Azure OAuth, event bus wiring                 |

## External Services

| Service                    | How connected                       | Purpose                                                                                  |
| -------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------- |
| **Backend REST API**       | Axios + Bearer token                | All data CRUD, auth token exchange                                                       |
| **Azure Active Directory** | OAuth2 redirect (`/oauth/callback`) | SSO login                                                                                |
| **Apache Superset**        | `<iframe>` embed with embed token   | Analytics charts on Results pages                                                        |
| **Sentry**                 | JS error capture                    | Production error tracking                                                                |
| **CDN**                    | `<iframe src="…/engine.html">`      | Questionnaire engine runtime (see [Questionnaire Core & Engine](./questionnaire-engine)) |

## Key Architectural Decisions

- **Pinia over Vuex** — Composition API stores, no mutations boilerplate, better TypeScript inference.
- **iframe isolation for questionnaire engine** — CSS/JS sandbox, independent deployment, framework-agnostic host support. See [questionnaire engine rationale](./questionnaire-engine#why-this-architecture-exists).
- **Typed API client** — `mp-frontend-api` package is generated from the OpenAPI spec; component code never constructs raw URLs.
- **File-based routing** — Nuxt derives routes from `app/pages/`; no manual router config needed.
- **i18n at the store level** — `useI18n()` is called inside stores so toast messages respect the active locale without prop drilling.
