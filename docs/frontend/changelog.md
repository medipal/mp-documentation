# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.23.0] - 2026-03-04

### Added

#### Scope-Based Access Control

- `useScopeStore` — Pinia store managing user scopes (`hasScope`, `hasAnyScope`, `hasAllScopes`), role scope CRUD (`fetchRoleScopes`, `syncRoleScopes`)
- `scopedAction()` utility — auto-disables table row actions when user lacks required scope
- `ScopeMatrix` component — visual resource×action checkbox grid for selecting scopes (used in role config and API key creation)
- Admin panel tab visibility now scope-gated via `tabScopeMap` in `admin-panel.vue`
- Sidebar `resolveAdminPanelPath()` — dynamically resolves first visible admin tab based on user scopes
- Sidebar `activePrefix` — keeps sidebar highlight active across all admin panel sub-tabs
- Scope-gated actions applied to: permissions (`permission:write/delete`), sessions (`auth:register_device`), devices (`device:delete`), users (`user:write/delete`), roles (`role:write/delete`), user-role assignments (`user_role:write/delete`)
- Disabled buttons show `@common.scopes.noPermission` tooltip

#### API Key Management

- `useApiKeyStore` — full CRUD store with `fetchTokens`, `revokeToken`, status types (`active`/`expired`/`revoked`)
- `CreateApiKeyModal` — two-step wizard: form (name, description, expiry, scopes via ScopeMatrix) → token reveal with copy button and one-time-display warning
- API Keys tab in Admin Panel → Access section with table: name, token hint, scopes badges, expires at, last used at, status badges
- Creation gated by `auth:api_key` scope

#### Enhanced Role Management

- Role detail page (`/role/[id]`) with three tabs: **Info**, **Assigned Users**, **Scopes**
- Scopes tab — `ScopeMatrix` for editing role scopes; scopes the current user doesn't hold are disabled (can't grant what you don't have)
- Assigned Users tab — table with user link, email, granted at/by; assign/unassign actions gated by `user_role:write/delete`
- `ChangeUserRoleModal` — multi-role assignment dropdown
- `ResetUserPasswordModal` — manual entry + "Generate" button (`crypto.getRandomValues`, 16-char, auto-copy)
- Users table now shows role badges column with role-based filter dropdown
- `parentPath`/`parentTab` query params for back-navigation to correct sub-tab

### Changed

- Access token terminology renamed to **API Key** across all 11 locales
- `useProviderStore` extended: `userRolesMap`, `fetchUserRoles()`, `getUserRoleBadges()`, `changeUserRoles()`, `showChangeUserRoleModal()`, `showResetUserPasswordModal()`, `showForcePasswordChangeModal()`
- Admin panel Access page now has four sub-tabs: Users, Sessions, Roles, API Keys
- User scopes bootstrapped at login time from `/me` response via `scopeStore.setUserScopes()`
- Full localization across all 11 locales (`@toasts.role.*`, `@toasts.scope.*`, `@toasts.apiKey.*`, `@pages.role.*`, `@modals.adminPanel.*`)

#### Type Consolidation

- Removed inline `Webhook`, `WebhookDelivery` interfaces from `stores/webhook.ts` — now imported from `@/types/webhook`
- Removed inline `ApiKey` interface from `stores/apiKey.ts` — now imported from `@/types/apiKey`
- Removed inline `EventDeliveryTask` interface from `stores/eventDeliveryTask.ts` — now imported from `@/types/eventDeliveryTask`
- Removed local `Scope` interface from `components/ScopeMatrix.vue` — now imported from `@/types/scope`
- Updated consumer imports in `webhooks.vue`, `CreateWebhookModal.vue`, `WebhookDeliveriesModal.vue`, `CreateApiKeyModal.vue` to import types from `@/types/` instead of stores
- Added re-export shims: `app/types/webhook.ts`, `app/types/apiKey.ts`, `app/types/eventDeliveryTask.ts`, `app/types/scope.ts`

#### ESLint Cleanup

