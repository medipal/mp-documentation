# Platform Architecture

## System Overview

Medipal is a schema-driven medical questionnaire management platform. `mp-schema` is the **single source of truth** — CI/CD auto-generates all typed clients from it whenever the schema changes.

```
═══════════════════════════════════════════════════════════════════════════
 1. SCHEMA & CODE GENERATION
═══════════════════════════════════════════════════════════════════════════

mp-schema (YAML definitions — single source of truth)
    │
    ├─ genma + yamser (Python code-gen engine)
    │   ├─ mp-server-pydantic-models    → Python request/response models
    │   ├─ mp-server-sql-alchemy-models → Python ORM models
    │   ├─ mp-server-api                → OpenAPI route definitions
    │   └─ mp-server-config-schema      → app configuration schema
    │
    └─ mp-typescript-api-generator + templates
        ├─ mp-frontend-api              → TypeScript API client (frontend)
        ├─ mp-mobile-app-api            → TypeScript API client (mobile)
        └─ mp-mobile-app-tracker-api    → TypeScript API client (tracker)

mp-typescript-api-validation            → AJV runtime request validation

═══════════════════════════════════════════════════════════════════════════
 2. BACKEND
═══════════════════════════════════════════════════════════════════════════

mp-server (Python / FastAPI)
    ├─ mp-server-api                (generated route stubs)
    ├─ mp-server-pydantic-models    (generated models)
    ├─ mp-server-sql-alchemy-models (generated ORM)
    ├─ mp-server-config-schema      (generated config)
    ├─ mp-server-plugin-sdk         (plugin interface)
    │   └─ mp-server-plugin-smtp-email
    └─ Python libs: pylog, storiel, confirion, genma, yamser, fyler, structo

mp-tracker (Python analytics service)
    └─ mp-tracker-api-spec          → OpenAPI spec for tracker endpoints

═══════════════════════════════════════════════════════════════════════════
 3. FRONTEND
═══════════════════════════════════════════════════════════════════════════

mp-frontend (Nuxt 4 admin SPA)
    ├─ mp-nuxt-api-layer            (shared Nuxt API layer)
    ├─ mp-nuxt-msal-plugin          (Azure AD auth)
    ├─ mp-frontend-api              (generated API client)
    ├─ mp-typescript-api-validation  (AJV validation)
    ├─ mp-questionnaire-engine-builder (iframe — designer preview & delivery)
    └─ mp-frontend-nginx-proxy      (reverse proxy)

mp-frontend-plugin-template         (TypeScript starter for frontend plugins)

═══════════════════════════════════════════════════════════════════════════
 4. MOBILE
═══════════════════════════════════════════════════════════════════════════

mp-mobile-app (Nuxt 4 + Capacitor 7)
    ├─ mp-nuxt-api-layer            (shared Nuxt API layer)
    ├─ mp-nuxt-msal-plugin          (Azure AD auth)
    ├─ mp-mobile-app-api            (generated API client)
    ├─ mp-mobile-app-tracker-api    (generated tracker client)
    ├─ mp-mobile-app-live-update    (OTA Capacitor plugin)
    ├─ mp-typescript-api-validation  (AJV validation)
    └─ mp-questionnaire-engine-builder (iframe — questionnaire rendering)

mp-mobile-app-builder               (native distribution builds)
    ├─ ios/     (submodule) → mp-mobile-app-ios-native
    ├─ android/ (submodule) → mp-mobile-app-android-native
    └─ mp-fastlane-certificates     (iOS code signing)

mp-live-update-manager              (bundle build + S3 deploy + CDN invalidation)

═══════════════════════════════════════════════════════════════════════════
 5. QUESTIONNAIRE PIPELINE
═══════════════════════════════════════════════════════════════════════════

mp-questionnaire-core-builder       → UMD JS bundle (CDN)
    └─ mp-questionnaire-engine-builder  → single-file HTML (CDN)
            └─ mp-anonymous-questionnaire-builder → public HTML (CDN)

Engines embedded as iframes in mp-frontend and mp-mobile-app

═══════════════════════════════════════════════════════════════════════════
 6. TRACKER
═══════════════════════════════════════════════════════════════════════════

mp-tracker (Python analytics service)
    └─ mp-tracker-api-spec          → OpenAPI spec
        └─ mp-mobile-app-tracker-api → generated TypeScript client
            └─ consumed by mp-mobile-app

═══════════════════════════════════════════════════════════════════════════
 7. PLUGIN SYSTEM
═══════════════════════════════════════════════════════════════════════════

mp-server-plugin-sdk                (Python plugin interface for mp-server)
    └─ mp-server-plugin-smtp-email  (built-in SMTP email plugin)
mp-frontend-plugin-template         (TypeScript starter for frontend plugins)

═══════════════════════════════════════════════════════════════════════════
 8. INFRASTRUCTURE & CI/CD
═══════════════════════════════════════════════════════════════════════════

mp-github-actions           (shared workflows & composite actions)
mp-tf-infrastructure        (Terraform — AWS VPC, EC2, RDS, S3, CloudFront)
mp-frontend-nginx-proxy     (Nginx reverse proxy — SSL, gzip, routing)
mp-fastlane-certificates    (encrypted iOS signing profiles)
mp-live-update-manager      (live update bundle manager — build, deploy, promote)

═══════════════════════════════════════════════════════════════════════════
 9. TESTING
═══════════════════════════════════════════════════════════════════════════

mp-e2e-tests                (Playwright — end-to-end browser tests)
mp-api-tests                (pytest — API integration tests)

═══════════════════════════════════════════════════════════════════════════
 10. DOCUMENTATION
═══════════════════════════════════════════════════════════════════════════

mp-documentation            (this VitePress site)
```

