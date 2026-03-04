# Changelog

All notable changes to mp-server are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [0.23.1] — 2026-03-03

### Added

- Scheduled worker that soft-deletes expired refresh tokens every 24 hours. Tokens that have naturally expired (e.g. user simply stopped using the app) but were never explicitly removed now get their `deleted_at` timestamp set automatically, keeping session data consistent. Complements the existing `cleanup_expired_tokens` hard-delete job.
- Comprehensive test coverage for the scheduler layer: `test_scheduler_entrypoint.py` (27 tests) and `test_task_processor.py` (9 tests) covering job registration, interval triggers, executor assignments, async/sync signature correctness, delegation, and exception handling for all scheduled jobs.
- Scheduler documentation (`docs/scheduler.md`) — architecture overview, registered jobs reference, how to add sync vs async jobs, executor routing, job defaults, error handling, and testing guide.

### Changed

- APScheduler switched from `BackgroundScheduler` to `AsyncIOScheduler` with dual executors. Async jobs (outbox drain, webhook retry) run as coroutines directly on the uvicorn event loop via `AsyncIOExecutor`. Sync jobs (heartbeat, enrollment processor, token cleanup, plugin registration) run in the `ThreadPoolExecutor`. Previously all jobs ran on threads, and the two async jobs spun up a throwaway `asyncio.run()` event loop every 30 seconds — coroutines were silently never awaited when the scheduler was first migrated to `AsyncIOScheduler` without the dedicated executor.

### Fixed

- Async scheduler jobs (outbox drain, webhook retry) were silently not running. APScheduler 3.x does not auto-detect coroutine functions — without an explicit `AsyncIOExecutor`, coroutines were dispatched to the `ThreadPoolExecutor`, which called them as regular functions and discarded the unawaited coroutine objects. Added a named `"asyncio"` executor and routed both async jobs to it.

---

## [0.23.0] — 2026-03-03

### Added

- API keys (service tokens) for 3rd-party integrations:
  - Long-lived bearer tokens with `mp_key_` prefix for programmatic access.
  - Token acts as the creating user with a creator-defined subset of scopes.
  - SHA-256 hash stored; plaintext shown once at creation.
  - Creator-defined TTL via `expires_in` (minimum 1 hour).
  - Effective scopes computed as intersection of key scopes and creator's current role scopes at validation time.
  - `auth_path = "api_key"` bypasses MFA and password-reset enforcement.
  - API endpoints:
    - `POST /api/v1/api_key` — create key (returns plaintext once).
    - `GET /api/v1/api_key` — list current user's keys (paginated).
    - `GET /api/v1/api_key/{id}` — retrieve a single key.
    - `DELETE /api/v1/api_key/{id}` — revoke a key.
  - `auth:api_key` scope required for all API key management endpoints.
  - Error catalog entries for API key errors (NOT_FOUND, REVOKED, EXPIRED, INVALID, SCOPE_EXCEEDS_CREATOR).
- Scope-based access control system (`@require_scopes` decorator) replacing coarse `@require_roles` checks on all API endpoints.
- Scope registry (`src/mp_server/auth/scope_registry.py`) as the single source of truth for scope definitions and role-to-scope mappings.
- `ScopeAccessEnforcer` that checks the current user's scopes against endpoint requirements at request time.
- `current_scope_keys_var` context variable populated during authentication.
- DB-backed role-scope assignments via `role_scope` table for custom roles.
- Scope API endpoints under the `Scope` tag:
  - `GET /api/v1/scope` — list all scopes from the registry.
  - `GET /api/v1/role_scope` — merged role-to-scope mappings (registry + DB).
  - `GET /api/v1/role_scope_entry` — paginated list of DB role-scope assignments.
  - `POST /api/v1/role_scope_entry` — assign a scope to a role.
  - `GET /api/v1/role_scope_entry/{id}` — retrieve a single assignment.
  - `DELETE /api/v1/role_scope_entry/{id}` — remove an assignment.
  - `PUT /api/v1/role/{id}/scope` — sync all scopes for a role (diff-based: adds missing, removes extra, keeps unchanged).
  - `GET /api/v1/role/{id}/scope` — list scope keys assigned to a role.
- `RoleScopeRepository`, `role_scope_service`, and `ScopeController` for CRUD operations.
- `get_scopes_for_roles_with_db()` merges Python registry and DB-persisted scopes during authentication.
- Default role-scope seed data (`role_scope.yaml`) — 122 entries for admin, provider, and integration roles.
- `GET /api/v1/current_user` response now includes `scopes` array with the user's effective scope keys.
- Scope documentation (`docs/scopes.md`).