- Disabled `vue/multi-word-component-names` rule — incompatible with Nuxt file-based routing conventions
- Fixed `vue/html-self-closing` violations across 15+ components (auto-fixed)
- Fixed `vue/attributes-order` violations in `QuestionnaireEngineEditor.vue` and `nodes.vue` (auto-fixed)
- Fixed `vue/require-default-prop` in `PanelActionSection.vue`, `PanelContent.vue`, `PanelHeader.vue` — added explicit `default: undefined`
- Fixed `vue/no-side-effects-in-computed-properties` in `languages.vue` and `legal.vue` — extracted lazy initialization into `watchEffect`
- Added `eslint-disable` for `vue/prop-name-casing` on `GridIcon.vue` snake_case props (intentional — API data spread via `v-bind`)
- Removed unused `eslint-disable` directives in `patient.ts` and `vue-shim.d.ts`
- Result: **0 ESLint warnings** (down from 106)

---

## [0.22.1] - 2026-03-02

### Added

#### Questionnaire Revision History

- Full revision history for questionnaires — view all changes with timestamps, authors, and operation types (`CREATE`, `UPDATE`, `PUBLISH`)
- Snapshot restoration — load any previous questionnaire state into the designer as unsaved changes with toast confirmation
- Revision snapshot modal with detailed per-segment change breakdown (payload, config, schedule)
- Feature flag: `FEATURE_REVISIONS`
- Full localization across all 11 locales

#### Shared Documents Management

- Shared documents CRUD management in the **System** tab of the admin panel
- S3-based storage with server-side API endpoints for read, write, and delete operations per locale and document type
- Multi-locale support with locale picker — manage documents (e.g. device authentication consent) per language

#### Workflow Editor Enhancements

- **Undo/redo** — snapshot-based history management in `workflowEditor` Pinia store (migrated from composable)
- **Condition indicators** on connections — visual representation of edges with conditions
- **SWITCH node routing** — edge configuration sidebar with switch-specific outgoing edge management
- **Event definitions** — auto-generation of JSON skeletons for test payloads based on selected event types
- **Node key management** — editable node keys with validation and key propagation across the graph

### Changed

- `workflowEditor` migrated from composable to Pinia store with dedicated `history.ts` module and typed state
- `WorkflowNodeComponent` refactored — separate flow inputs/outputs, node keys displayed alongside labels
- `useConfirm` composable extended to support secondary actions
- Data socket type removed — all inputs/outputs now use `flowSocket` exclusively
- API endpoint references updated from `engines/` to `engine/` across codebase and documentation

### Fixed

- **Sentry source map upload** — moved from rollup plugin to `sentry-cli` to fix OOM during Nitro server build (6GB+); source maps now uploaded in a separate Dockerfile step
- **Sidepanel** — corrected folder label reference from `label` to `name`

### Infrastructure

- `lint-staged` configured with Husky pre-commit hooks for automated linting
- Docs deployment enabled from both `main` and `development` branches
- VitePress sidebar updated with navigation links for Workflow, Plugin, Vault, and Role Management docs

### Removed

- VitePress documentation — moved to dedicated `mp-documentation` repository. Removed `docs/` directory, `docs:dev`/`docs:build`/`docs:preview` scripts, `vitepress` devDependency, `deploy-docs.yml` workflow, and all README references

---

## [0.22.0] - 2026-02-28

### Added

#### Visual Workflow Editor

- New visual workflow editor powered by **Rete.js v2** with UE4 Blueprint-style dark theme
- Node palette with six node types: **ACTION**, **COMPUTE**, **SWITCH**, **JOIN**, **DELAY**, **END**
- Node configuration sidebar with per-type panels: general, action (plugin dropdowns + JsonForms input mapping), compute (JSON Logic textarea), switch, join (`n_required`), delay (`delay_ms`), advanced (timeout, retry policy)
- Plugin data management — `usePluginData` composable (singleton, lazy-fetched definitions + instances cache) drives ACTION node dropdowns; changing instance resets action and `input_mapping`
- **JSON Logic rule builder** in SWITCH nodes: field / operator / value inputs with dropdown prefix selector
- Workflow runs pages (`/admin-panel/workflows/[id]/runs`) with improved history list and run detail view
- Editor tab unlocked only after a workflow is selected in the list; defaults to loading state otherwise
- Feature flag: `FEATURE_WORKFLOWS` — controls visibility of the Workflows admin panel section
- Full localization for all workflow editor strings across 11 locales (`@pages.adminPanel.tabs.workflows.*`, `@modals.workflow.*`, `@toasts.workflow.*`)