---

## Repositories

### mp-schema

**Role:** Single source of truth for all data models.

- 140+ YAML files using JSON Schema — entities (User, Questionnaire, Enrollment, Device, Folder, Permission, etc.), auth config, base field definitions
- All entities inherit `id`, `created_at`, `updated_at`, `updated_by`, `deleted_at` from `src/schema/def/base.yaml`
- Schema is exported via `yamser`; triggers CI/CD code generation on every push to main

---

### mp-frontend-api

**Role:** Auto-generated, typed Axios HTTP client for the backend API.

- Generated by `swagger-typescript-api` from the OpenAPI spec derived from mp-schema
- Published as `@medipal/mp-frontend-api` npm package (GitHub Packages)
- Key exports: `Api` class with typed methods (e.g. `v1QuestionnaireList`, `v1EnrollmentCreate`), `swagger.d.ts` for type inference

::: warning Never edit manually
Never edit `dist/` manually — always regenerate via CI from mp-schema.
:::

See [API Client](/frontend/api-client) for how mp-frontend consumes this package.

---

### mp-nuxt-api-layer

**Role:** Shared Nuxt layer bridging both frontend and mobile to the API client.

- Provides `useApi()` composable (proxy-based, middleware-chain)
- Handles method name mapping and interceptor wiring
- Consumed via `extends: ["github:medipal/mp-nuxt-api-layer"]` in `nuxt.config.ts`
- The consuming app must provide `app/api.config.ts` with a `createApi()` factory and `methodMap` object

---

### mp-frontend _(this repo)_

**Role:** Primary admin web SPA for clinicians/admins to design questionnaires, manage patients, and view results.

**Tech:** Nuxt 4 + Vue 3 + TypeScript + Tailwind CSS 4 + Nuxt UI + Pinia. Client-side only (no SSR).

Key features:

- Questionnaire designer (drag-and-drop, conditional logic, expression builder, multi-language, undo/redo)
- Patient & enrollment management
- Results/analytics (embedded Superset dashboards)
- Folder hierarchy with inherited permissions
- Auth: credentials + Azure AD (MSAL), TOTP MFA, auto token refresh with request queuing
- 11 locales including Arabic RTL

---

### mp-mobile-app

**Role:** Patient-facing Nuxt 4 + Capacitor 7 hybrid app (iOS & Android).

Key features:

- Locally scheduled questionnaires
- Offline-first with encrypted SQLite (`@capacitor-community/sqlite`)
- Push notifications and background tasks
- Configurable server instance URL
- OTA live updates via the `mp-mobile-app-live-update` plugin

The `ios/` and `android/` directories are git submodules pointing to separate native repos (`mp-mobile-app-ios-native` and `mp-mobile-app-android-native`). `mp-mobile-app-builder` is the separate companion used for app store distribution builds.

See [Mobile App Architecture](/mobile/mobile-app-overview) for a detailed breakdown.

---

### mp-questionnaire-core-builder

**Role:** Builds the reusable Vue 3 questionnaire framework library distributed via CDN.