### Changed

- All 16 controller files (~75 decorated methods) migrated from `@require_roles` to `@require_scopes`.
- `AuthHandler.validate_bearerauth` now resolves scopes from roles via both registry and DB, and sets them on the request context.
- `APIFacade` wires the new `ScopeAccessEnforcer` after the existing `RoleAccessEnforcer`.

---

## [0.22.12] — 2026-03-02

### Added

- Seeder environment-specific overrides: seed data files now live under `data/default/` and can be selectively overridden per environment (`data/testing/`, `data/staging/`, `data/development/`, `data/local/`). The `ENV` variable controls which override folder is used. Environment files merge by record `id` — matching ids replace the default, new ids are appended, and unmatched defaults are kept. Tables that only exist in an environment folder (no default file) are also seeded.
- Environment seed data for `testing` (provider, responder, integration users, active device with completed registration), `staging`, `development`, and `local` (team admin users with editor access on root folder).
- Seeder documentation (`docs/seeder.md`).

### Changed

- Default seed data stripped to bare minimum: one admin user, one role binding, root folder with owner permission, and all enum/reference tables. Environment-specific users and data moved to their respective override folders.

---

## [0.22.11] — 2026-03-02

### Fixed

- Workflow simulation (`POST /api/v1/event_subscription/{id}/test`) returned HTTP 500 when a node failed during the dry run. The error was caught and logged but then re-raised, propagating through the controller as an unhandled exception. Simulation mode now catches the error, records it in the node summary with `status: "failed"` and the error message, and returns the partial result so front-end developers can see which node failed and why. Errors like `TypeError: '>' not supported between instances of 'NoneType' and 'int'` (from an unresolved `var` path) now surface clearly in the response instead of crashing the endpoint.
- `EmailService` SMTP sequence was missing the required `EHLO` commands. Added `EHLO` before `STARTTLS` (announce over plaintext) and after (re-announce over TLS), matching the SMTP spec. Some stricter servers would reject the `STARTTLS` command without a prior `EHLO`.

### Changed

- `EmailService` refactored: removed the `encryption` config toggle — now always uses STARTTLS. Added module, class, and method docstrings. Switched from f-string logging to structured dict logging. HTML-escaped `token` and `expires_at` in the password reset template to prevent XSS injection.

---

## [0.22.10] — 2026-03-02

### Added

- Questionnaire submission event enrichment: `medipal.submission.created` and `medipal.submission.anonymous_created` events now include `variables_by_name` and `functions_by_name` lookups in `event.data.answers.scoring`, re-indexing UUID-keyed variables and list-based functions by their human-readable `name`. This allows workflow JSONLogic expressions to reference scoring variables by name (e.g. `{"var": "event.data.answers.scoring.variables_by_name.bmi.value"}`) instead of requiring the internal UUID key. The original UUID-keyed `variables` and index-based `functions` are preserved unchanged. Events without a `scoring` block are not affected.

### Fixed

- `WorkflowRunNode.input` and `WorkflowRunNode.output` were always `null` in the database for most node types, making past runs impossible to debug.
  - **Compute nodes** now record `{"logic": <expression>}` as `input` so developers can see what JSONLogic was evaluated.
  - **Delay nodes** now record `{"delay_ms": <value>}` as `input`.
  - **Action nodes** already recorded input on success, but on plugin failure the resolved input was lost because the exception discarded the return value. Now pre-captured before dispatch so it survives failures.
  - **Failed nodes** of any type now persist their pre-captured `input` alongside the error, so developers can see what data was being processed when the failure occurred. Previously `_update_node_failed` only stored the error string.
- Workflow introspection controller methods (`api_v1_workflow_run_id_context_post`, `api_v1_workflow_evaluate_post`) used `request.get()` dict access on generated Pydantic request models, causing `AttributeError: 'ApiV1WorkflowRunIdContextPostRequest' object has no attribute 'get'`. Updated to use typed attribute access.

### Changed

- `docs/workflows.md` updated with new sections for debugging & introspection endpoints (sections 12–13), node input documentation by type, context snapshots in simulation responses, questionnaire submission scoring enrichment with usage examples, and a "Discovering Available Paths" guide.

---

## [0.22.9] — 2026-03-02

### Added