#### Plugin Management

- Plugin instance management in the **System** tab of the admin panel (`/admin-panel/system`)
- `usePluginData` composable — singleton cache for plugin definitions and instances; exposes `getActionsForInstance()`, `getDefinitionForInstance()`
- Types: `PluginDefinition`, `PluginInstance`, `PluginAction` in `app/types/plugin.ts`
- Full CRUD UI for plugin instances with localization across all 11 locales

#### Role Management

- RBAC role management in the **Access** tab of the admin panel (`/admin-panel/access`)
- Create, edit, and delete roles via dedicated modals (`CreateRoleModal`, `EditRoleModal`)
- Assign and unassign roles to/from users (`AssignUserRoleModal`)
- Feature flag: `FEATURE_ROLES` — hides the Roles section in the admin panel when disabled

#### Vault Management

- Vault entry management in the **System** tab of the admin panel (`/admin-panel/system`)
- `VaultReferenceRenderer` — custom JsonForms renderer that displays vault references with a copy-to-clipboard button (toast notification on success); reference format: `@vault/{id}`
- Full CRUD UI for vault entries with localization across all 11 locales

#### Anonymous Questionnaire Links

- Generate and manage anonymous questionnaire links with QR codes
- Locale selection from questionnaire's published translations; custom link title
- Operations: fetch / generate / delete / copy URL
- QR code modal with copy option
- Web submission modal for anonymous questionnaire completion
- `@medipal/mp-anonymous-questionnaire-builder` updated to **v0.1.3**
- Feature flag: `FEATURE_ANONYMOUS_QUESTIONNAIRES`

#### Published Questionnaires — Read-only mode

- Designer and config pages enter **read-only mode** when a questionnaire is published
- UI alerts inform users about the published state and limit editing
- Designer tools adapt to the published state (e.g. drag-and-drop disabled)

#### Global Search & Folder Tree

- **Global search** across all resources from the main navigation
- Folder tree filtering with **server-side sorting**
- "Show all" toggle to display all files in the folder tree regardless of depth

#### Settings / Devices

- Device deletion from the **Devices** tab in User Profile

#### AI Designer

- AI-powered questionnaire design assistant built on Vercel AI SDK v4 with multi-model support (Anthropic, OpenAI, Google)
- Multi-step tool execution with `stopWhen: stepCountIs(10)` for guided edits
- Bulk AI tools for questions, sections, and answer options
- Action validation and error resilience — partial failures no longer stall the tool loop
- Tool metadata and full localization for all AI designer actions (11 locales)
- Search and type filter in the Designer component list (questions, sections, etc.)
- Feature flag `FEATURE_AI_TOOLS` (`.env`) to enable/disable AI designer
- AI Designer documentation added to VitePress sidebar

#### Settings Page

- New **Devices** tab (visible to `provider` and `admin` roles only)
- New **My Questionnaires** tab (visible to `provider` and `admin` roles only):
  - **My Enrollments** table — shows the logged-in user's enrollments with:
    - Questionnaire name link, status badge, user type badge, start/end dates
    - Row actions: Accept Consent, Cancel Enrollment
    - Column visibility persistence in localStorage
    - **Status filter** (multi-select dropdown, persisted in localStorage) to filter by `PENDING_CONSENT`, `ENROLLED`, `COMPLETED`, `TERMINATED_BY_PROVIDER`, `TERMINATED_BY_PATIENT`
  - **My Submissions** table — shows the logged-in user's questionnaire submissions with:
    - Questionnaire name link, submission date, score
    - Row action: view submission payload in a modal
    - Column visibility persistence in localStorage

#### Tables

- `TableHeading`: generic reusable filter dropdown via new `filterOptions` prop and `filter-value` v-model
  - Active `UDropdownMenu` with checkbox items when `filterOptions` are provided
  - Badge on the Filter button showing active filter count
  - Falls back to the original disabled button when no options are passed (backwards-compatible)
  - `Table`: expanded row state (collapsible sub-rows) + `initialSort` prop for default column sorting
  - `PageContainer`: new `syncUrl` prop — persists the active tab name as a URL query parameter for deep-linkable tabs