- Output: single UMD JS bundle `dist/questionnaire-core-{version}.js` + CSS + metadata manifest
- Bundles Vue 3, Vue-i18n, AJV validators, Tiptap rich text, Nuxt UI components
- Consumed by `mp-questionnaire-engine-builder` which wraps it with custom question type renderers

---

### mp-questionnaire-engine-builder

**Role:** Combines questionnaire-core with custom question renderers into self-contained HTML bundles.

- Output: single-file `dist/questionnaire-engine-{version}/index.html` deployable to CDN
- Reads `src/questionnaire-engine.json` manifest (engine metadata + renderer list + core version reference)
- `vite-plugin-singlefile` bundles everything into one HTML file
- **Usage:** Engines are embedded as iframes in mp-frontend (designer preview + patient-facing delivery) and mp-mobile-app

---

### mp-nuxt-msal-plugin

**Role:** Nuxt plugin providing Azure AD / Microsoft Entra authentication.

- Provides `useMSAuth()` composable — `signIn()`, `signOut()`, `acquireTokenSilent()`, auto token refresh 300s before expiry
- Required env vars: `CLIENTID`, `AUTHORITY`, `REDIRECT_URI`, `POSTLOGOUT_REDIRECT_URI`
- Dependency: `@azure/msal-browser` v4.13+
- Consumed by both mp-frontend and mp-mobile-app for enterprise login

---

### mp-mobile-app-builder

**Role:** Standalone build-only repository for producing signed native app packages for iOS TestFlight and Google Play Store distribution.

- Uses **Nuxt 3** (intentionally older than `mp-mobile-app`) — only needs static generation, not the latest Nuxt features
- `nuxt generate` produces the web bundle → `npx cap sync` copies it into native projects → Fastlane archives and uploads
- Contains full **Fastlane setup** for both platforms:
  - iOS: `ios/App/fastlane/Fastfile` — `beta` lane (setup_ci → match → build_app → upload_to_testflight)
  - Android: `android/fastlane/Fastfile` — `internal` lane (gradle bundle → upload_to_play_store)
- `ios/` and `android/` are **git submodules** pointing to `mp-mobile-app-ios-native` and `mp-mobile-app-android-native`
- When `USE_LIVE_UPDATE=true`, also produces `live-update.zip` + `manifest.json` for OTA delivery

See [Mobile App Builder Architecture](/mobile/mobile-app-builder) for the full breakdown, and [iOS Build](/mobile/ios-build) / [Android Build](/mobile/android-build) for deployment steps.

---

### mp-fastlane-certificates

**Role:** Encrypted certificate and provisioning profile storage for `fastlane match` (iOS code signing).

- Managed via `fastlane match` — all certificates and profiles are stored encrypted with an OpenSSL AES passphrase
- Structure:
  ```
  certs/distribution/     ← Apple Distribution certificates (.cer + .p12)
  certs/development/      ← Apple Development certificates
  profiles/appstore/      ← App Store provisioning profiles
  profiles/development/   ← Development provisioning profiles
  ```
- Referenced from `ios/App/fastlane/Fastfile` via `sync_code_signing(type: "appstore")`
- The passphrase (`MATCH_PASSWORD`) is stored separately in CI secrets — never committed
- Repository must remain **private**; if compromised, rotate all certificates immediately via `fastlane match nuke`

---

### mp-mobile-app-live-update

**Role:** Custom OTA live update Capacitor plugin (replaces the paid Ionic service).

How it works:

1. On app start: check local content hash vs. server `manifest.json`
2. If outdated: download `.zip`, unpack to device storage, reload webview
3. Manifest format: `{ hash, version, timestamp, contentUrl }`

API: `getLocalContent()`, `checkForContentUpdate()`, `pullContentUpdate()`, `setWebViewPath()`

> iOS and Android builds are fully supported. The OTA live update feature is currently iOS-only; Android live update support is planned.

---

### mp-live-update-manager

**Role:** Full-stack Nuxt 4 application for managing OTA live update bundles.

- Build orchestration: queue builds from any `mp-mobile-app` branch/tag, run `nuxt generate`, package and upload to S3
- Environment promotion: deploy bundles to development, staging, or production with CloudFront cache invalidation
- Audit trail: every action (build, deploy, delete) logged in JSONL format on S3
- JWT authentication with API key anti-DDoS layer
- Serial build queue with real-time log streaming

See [Live Update Manager](/mobile/live-update-manager) for the full documentation.

---