- Workflow debugging and introspection features for front-end developers building workflow node chains:
  - `POST /api/v1/workflow_run/{id}/context` — reconstruct the full workflow context at any node position in a past run. Returns the data structure and all available dot-notation variable paths for JSONLogic `{"var": "..."}` expressions. Requires `admin` or `integration` role.
  - `POST /api/v1/workflow/evaluate` — sandbox for testing JSONLogic expressions without running a full workflow. Supports two modes: direct (provide data inline) or from-run (reference a past workflow run and node key to auto-reconstruct the context). Returns the evaluation result, the data used, and available variable paths. Requires `admin` or `integration` role.
  - `extract_var_paths()` utility (`mp_server.events.workflow.path_utils`) — recursively walks nested dicts and returns all reachable dot-notation paths. Lists of dicts are merged by key (no numeric indices) so the front-end sees structural shape.
  - `reconstruct_node_context()` and `evaluate_expression()` service methods on `EventWorkflowService`.

### Improved

- Workflow simulation (`POST /api/v1/event_subscription/{id}/test`) now includes `context` and `available_paths` in each per-node summary. The context snapshot is captured **before** each node executes, showing exactly what data was available at that point — including for skipped nodes. This is backwards-compatible (extra keys on the existing `nodes` list items).

---

## [0.22.8] — 2026-03-01

### Improved

- `reconstruct_snapshot` now catches `TypeError`, `KeyError`, `AttributeError`, and `pydantic.ValidationError` alongside the existing JSON Patch exceptions, preventing 500s from corrupted or malformed revision data.
- `reconstruct_snapshot` guards metadata iteration: non-dict `metadata_changes` and non-dict individual change entries are logged and skipped instead of crashing.
- Revision patches with no `ops` key are logged as warnings and skipped instead of silently applying a no-op.
- Query validation error handler now uses defensive `getattr` for `allowed_values` and `field`, protecting against subclasses or mocks that skip `__init__`.
- All `QueryValidationError` raise sites in the query compiler now include the `field` kwarg: `_apply_joins` (join not defined), `_compile_condition` (`in`, `not_in`, `between` value-type checks), and the unhandled-operator fallback.

---

## [0.22.7] — 2026-03-01

### Improved

- Query validation error responses now include structured `details` with `field` and `allowed_values`, so callers can see exactly which fields/operators are valid instead of guessing.

### Added

- `docs/list-endpoints.md` — front-end integration guide covering pagination, sorting, filtering, operators by column type, soft-delete controls, response shape, and validation errors.

---

## [0.22.6] — 2026-03-01

### Changed

- Standardised all `pylog.Logger` instance names to use dot-separated paths mirroring the module location under `mp_server/` (e.g. `Logger("questionnaire_service")` → `Logger("services.questionnaire")`, `Logger("SqlEngineFactory")` → `Logger("database.sql_engine_factory")`). Redundant type suffixes (`_controller`, `_service`, `_commands`, `_events`, `_store`, `_repo`) are dropped when the parent package already conveys the type.

### Fixed

- Workflow compute nodes now work correctly — the upstream `json-logic` package (0.6.3) used `dict.keys()[0]`, which is not valid in Python 3. Replaced with a patched local implementation at `mp_server.events.workflow._json_logic`.

---

## [0.22.5] — 2026-03-01

### Fixed

- `medipal.submission.created` and `medipal.submission.anonymous_created` events now include `answers` in the event data payload, containing the raw questionnaire answers submitted by the user. Previously only `submission_id` and `questionnaire_id` were emitted.

---

## [0.22.4] — 2026-03-01

### Added

- Questionnaire revision (change history) system: append-only log of RFC 6902 JSON Patch diffs recorded per mutation, enabling users to browse changes, inspect diffs, and restore to any previous state.
  - `GET /api/v1/questionnaire/{id}/revision` — paginated list of revisions with optional filters (`operation`, `created_by`, date ranges, sort).
  - `GET /api/v1/questionnaire/{id}/revision/{revision_id}` — single revision detail.
  - `GET /api/v1/questionnaire/{id}/revision/{revision_id}/snapshot` — reconstructed full questionnaire state at a specific revision point. Applies patches forward from the nearest anchor (parent snapshot or empty state).