#### Questionnaire Scheduling

- `validateScheduleSections` utility — detects cross-section `goto` and `condition` references that would break section-scoped scheduling; returns typed warnings per question

#### Block Editor

- Custom code block component with syntax highlight and related actions
- `BlockEditorPropertyBlock` component added to `blockComponentMap`

#### Results

- Superset Dashboard embed in a new Charts tab, behind feature flag `FEATURE_SUPERSET_DASHBOARDS`
- Charts tab shows an error fallback when the embed fails

#### Engine Management

- Core selection dropdown now displays version alongside name (e.g. "Questionnaire Core (v0.21.3)")
- Core field validation — form cannot be submitted without selecting a core
- Server-side validation in `POST /api/engine/build` now returns specific missing field names for both top-level manifest and core subfields
- Published Versions list moved from a separate tab into the Available Engines tab
- Info alert explaining that published engines must be added to folder configuration
- "Publish Current Engine" section removed from Available Engines tab (available in the Editor)
- Buttons reworked: Copy copies base URL, Open opens `manifest.json`, removed redundant copy button
- Engines page split into `engines.vue` + `engines/_partial/available.vue` + `engines/_partial/editor.vue` following the folder + `_partial` pattern
- All hardcoded strings replaced with i18n translations (11 locales)
- Engine Management section added to `docs/features/questionnaire-engine.md`

#### Infrastructure / DevOps

- `deploy-release` workflow: input parameters for image tagging and environment selection
- EC2 deployment workflows: `app` parameter support
- New `update-environment` workflow
- Android and iOS build documentation
- VitePress-based developer documentation expanded (security model, features overview, deployment, questionnaire engine/core)
- **JWT authentication middleware** — server-side `auth.ts` middleware verifies Bearer tokens on all `/api/` routes; `requireAuth()` utility for protected endpoints
- **Webhook management translations** — validation messages and full CRUD translations across all 11 locales
- **Admin panel sessions page** — active session management with revoke functionality
- **Enrollment modal enhancements** — description field and self-assignment confirmation for participants

### Changed

- **Enrollments page** — split into two focused components: `standard.vue` (patient enrollments) and `anonymous.vue` (anonymous link tracking)
- **Users / Access routing** — admin panel access section refactored with improved routing structure
- **Language management** — language key renamed and unused translation keys removed
- **Designer** — massive component split into focused files; `DesignerAIChat`, tool handlers, and validation moved to separate modules
- **Published questionnaires** — editing capabilities unlocked; modals enhanced to reflect published state correctly
- **Engines / Advanced Configuration** — cores and engines management refactored with improved UI
- **Modal async submission** — all form modals now accept an `onSubmit: (data) => Promise<void>` prop instead of emitting `"success"`; `isSubmitting` is guaranteed to reset on both success and failure
- **EnrollPatient modal** — improved flow and validation
- **EditQuestionnaireScheduleModal** — scheduling UI improvements and section preview
- **Settings page** — container widened to `max-w-screen-xl`; tabs are now a computed array reactive to user roles
- **Routing** — components updated to support `parentPath` and query parameters for deep-link navigation
- **RTEditor** — `editable` prop derived from designer read-only state
- **Icon computation** — improved fallback logic for missing or invalid icon identifiers
- **Email field** — now accepts `null` values in questionnaire form schemas
- **Dockerfile** — nginx stage removed; deployment documentation updated
- Server API routes (`engine/`, `questionnaire/[id]/anonymous-*`) refactored to use middleware-based auth instead of per-route token checks
- AI Designer chat transport: automatic 401 retry with token refresh

### Fixed

- Various UX improvements across designer, modals, and enrollment flows (#37)

### Removed

- Playwright and `@nuxt/test-utils` testing dependencies removed from the project

---

## [0.20.2] - 2026-02-23

- Patch release — dependency and minor fixes.

## [0.20.1] - earlier

- `@medipal/mp-frontend-api` updated to `0.20.1`.