### mp-frontend-nginx-proxy

**Role:** Nginx reverse proxy / load balancer for all Medipal web traffic.

| Host pattern                | Upstream                    |
| --------------------------- | --------------------------- |
| `web.{env}.medipal.dev`     | Nuxt 4 frontend (port 3000) |
| `app.{env}.medipal.dev`     | Nuxt 4 mobile web app       |
| `mock.{env}.medipal.dev`    | Mock API server (port 8000) |
| `updates.{env}.medipal.dev` | Live update CDN endpoint    |

Key features: SSL termination, gzip, aggressive caching for hashed assets (`/_nuxt/` → 1 year immutable), no-cache for HTML, WebSocket/SSE support, HSTS.

---

### mp-server

**Role:** Backend API powering the entire Medipal platform.

**Tech:** Python, FastAPI, PostgreSQL, Redis.

- RESTful API with auto-generated route stubs, Pydantic models, and SQLAlchemy ORM from mp-schema
- Plugin system via `mp-server-plugin-sdk` — plugins are loaded dynamically at startup
- Event-driven architecture with outbox pattern for reliable event delivery
- Built-in scheduler for background jobs (heartbeat, tracker ping, enrollment reminders)
- RBAC with scopes, API key auth, Azure AD integration
- Depends on internal Python libs: `pylog`, `storiel`, `confirion`, `genma`, `yamser`, `fyler`, `structo`

---

### mp-mobile-app-api

**Role:** Auto-generated, typed Axios HTTP client for the mobile app.

- Generated by `mp-typescript-api-generator` from the OpenAPI spec derived from mp-schema
- Published as `@medipal/mp-mobile-app-api` npm package (GitHub Packages)
- Separate from `mp-frontend-api` — mobile endpoints may differ from admin endpoints

::: warning Never edit manually
Never edit `dist/` manually — always regenerate via CI from mp-schema.
:::

---

### Generated Server Modules

These repositories are **auto-generated** from mp-schema via `genma` + `yamser` and consumed as git submodules by `mp-server`:

| Repository                       | Contents                                                         |
| -------------------------------- | ---------------------------------------------------------------- |
| **mp-server-pydantic-models**    | Python Pydantic v2 request/response models for all API endpoints |
| **mp-server-sql-alchemy-models** | SQLAlchemy 2.0 ORM model classes mapping to PostgreSQL tables    |
| **mp-server-api**                | FastAPI route definitions generated from OpenAPI specs           |
| **mp-server-config-schema**      | App configuration schema (YAML-based, validated at startup)      |

::: warning Never edit manually
These repos are regenerated on every mp-schema push. Manual edits will be overwritten.
:::

---

### Code Generation Tooling

| Repository                                | Role                                                                                                                                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **mp-typescript-api-generator**           | CLI tool that generates typed TypeScript API clients from OpenAPI specs. Wraps `swagger-typescript-api` with Medipal-specific configuration.                                                         |
| **mp-typescript-api-generator-templates** | ETA templates consumed by the generator — controls the shape of generated `Api` classes, method signatures, and type exports.                                                                        |
| **mp-typescript-api-validation**          | AJV-based runtime request validation. Published as `@medipal/mp-typescript-api-validation` npm package. Used by both mp-frontend and mp-mobile-app to validate payloads before sending API requests. |

---

### mp-anonymous-questionnaire-builder

**Role:** Builds self-contained public questionnaire HTML bundles for anonymous (unauthenticated) submissions.

- Extends `mp-questionnaire-engine-builder` with a stripped-down UI (no auth, no patient context)
- Output: single-file HTML deployed to CDN, embeddable via direct URL or iframe
- Use case: public surveys, screening forms, patient-reported outcome measures

---

### mp-tracker

**Role:** Standalone Python analytics service for tracking mobile app usage events.

- Receives analytics events from `mp-mobile-app` via the generated `mp-mobile-app-tracker-api` client
- `mp-tracker-api-spec` defines the OpenAPI spec; the TypeScript client is auto-generated from it
- `mp-server` periodically pings the tracker via the `heartbeat_job` scheduler task

---

### Plugin System

| Repository                      | Role                                                                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **mp-server-plugin-sdk**        | Python SDK defining the plugin interface for `mp-server`. Plugins implement hooks for events, scheduling, and custom API endpoints. Published as a pip package.    |
| **mp-server-plugin-smtp-email** | Built-in SMTP email plugin. Sends transactional emails (enrollment invitations, password resets, notifications) via configurable SMTP relay.                       |
| **mp-frontend-plugin-template** | TypeScript starter template for building frontend plugins. Provides the scaffolding, build config, and type definitions needed to extend the mp-frontend admin UI. |