- Revisions are recorded automatically for all questionnaire mutations: `EDIT`, `METADATA_EDIT`, `PUBLISH`, `FORK`, `DELETE`, `RESTORE`, `ARCHIVE`. No-op edits (nothing changed) are silently skipped for `EDIT` and `METADATA_EDIT`; lifecycle operations (`PUBLISH`, `FORK`, `DELETE`, `RESTORE`, `ARCHIVE`) are always recorded.
- `questionnaire_revision` database table with JSONB columns for `payload_patch`, `config_patch`, `schedule_payload_patch`, and `metadata_changes`. Monotonically increasing `sequence` per questionnaire and `lineage_root_id` for cross-fork history.
- `QuestionnaireRevisionRepository` with `get_next_sequence`, `get_revisions_up_to`, and `filter_and_paginate` methods.
- `questionnaire_revision_service` with `record_revision`, `record_fork`, `list_revisions_filtered`, `get_revision_or_error`, and `reconstruct_snapshot` functions.
- `QUESTIONNAIRE_REVISION_NOT_FOUND` error code (404).
- `jsonpatch` dependency added.

---

## [0.22.3] — 2026-02-28

### Added

- `POST /api/v1/plugin_instance/{id}/invoke` — execute an action on a configured plugin instance. Accepts an `action` name and optional `payload`, validates against the action's `input_schema`, and returns the plugin response. Requires `admin` or `integration` role.
- API endpoint schema-driven workflow documented in `CLAUDE.md` — covers file naming conventions, request/response body schemas, and the generated submodule policy (`mp_server_api`, `mp_server_pydantic_models`, `mp_server_sql_alchemy_models` must never be edited directly).

---

## [0.22.1] — 2026-02-28

### Added

- CloudEvents now published for all user lifecycle actions (`user.created`, `user.updated`, `user.deleted`, `user.password.changed`) and folder lifecycle actions (`folder.created`, `folder.updated`, `folder.deleted`). Event definitions existed but were never wired into the service methods.

### Fixed

- `test_encryption_service` mock used a flat `config.get("vault.encryption_key")` lookup, but the service does a two-step `config.get("vault").get("encryption_key")`. Updated `_mock_config` to return a nested dict matching the actual lookup.

---

## [0.22.0] — 2026-02-28

### Removed

- Superset and nginx reverse proxy services (`proxy`, `superset`, `superset_init`, `superset_db`) from all deployment compose files (`development`, `staging`, `testing`). Superset is now deployed separately. The `demo` and `main` files already had no Superset containers.
- `JWT_SECRET` fallback in `EncryptionService` — the service now requires `vault.encryption_key` (via `VAULT_ENCRYPTION_KEY` env var) with no fallback.
- Superset infrastructure env vars (16 variables) from the deploy workflow. Only the 5 token broker vars remain (`SUPERSET_BASE_URL`, `SUPERSET_WEBSERVER_BASEURL`, `SUPERSET_USERNAME`, `SUPERSET_PASSWORD`, `SUPERSET_PROVIDER`).
- "Build and push Superset image to ECR" and "Copy nginx.conf to EC2" steps from the deploy workflow.

### Added

- `VAULT_ENCRYPTION_KEY` — dedicated env var for vault encryption, replacing the reuse of `JWT_SECRET`.
- `FRONTEND_BASE_URL` — parameterised per environment (was hardcoded to the development URL).
- Token TTL env vars (`USER_ACCESS_TTL`, `USER_REFRESH_TTL`, `DEVICE_ACCESS_TTL`, `DEVICE_REFRESH_TTL`, `PASSWORD_RESET_TTL`) — previously hardcoded in `auth_config.yaml`.
- `SUPERSET_GUEST_TTL_SECONDS` — wired through as an env var (was hardcoded to `300`).
- Superset token broker vars and `SEED_DEFAULT_PASSWORD` added to `demo` and `main` compose files (were missing).
- SSH key cleanup step (`if: always()`) in the deploy workflow.
- `dotenv` loading in test `conftest.py` so new env vars are available without rebuilding the devcontainer.

### Changed

- `docker-compose.main.yaml` environment format normalised from `- KEY=VAL` list to `KEY: VAL` map style.
- `docker-compose.main.yaml` `ENV` corrected from `development` to `production`.
- App service in `development`, `staging`, and `testing` compose files changed from `expose: "8000"` (behind proxy) to direct `ports` binding.
- Deploy workflow: `appleboy/scp-action` pinned from `@master` to `@v0.1.7`.
- Deploy workflow: removed redundant `SIGIL_PAT`, `MEDIPAL_PAT`, `GITHUB_TOKEN` job-level env vars (accessed directly via `$&#123;&#123; secrets.* &#125;&#125;`).
- Deploy workflow: `FRONTEND_BASE_URL` set per branch (like `SUPERSET_WEBSERVER_BASEURL`).

---

## [0.21.44] — 2026-02-28

### Changed

- `EncryptionService` now falls back to the `JWT_SECRET` environment variable when `vault.encryption_key` is not set in the config store, so existing deployments continue to work without updating `app_config.yaml` first.
- Docker Compose stack simplified — removed the nginx reverse proxy and Apache Superset services (`proxy`, `superset`, `superset_init`, `superset_db`). The application port (`8000`) is now exposed directly from the `app` service. Added `adminer` for local database administration on port `8080`.
- `.devcontainer/setup-host` now quotes environment variable values in the generated `.env` file, preventing shell-interpretation issues with special characters.

---

## [0.21.36] — 2026-02-28

### Added

- `refresh_expires_at` and `refresh_expires_in` fields on all token-issuing endpoints: `POST /api/v1/auth/login/credentials`, `POST /api/v1/auth/login/azure_ad`, `POST /api/v1/auth/login/mfa/verify_login`, `POST /api/v1/auth/device/login`, and `POST /api/v1/auth/refresh`. Previously only the access token TTL was returned — clients had no way to know when the refresh token expired.
- Vault system: centralised, encrypted-at-rest store for secrets and variables.
  - `POST /api/v1/vault_entry` — create a vault entry. SECRET values are Fernet-encrypted (AES-128-CBC) before storage; VAR values are stored in plaintext.
  - `GET /api/v1/vault_entry` — list vault entries with `kind`, `key`, `enabled`, `search`, `sort_by`, and `sort_dir` filters, plus pagination.
  - `GET /api/v1/vault_entry/{id}` — retrieve a single vault entry. SECRET values are masked as `"******"`.
  - `PATCH /api/v1/vault_entry/{id}` — partial update. Re-encrypts the value automatically when kind is SECRET. Re-checks key uniqueness when the key changes.
  - `DELETE /api/v1/vault_entry/{id}` — soft-delete a vault entry.
- `$secret:<key>` and `$var:<key>` reference syntax for vault entries. References are resolved at runtime in:
  - **Plugin instance configs** (`config_json`) — replaces the TODO at `plugin_service.py:233`.
  - **Workflow input mappings** — runs as a second pass after JSONLogic evaluation.
- `EncryptionService` — Fernet-based encrypt/decrypt using the `CONFIG_ENCRYPTION_KEY` environment variable. Fails fast at construction if the key is missing.
- `VaultEntryResolver` — recursively scans dicts and lists for `$secret:<key>` / `$var:<key>` references, batch-loads entries, decrypts secrets, and replaces in a single pass. Raises `ValueError` for missing or disabled entries.
- `VaultEntry` database table and Alembic migration with partial unique index on `key` (where `deleted_at IS NULL`).
- `VaultEntryRepository` (`get_by_key`) added to `UnitOfWork`.
- Error codes: `VAULT.NOT_FOUND` (404), `VAULT.KEY_EXISTS` (409), `VAULT.DISABLED` (422), `VAULT.RESOLVE_FAILED` (422).
- All vault endpoints require `admin` or `integration` role.
- `docs/vault.md` — front-end integration guide covering all endpoints, reference syntax, plugin config and workflow examples, environment setup, and UI considerations.

### Fixed

- `WorkflowExecutor` failed with `Field required [type=missing]` for `attempts` when creating `WorkflowRunNode` records. The entity schema declared `default: 0` but the code generator did not carry it into the Pydantic model. Added explicit `attempts=0` at the call site in `executor.py`.
- `WorkflowExecutor._dispatch_node` compared node types as lowercase (`"action"`, `"end"`, etc.) but the database stores them as uppercase (`"ACTION"`, `"END"`). All nodes were silently skipped as "unknown". Fixed by normalizing with `.lower()` before comparison.
- `SubscriptionRouter` called `executor.execute()` synchronously inside the async event loop. Plugins that use `asyncio.run()` internally (e.g. the SMTP email plugin with aiosmtplib) crashed with `RuntimeError: asyncio.run() cannot be called from a running event loop`. Fixed by running the executor via `run_in_threadpool()` so each plugin gets a clean thread with no active loop.
- `QueryValidationError` (e.g. unsupported sort field) was not caught by the global error handler, resulting in a 500 Internal Server Error. Added a dedicated handler that returns 400 with the validation message.

### Changed