---

### Native Submodule Repositories

| Repository                       | Role                                                                                                                                                                                                 |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **mp-mobile-app-ios-native**     | Native iOS Xcode project (Swift). Mounted as `ios/` submodule in both `mp-mobile-app` and `mp-mobile-app-builder`. Contains `AppDelegate`, Capacitor bridge config, and native plugin registrations. |
| **mp-mobile-app-android-native** | Native Android Studio project (Kotlin). Mounted as `android/` submodule. Contains `MainActivity`, Gradle build config, and native plugin registrations.                                              |

---

### Testing

| Repository       | Role                                                                                                                                                                                                  |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **mp-e2e-tests** | End-to-end browser tests using Playwright. Covers critical user flows: login, questionnaire creation, patient enrollment, results viewing. Runs against a full stack (frontend + backend + database). |
| **mp-api-tests** | API integration tests using Python + pytest. Tests backend endpoints directly — CRUD operations, auth flows, webhook delivery, plugin lifecycle.                                                      |

---

### mp-tf-infrastructure

**Role:** Terraform IaC for all Medipal cloud infrastructure on AWS.

- VPC, subnets, security groups
- EC2 instances for frontend and backend services
- RDS PostgreSQL, ElastiCache Redis
- S3 buckets for file storage and CDN origins
- CloudFront distributions for questionnaire engine bundles
- ACM certificates, Route 53 DNS

---

### Python Libraries

Internal Python packages shared across `mp-server`, `mp-tracker`, and code generation tooling:

| Library       | Purpose                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- |
| **genma**     | Code generation engine — reads schema definitions and produces source files using Jinja2 templates |
| **yamser**    | YAML serialization/deserialization with schema validation and reference resolution                 |
| **confirion** | Configuration management — loads, merges, and validates YAML/env config at startup                 |
| **pylog**     | Structured JSON logging with correlation IDs and request context                                   |
| **storiel**   | Storage abstraction layer — unified API for local filesystem and S3                                |
| **fyler**     | File utilities — temp file management, path resolution, archive handling                           |
| **structo**   | Data structure helpers — deep merge, diff, flatten, schema-aware transforms                        |

---

### mp-documentation

**Role:** This VitePress documentation site.

- Developer docs for the entire Medipal platform — architecture, API reference, setup guides
- Auto-deployed on push to main

---

## CI/CD (mp-github-actions)

Centralized CI/CD orchestration for the entire platform:

| Workflow        | Trigger / Purpose                                                                  |
| --------------- | ---------------------------------------------------------------------------------- |
| Code generation | mp-schema push → regenerate TypeScript clients, Pydantic models, SQLAlchemy models |
| Build & test    | ESLint, Prettier, Vitest, Playwright e2e                                           |
| Publish         | npm packages to GitHub Packages, Docker images to AWS ECR                          |
| Mobile          | Android/iOS native builds via Fastlane, app store deployment                       |
| Deploy          | EC2 pull-based deployment for frontend services                                    |

---

## Key Architectural Rules

1. **Never edit generated repos manually** — `mp-frontend-api`, `mp-mobile-app-api`, `mp-mobile-app-tracker-api`, `mp-server-pydantic-models`, `mp-server-sql-alchemy-models`, `mp-server-api`, `mp-server-config-schema` are all regenerated via CI from mp-schema
2. **`mp-nuxt-api-layer` is a Nuxt layer**, not a standalone app — must be consumed via `extends`
3. **Questionnaire engines are single-file HTML bundles** — designed for CDN + iframe embedding
4. **`mp-mobile-app-builder` ≠ `mp-mobile-app`** — builder is for native distribution only; see [Mobile App Builder Architecture](/mobile/mobile-app-builder)
5. **Auth has two paths:** credentials (mp-nuxt-api-layer interceptors) + Azure AD (mp-nuxt-msal-plugin)
6. **mp-schema is the root of the dependency graph** — all typed clients, models, and route definitions flow from it
7. **Server plugins use `mp-server-plugin-sdk`** — never add plugin logic directly to mp-server
8. **`mp-live-update-manager` manages OTA bundles** — builds from `mp-mobile-app` repo, stores on S3, promotes across environments