- `EncryptionService` now reads its key from `vault.encryption_key` in `app_config.yaml` via the config store instead of the `CONFIG_ENCRYPTION_KEY` environment variable.
- `EncryptionService` now accepts any arbitrary string as encryption key (e.g. `JWT_SECRET`) and derives a valid Fernet key from it via SHA-256 + base64url encoding. Previously the configured value had to be a valid 44-character Fernet key, which meant reusing existing secrets like `JWT_SECRET` would fail at startup.
- Workflow error logs now include full context: `subscription_name`, `event_type`, `event_subject`, `node_count`, `error_type`, and full Python traceback. Previously only `subscription_id`, `event_id`, and a truncated `str(exc)` were logged, making failures difficult to diagnose.

---

## [0.21.34] — 2026-02-28

### Added

- `docs/workflows.md` — comprehensive front-end integration guide covering all workflow, plugin, and event subscription endpoints. Includes request/response shapes, node type reference (ACTION, COMPUTE, SWITCH, JOIN, DELAY, END), execution engine internals, JSONLogic context structure, event processing pipeline, and UI considerations.

---

## [0.21.33] — 2026-02-27

### Added

- `GET /api/v1/folder_tree` — permission-resolved folder hierarchy with nested questionnaires. Supports `include_questionnaires`, `questionnaire_status_id`, and `include_archived` query parameters. Questionnaire nodes include all fields except `payload`, `schedule_payload`, and `config`.
- `sort_by` and `sort_dir` query parameters on all 21 list endpoints for server-side sorting.
- Entity-specific filters across all list endpoints:
  - **Refresh tokens**: `device_id`, `auth_path`, `expires_at_gte/lte`
  - **Enrollments**: `enrollment_start_date_gte/lte`, `enrollment_end_date_gte/lte`
  - **Devices**: `name`, `model`, `app_version`, `device_status_id`, `device_type_id`, `last_connection_date_gte/lte`, `search`
  - **Folders**: `creator_user_id`, `search`
  - **Users**: `mfa_enabled`, `force_password_change`, `ext_id`, `search`, `created_at_gte/lte`
  - **Roles**: `name`, `search`
  - **User roles**: `granted_by_user_id`, `granted_at_gte/lte`
  - **Questionnaires**: `name`, `owner_id`, `search`
  - **Questionnaire submissions**: `enrollment_id`, `created_at_gte/lte`
  - **Folder permissions**: `permission_access_level_id`, `recursive`
  - **Questionnaire permissions**: `permission_access_level_id`
  - **Plugin definitions**: `plugin_key`, `name`, `search`
  - **Plugin instances**: `search`
  - **Event definitions**: `search`
  - **Event delivery tasks**: `created_at_gte/lte`, `next_attempt_at_gte/lte`, `done_at_gte/lte`
  - **Event subscriptions**: `name`, `search`
  - **Workflow runs**: `event_type`, `started_at_gte/lte`, `completed_at_gte/lte`
  - **Webhooks**: `name`, `url`, `search`
  - **Webhook deliveries**: `status`, `event_type`, `http_status`, `http_status_gte/lte`, `delivered_at_gte/lte`

### Changed

- `GET /api/v1/workflow_run` now supports `limit`/`offset` pagination (default 25/0) with `has_next`/`has_previous` in the response. Previously hardcoded to 250 results.
- `GET /api/v1/webhook/{id}/delivery` now uses `filter_and_paginate` with full filter support instead of in-memory slicing.
- Legacy adapter extracts `sort_by`/`sort_dir` from filter dicts and converts them to `SortSpec` for the query compiler.
- Event definition listing supports in-memory text search and configurable sort direction.

---

## [0.21.32] — 2026-02-27

### Changed

- `GET /api/v1/event_delivery_task` now supports `limit` and `offset` query parameters for pagination (default 25/0). Response includes `limit`, `offset`, `has_next`, and `has_previous` fields.

---

## [0.21.30] — 2026-02-27

### Changed

- `GET /api/v1/current_user` now returns `roles` (array of full role objects) instead of `role` (single nullable object), correctly reflecting that a user can hold multiple roles simultaneously.
- `get_roles_for_user(user_id)` extracted into `user_role_service` as a proper service function, removing direct `UnitOfWork` usage from the controller. The controller now delegates to `user_role_service.get_roles_for_user` in both `api_v1_current_user_get` and `api_v1_user_post`.

---

## [0.21.29] — 2026-02-27

### Added

- Webhook system: Stripe-style signed HTTP delivery of CloudEvents to external endpoints.
  - `POST /api/v1/webhook` — register a new webhook. Returns the full HMAC-SHA256 signing secret exactly once.
  - `GET /api/v1/webhook` — list webhooks with optional `enabled` filter and pagination.
  - `GET /api/v1/webhook/{id}` — retrieve a single webhook (secret replaced with 4-character hint).
  - `PATCH /api/v1/webhook/{id}` — update name, url, event_types, description, or enabled flag.
  - `DELETE /api/v1/webhook/{id}` — soft-delete a webhook.
  - `POST /api/v1/webhook/{id}/rotate_secret` — regenerate the signing secret; new secret returned once.
  - `GET /api/v1/webhook/{id}/delivery` — paginated delivery history.
  - `GET /api/v1/webhook/{id}/delivery/{delivery_id}` — single delivery record detail.
  - `POST /api/v1/webhook/{id}/delivery/{delivery_id}/retry` — reset a failed delivery to PENDING for immediate retry.
- `WebhookDispatcher` fans out CloudEvents to all matching registered webhooks on every outbox drain. Each delivery attempt is HMAC-SHA256 signed (`X-Signature`, `X-Timestamp`, `X-Event-Type`, `X-Webhook-ID`, `X-Delivery-ID` headers).
- Exponential backoff retry strategy: `next_attempt_at = now + 30 × 2ⁿ` seconds (30s, 60s, 120s, 240s, 480s); deliveries are marked FAILED after 5 attempts.
- Scheduler job `webhook_retry_job` (30-second interval) picks up PENDING deliveries via `SELECT FOR UPDATE SKIP LOCKED` and re-attempts them without blocking other scheduler instances.
- `Webhook` and `WebhookDelivery` DB tables and Alembic migration.
- `WebhookRepository` (`get_enabled_for_event_type` with JSONB containment check) and `WebhookDeliveryRepository` (`lock_pending_batch`) added to `UnitOfWork`.
- All webhook endpoints require `admin` or `integration` role.

### Changed

- `OutboxWorker` now also calls `WebhookDispatcher.dispatch(event)` for every drained CloudEvent, alongside the existing `SubscriptionRouter`.
- CloudEvents are now fired for all questionnaire and submission lifecycle actions: `questionnaire.created`, `questionnaire.updated`, `questionnaire.published`, `questionnaire.deleted`, `questionnaire.restored`, `questionnaire.archived`, `submission.created`, `submission.anonymous_created`, `submission.updated`, `submission.deleted`.

### Fixed

- `WebhookService.list_deliveries`: `model_validate` was called on ORM objects after the `UnitOfWork` session closed, causing `DetachedInstanceError`. Conversion to Pydantic models now happens inside the session.

---

## [0.21.28] — 2026-02-26

### Added

- `GET /docs/changelog` endpoint serving `CHANGELOG.md` as a rendered HTML page (via marked.js, no server-side dependencies).
- Changelog link added to the OpenAPI description, visible in Swagger UI and ReDoc.
- `CHANGELOG.md` introduced at the project root.

### Changed

- All public functions in `questionnaire_submission_service` now have complete docstrings (summary, Args, Returns, Raises) per project standards.
- `sql_session_factory` — added an explanatory comment for `autoflush=False`, clarifying that flush/commit lifecycle is managed explicitly by `UnitOfWork` rather than triggered implicitly before queries.

---

## [0.21.27] — 2026-02-26

### Fixed

- `tenant_id` in `POST /api/v1/auth/device/register` response was hardcoded to a literal string; it now reads from `app_config.yaml` via `get_config("app").tracker.tenant_id`.
- `questionnaire_submission_service` raised `ConflictError` with an `AUTH_UNAUTHORIZED` error code when a non-anonymous submission was attempted without a user ID. Changed to `UnauthorizedError` so the HTTP status (401) and error type are consistent.

---

## [0.21.26] — 2026-02-25

### Added

- `GET /api/v1/current_user` now includes a `role` field in the response — the full role object (id, key, name, description, is_system, is_enabled) for the user's first assigned role, or `null` if no role is assigned.
- Testing-only `POST /testing/reset-db` endpoint: wipes the database, runs all Alembic migrations, and re-seeds with default data. Only registered and reachable when `ENV=testing`. Protected by `X-API-Key` header.

---

## [0.21.25] — 2026-02-25

### Added

- Admin observer endpoints for event and workflow monitoring:
  - `GET /api/v1/event_delivery_task` — list outbox tasks with optional `status` and `target` filters (admin only).
  - `GET /api/v1/workflow_run` — list workflow runs, filterable by `event_subscription_id` and `status`.
  - `GET /api/v1/workflow_run/{id}` — retrieve a single workflow run by ID.
  - `GET /api/v1/workflow_run/{id}/node` — list all node execution records for a run.

---

## [0.21.24] — 2026-02-24

### Changed

- Seeder improvements: default data and seed ordering updated.

---

## [0.21.23] — 2026-02-24

### Fixed

- `TypeError: Object of type datetime is not JSON serializable` on all event-publishing paths. Root cause was `event.model_dump()` in `outbox.py` when building the outbox message — changed to `model_dump(mode="json")` to produce ISO-string timestamps instead of raw `datetime` objects.
- Same fix applied to `WorkflowContext.to_logic_data()` and `WorkflowExecutor` when storing `trigger_event` in the `workflow_run` JSONB column.

---

## [0.21.22] — 2026-02-24

### Changed

- Workflow executor: plugin action node output is now round-tripped through `json.loads(json.dumps(..., default=str))` before storing in the `workflow_run_node.output` JSONB column, preventing serialization failures from non-JSON-native plugin responses.

---

## [0.21.21] — 2026-02-24

### Added

- Workflow execution engine (`src/mp_server/events/workflow/`):
  - `WorkflowContext` — in-memory data structure carrying the triggering CloudEvent and accumulated node outputs, with `to_logic_data()` for JSONLogic evaluation.
  - `WorkflowExecutor` — topological (Kahn's algorithm) graph traversal supporting action, compute, delay, switch, join, and end node types. Shared code path for real and simulation runs.
  - `SubscriptionRouter` — matches incoming CloudEvents to active `EventSubscription` records, evaluates source/subject/condition filters, and invokes the executor per match. Failures are best-effort (logged, not re-raised).
  - `node_validator` — validates node `config` dicts against typed Pydantic models before saving to the database.
  - `input_mapping` — resolves `input_mapping` fields via JSONLogic against the workflow context.
- `WorkflowRun` and `WorkflowRunNode` DB tables for tracking execution state and per-node results.
- `WorkflowRunRepository` and `WorkflowRunNodeRepository` added to `UnitOfWork`.
- `EventWorkflowService` fixes:
  - Added missing `patch_subscription_or_error` wrapper (previously called by the controller but not defined).
  - `replace_graph` now validates each node's `config` before persisting.
  - `simulate()` replaced with a real dry-run executor (no DB writes, no plugin calls, full graph traversal).
- `OutboxWorker` updated to call `SubscriptionRouter.route(event)` for every drained event after local handlers complete.

---

## [0.21.20] — 2026-02-24

### Added

- CloudEvents emitted for all major domain actions: user created/updated/deleted, questionnaire published/archived, and questionnaire submission created/updated.

---

## [0.21.19] — 2026-02-24

### Changed

- Events system refactored: cleaner separation between event definitions, subscriptions, and delivery.

---

## [0.21.18] — 2026-02-24

### Changed

- Makefile restructured and CLI commands reorganised for clearer developer workflow.

---

## [0.21.17] — 2026-02-24

### Added

- `EventDeliveryTask` service and repository for tracking outbox message delivery state.
- Outbox worker (`OutboxWorker`) with polling loop, drain-and-dispatch logic, and DONE/FAILED status updates.
- Tests for event delivery task and outbox behaviour.

---

## [0.21.16] — 2026-02-24

### Changed

- Questionnaire controller: pagination, filtering, and response shape improvements.

---

## [0.21.15] — 2026-02-24

### Added

- Stamp audit fields (`updated_at`, `updated_by`) now written on all mutation operations across the main domain entities.

---

## [0.21.14] — 2026-02-24

### Added

- `ip_address` and `user_agent` captured at login and stored on `RefreshToken` records for audit purposes.

---

## [0.21.12] — 2026-02-24

### Added

- `DELETE /api/v1/auth/device/{id}` — remove a registered device.
- `GET /api/v1/refresh_token` and `GET /api/v1/refresh_token/{id}` — list and inspect issued refresh tokens.
- `DELETE /api/v1/refresh_token/{id}` — revoke a refresh token.
- Refresh token revocation strategy: revoking a token also marks all child tokens (issued via refresh) as revoked.

---

## [0.21.11] — 2026-02-24

### Added

- `RefreshToken` Alembic migration, service, and repository. Refresh tokens are now persisted to the database and validated on the `/auth/refresh` endpoint.

---

## [0.21.10] — 2026-02-24

### Changed

- Submodule updates (`mp-server-api`, `mp-server-pydantic-models`, `mp-server-sql-alchemy-models`).

---

> Changelog tracking started at v0.21.10 (2026-02-24). Earlier versions are not documented here.
