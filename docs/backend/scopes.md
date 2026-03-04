# Scope-Based Access Control

## Overview

The scope system provides fine-grained authorization for API endpoints. Each
endpoint declares the scope it requires via the `@require_scopes` decorator,
and each role maps to a set of scopes. Enforcement checks the user's effective
scopes at request time.

**Key design decisions:**

- The Python registry defines all valid scopes and built-in role mappings
- Custom role-scope assignments are stored in the `role_scope` database table
- Effective scopes are the union of registry mappings and DB assignments
- Scopes use the `resource:action` naming convention (e.g. `user:read`)
- A fixed 5-action matrix (`read | write | delete | manage | execute`) across 17 resources = 85 scopes
- Roles are organizational groupings that map to sets of scopes

## Architecture

```
User authenticates (JWT)
  → AuthHandler resolves role keys from user_role table
  → AuthHandler resolves scopes from role keys via Python registry + DB
  → current_scope_keys_var set on context
  → ScopeAccessEnforcer reads @require_scopes metadata from handler
  → Checks current scopes satisfy the requirement
  → Request proceeds or 403
```

## Registry Location

All scope and role-scope definitions live in:

```
src/mp_server/auth/scope_registry.py
```

## How to Add a New Scope

All 85 scopes (17 resources x 5 actions) are pre-defined. To add a new
**resource**, add 5 entries to the `SCOPES` dict (one per action):

```python
SCOPES = {
  # ...existing scopes...
  "my_resource:read":    {"name": "Read my resource",    "description": "..."},
  "my_resource:write":   {"name": "Write my resource",   "description": "..."},
  "my_resource:delete":  {"name": "Delete my resource",  "description": "..."},
  "my_resource:manage":  {"name": "Manage my resource",  "description": "..."},
  "my_resource:execute": {"name": "Execute my resource", "description": "..."},
}
```

Then adjust the exclusion sets if the new resource should not be available
to all roles.

## How to Add a New Role

**Option 1: Built-in role (Python registry)**

Add the role key and its scope set to `ROLE_SCOPES` in `scope_registry.py`:

```python
ROLE_SCOPES = {
  # ...existing roles...
  "my_role": ALL_SCOPE_KEYS - frozenset({"scope:to:exclude"}),
}
```

**Option 2: Custom role (database)**

1. Create the role via `POST /api/v1/role`
2. Assign scopes via `POST /api/v1/role_scope_entry`:

```json
{
  "role_id": "<role-uuid>",
  "scope_key": "user:read"
}
```

DB-assigned scopes are merged with any built-in registry mappings for the same role.

## Decorator Usage

```python
from mp_server.auth.decorators import require_scopes

# Require a single scope
@require_scopes("user:read")

# Require any of multiple scopes (default mode="any")
@require_scopes("user:read", "user:write")

# Require all scopes
@require_scopes("user:read", "folder:read", mode="all")
```

## Default Roles

| Role          | Scopes | Summary                                                                       |
| ------------- | ------ | ----------------------------------------------------------------------------- |
| `admin`       | All 85 | Full access to everything.                                                    |
| `provider`    | 72     | Everything except vault, webhooks, workflow authoring, and auth admin.        |
| `integration` | 84     | Everything except auth admin. Designed for system-to-system API keys.         |
| `responder`   | 0      | No scopes. All responder actions (login, submit, consent) use open endpoints. |

### Endpoints open to all authenticated users (no scope required)

These endpoints use bearer auth but do **not** check scopes. Every role
(including responder) can call them.

| Endpoint                                   | Description                                     |
| ------------------------------------------ | ----------------------------------------------- |
| `POST /auth/login/credentials`             | Log in with email + password                    |
| `POST /auth/login/azure_ad`                | Log in via Azure AD                             |
| `POST /auth/login/mfa_verify`              | Complete MFA challenge                          |
| `POST /auth/refresh`                       | Refresh an access token                         |
| `POST /auth/password_reset/request`        | Request password reset email                    |
| `POST /auth/password_reset/confirm`        | Confirm password reset                          |
| `POST /auth/mfa/setup`                     | Set up MFA (TOTP)                               |
| `POST /auth/mfa/verify`                    | Verify MFA code                                 |
| `PATCH /auth/mfa/enable`                   | Enable MFA for current user                     |
| `POST /auth/device/login`                  | Complete device login (uses registration token) |
| `POST /auth/device/consent`                | Record device consent                           |
| `GET /current_user`                        | Get current user profile, roles, and scopes     |
| `POST /user/change_password`               | Change own password                             |
| `GET /config`                              | Get public app config                           |
| `GET /config/questionnaire/{id}`           | Get effective config for a questionnaire        |
| `POST /questionnaire_submission`           | Submit a questionnaire (authenticated)          |
| `POST /questionnaire_submission/anonymous` | Submit anonymously (API key only)               |
| `POST /enrollment_consent`                 | Give consent to an enrollment                   |
| `GET /enrollment_fetch`                    | Fetch own enrollments with questionnaires       |

### `responder` — 0 scopes

Responders are end-users (patients, participants) who log in, view assigned
content, and submit responses. **All responder actions use open endpoints**
(see table above) — no scopes are required. This means responders cannot access
any administrative list/detail endpoints like `GET /questionnaire`,
`GET /folder`, `GET /device`, etc.

### `provider` — 72 scopes (all minus 13 excluded)

Providers are clinicians, researchers, or content managers. They can manage
users, content, enrollments, devices, events, plugins, and workflows — but
cannot access vault secrets, webhooks, author workflows, or administer auth.

**Excluded scopes (13):** `vault:*` (5), `webhook:*` (5), `workflow:write`,
`workflow:execute`, `auth:manage`

| Scope                           | Endpoints it unlocks                                                                                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user:read`                     | `GET /user`, `GET /user/{id}`, `GET /user_role`, `GET /user_role/{id}`, `GET /role`, `GET /role/{id}`, `GET /scope`, `GET /role_scope`, `GET /role_scope_entry`, `GET /role_scope_entry/{id}`, `GET /role/{id}/scope` |
| `user:write`                    | `POST /user`, `PATCH /user/{id}`, `POST /user_role`, `POST /role`, `PATCH /role/{id}`, `POST /role_scope_entry`, `DELETE /role_scope_entry/{id}`, `PUT /role/{id}/scope`                                              |
| `user:delete`                   | `DELETE /user/{id}`, `DELETE /user_role/{id}`, `DELETE /role/{id}`                                                                                                                                                    |
| `questionnaire:read`            | `GET /questionnaire`, `GET /questionnaire/{id}`, `GET /questionnaire/{id}/revision`, `GET /questionnaire/{id}/revision/{id}`, `GET /questionnaire/{id}/revision/{id}/snapshot`, `GET /questionnaire/deleted`          |
| `questionnaire:write`           | `POST /questionnaire`, `PATCH /questionnaire/{id}`, `POST /questionnaire/{id}/restore`                                                                                                                                |
| `questionnaire:delete`          | `DELETE /questionnaire/{id}`                                                                                                                                                                                          |
| `questionnaire:manage`          | `POST /questionnaire/{id}/publish`                                                                                                                                                                                    |
| `folder:read`                   | `GET /folder`, `GET /folder/{id}`, `GET /folder/tree`                                                                                                                                                                 |
| `folder:write`                  | `POST /folder`, `PATCH /folder/{id}`                                                                                                                                                                                  |
| `folder:delete`                 | `DELETE /folder/{id}`                                                                                                                                                                                                 |
| `permission:read`               | `GET /folder_permission`, `GET /questionnaire_permission`                                                                                                                                                             |
| `permission:write`              | `POST /folder_permission`, `PATCH /folder_permission/{id}`, `POST /questionnaire_permission`, `PATCH /questionnaire_permission/{id}`                                                                                  |
| `permission:delete`             | `DELETE /folder_permission/{id}`, `DELETE /questionnaire_permission/{id}`                                                                                                                                             |
| `questionnaire_submission:read` | `GET /questionnaire_submission`                                                                                                                                                                                       |
| `enrollment:read`               | `GET /enrollment`, `GET /enrollment/{id}`, `GET /enrollment_user`                                                                                                                                                     |
| `enrollment:write`              | `POST /enrollment`, `PATCH /enrollment/{id}`, `DELETE /enrollment/{id}`                                                                                                                                               |
| `device:read`                   | `GET /device`, `GET /device/{id}`                                                                                                                                                                                     |
| `device:delete`                 | `DELETE /device/{id}`                                                                                                                                                                                                 |
| `config:read`                   | `GET /config/folder/{id}`                                                                                                                                                                                             |
| `event_subscription:read`       | `GET /event_subscription`, `GET /event_subscription/{id}`, `GET /event_definition`, `GET /event_delivery_task`                                                                                                        |
| `event_subscription:write`      | `POST /event_subscription`, `PATCH /event_subscription/{id}`                                                                                                                                                          |
| `event_subscription:delete`     | `DELETE /event_subscription/{id}`                                                                                                                                                                                     |
| `workflow:read`                 | `GET /event_subscription/{id}/graph`, `GET /workflow_run`, `GET /workflow_run/{id}`, `GET /workflow_run/{id}/node`                                                                                                    |
| `plugin:read`                   | `GET /plugin_definition`, `GET /plugin_instance`, `GET /plugin_instance/{id}`                                                                                                                                         |
| `plugin:write`                  | `POST /plugin_instance`, `PATCH /plugin_instance/{id}`, `DELETE /plugin_instance/{id}`, `POST /plugin_instance/{id}/invoke`                                                                                           |
| `analytics:read`                | `GET /analytics/dashboard/superset/embedded_uuid/embed`                                                                                                                                                               |

Provider also has all `*:manage` and `*:execute` scopes for resources not in the
excluded list — these are reserved for future use.

### `integration` — 84 scopes (all minus `auth:manage`)

Integration is for system-to-system API keys. It has full access to every
resource including vault and webhooks, but cannot administer MFA, device
registration, API keys, or refresh tokens.

**Same as admin except:** no `auth:manage` — so no access to
`POST /auth/device/register`, `GET/DELETE /refresh_token`, or `POST/GET/DELETE /api_key`.

### `admin` — all 85 scopes

Full access. In addition to everything provider and integration can do, admin
also has:

| Scope              | Endpoints it unlocks                                                                                                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vault:read`       | `GET /vault_entry`, `GET /vault_entry/{id}`                                                                                                                                               |
| `vault:write`      | `POST /vault_entry`, `PATCH /vault_entry/{id}`                                                                                                                                            |
| `vault:delete`     | `DELETE /vault_entry/{id}`                                                                                                                                                                |
| `webhook:read`     | `GET /webhook`, `GET /webhook/{id}`, `GET /webhook/{id}/delivery`, `GET /webhook/{id}/delivery/{id}`                                                                                      |
| `webhook:write`    | `POST /webhook`, `PATCH /webhook/{id}`, `POST /webhook/{id}/rotate_secret`, `POST /webhook/{id}/delivery/{id}/retry`                                                                      |
| `webhook:delete`   | `DELETE /webhook/{id}`                                                                                                                                                                    |
| `workflow:write`   | `PUT /event_subscription/{id}/graph`                                                                                                                                                      |
| `workflow:execute` | `POST /event_subscription/{id}/test`, `POST /workflow_run/{id}/context`, `POST /workflow/evaluate`                                                                                        |
| `auth:manage`      | `POST /auth/device/register`, `GET /refresh_token`, `GET /refresh_token/{id}`, `DELETE /refresh_token/{id}`, `POST /api_key`, `GET /api_key`, `GET /api_key/{id}`, `DELETE /api_key/{id}` |

## Scope Catalogue (17 resources x 5 actions = 85 scopes)

Every resource has all five actions defined. Scopes marked **active** are
currently enforced by at least one controller. Scopes marked _reserved_ exist
in the registry but are not yet used — they are available for future features
or frontend gating.

### `user` — Users, roles, and role assignments

| Scope          | Status     | Description                                       |
| -------------- | ---------- | ------------------------------------------------- |
| `user:read`    | **active** | List and view users, roles, and role assignments. |
| `user:write`   | **active** | Create and update users, roles, and assignments.  |
| `user:delete`  | **active** | Delete users, roles, and role assignments.        |
| `user:manage`  | _reserved_ | Administrative user management operations.        |
| `user:execute` | _reserved_ | Reserved for future user-related actions.         |

### `questionnaire` — Questionnaires, revisions, and snapshots

| Scope                   | Status     | Description                                             |
| ----------------------- | ---------- | ------------------------------------------------------- |
| `questionnaire:read`    | **active** | List and view questionnaires, revisions, and snapshots. |
| `questionnaire:write`   | **active** | Create, update, and restore questionnaires.             |
| `questionnaire:delete`  | **active** | Delete questionnaires.                                  |
| `questionnaire:manage`  | **active** | Publish questionnaires.                                 |
| `questionnaire:execute` | _reserved_ | Reserved for future questionnaire actions.              |

### `folder` — Folders and folder tree

| Scope            | Status     | Description                                 |
| ---------------- | ---------- | ------------------------------------------- |
| `folder:read`    | **active** | List and view folders and folder tree.      |
| `folder:write`   | **active** | Create and update folders.                  |
| `folder:delete`  | **active** | Delete folders.                             |
| `folder:manage`  | _reserved_ | Reserved for future folder management.      |
| `folder:execute` | _reserved_ | Reserved for future folder-related actions. |

### `permission` — Folder and questionnaire permissions

| Scope                | Status     | Description                                             |
| -------------------- | ---------- | ------------------------------------------------------- |
| `permission:read`    | **active** | List and view folder and questionnaire permissions.     |
| `permission:write`   | **active** | Create and update folder and questionnaire permissions. |
| `permission:delete`  | **active** | Delete folder and questionnaire permissions.            |
| `permission:manage`  | _reserved_ | Reserved for future permission management.              |
| `permission:execute` | _reserved_ | Reserved for future permission actions.                 |

### `questionnaire_submission` — Questionnaire submissions

| Scope                              | Status     | Description                                |
| ---------------------------------- | ---------- | ------------------------------------------ |
| `questionnaire_submission:read`    | **active** | List and view questionnaire submissions.   |
| `questionnaire_submission:write`   | _reserved_ | Reserved for future submission writes.     |
| `questionnaire_submission:delete`  | _reserved_ | Reserved for future submission deletes.    |
| `questionnaire_submission:manage`  | _reserved_ | Reserved for future submission management. |
| `questionnaire_submission:execute` | _reserved_ | Reserved for future submission actions.    |

### `enrollment` — Enrollments

| Scope                | Status     | Description                                |
| -------------------- | ---------- | ------------------------------------------ |
| `enrollment:read`    | **active** | List and view enrollments.                 |
| `enrollment:write`   | **active** | Create and update enrollments.             |
| `enrollment:delete`  | **active** | Delete enrollments.                        |
| `enrollment:manage`  | _reserved_ | Reserved for future enrollment management. |
| `enrollment:execute` | _reserved_ | Reserved for future enrollment actions.    |

### `device` — Devices

| Scope            | Status     | Description                                 |
| ---------------- | ---------- | ------------------------------------------- |
| `device:read`    | **active** | List and view devices.                      |
| `device:write`   | **active** | Create and update devices.                  |
| `device:delete`  | **active** | Delete devices.                             |
| `device:manage`  | _reserved_ | Reserved for future device management.      |
| `device:execute` | _reserved_ | Reserved for future device-related actions. |

### `event_subscription` — Event subscriptions

| Scope                        | Status     | Description                            |
| ---------------------------- | ---------- | -------------------------------------- |
| `event_subscription:read`    | **active** | List and view event subscriptions.     |
| `event_subscription:write`   | **active** | Create and update event subscriptions. |
| `event_subscription:delete`  | **active** | Delete event subscriptions.            |
| `event_subscription:manage`  | _reserved_ | Reserved for future management.        |
| `event_subscription:execute` | _reserved_ | Reserved for future actions.           |

### `workflow` — Workflow runs and graphs

| Scope              | Status     | Description                                       |
| ------------------ | ---------- | ------------------------------------------------- |
| `workflow:read`    | **active** | List and view workflow runs and graphs.           |
| `workflow:write`   | **active** | Create and update workflow graphs.                |
| `workflow:delete`  | **active** | Delete workflow graphs.                           |
| `workflow:manage`  | _reserved_ | Reserved for future workflow management.          |
| `workflow:execute` | **active** | Trigger workflow evaluations and context updates. |

### `plugin` — Plugin definitions and instances

| Scope            | Status     | Description                                     |
| ---------------- | ---------- | ----------------------------------------------- |
| `plugin:read`    | **active** | List and view plugin definitions and instances. |
| `plugin:write`   | **active** | Create and update plugin instances.             |
| `plugin:delete`  | **active** | Delete plugin instances.                        |
| `plugin:manage`  | _reserved_ | Reserved for future plugin management.          |
| `plugin:execute` | _reserved_ | Reserved for future plugin-related actions.     |

### `vault` — Vault entries

| Scope           | Status     | Description                                |
| --------------- | ---------- | ------------------------------------------ |
| `vault:read`    | **active** | List and view vault entries.               |
| `vault:write`   | **active** | Create and update vault entries.           |
| `vault:delete`  | **active** | Delete vault entries.                      |
| `vault:manage`  | _reserved_ | Reserved for future vault management.      |
| `vault:execute` | _reserved_ | Reserved for future vault-related actions. |

### `webhook` — Webhooks and deliveries

| Scope             | Status     | Description                                      |
| ----------------- | ---------- | ------------------------------------------------ |
| `webhook:read`    | **active** | List and view webhooks and deliveries.           |
| `webhook:write`   | **active** | Create, update, and rotate secrets for webhooks. |
| `webhook:delete`  | **active** | Delete webhooks.                                 |
| `webhook:manage`  | _reserved_ | Reserved for future webhook management.          |
| `webhook:execute` | _reserved_ | Reserved for future webhook-related actions.     |

### `analytics` — Analytics data

| Scope               | Status     | Description                                      |
| ------------------- | ---------- | ------------------------------------------------ |
| `analytics:read`    | **active** | View analytics data.                             |
| `analytics:write`   | _reserved_ | Reserved for future analytics write operations.  |
| `analytics:delete`  | _reserved_ | Reserved for future analytics delete operations. |
| `analytics:manage`  | _reserved_ | Reserved for future analytics management.        |
| `analytics:execute` | _reserved_ | Reserved for future analytics actions.           |

### `config` — Configuration

| Scope            | Status     | Description                                   |
| ---------------- | ---------- | --------------------------------------------- |
| `config:read`    | **active** | View configuration entries.                   |
| `config:write`   | _reserved_ | Reserved for future configuration writes.     |
| `config:delete`  | _reserved_ | Reserved for future configuration deletes.    |
| `config:manage`  | _reserved_ | Reserved for future configuration management. |
| `config:execute` | _reserved_ | Reserved for future configuration actions.    |

### `auth` — Authentication and security

| Scope          | Status     | Description                                                      |
| -------------- | ---------- | ---------------------------------------------------------------- |
| `auth:read`    | _reserved_ | Reserved for future auth read operations.                        |
| `auth:write`   | _reserved_ | Reserved for future auth write operations.                       |
| `auth:delete`  | _reserved_ | Reserved for future auth delete operations.                      |
| `auth:manage`  | **active** | MFA management, device registration, and API key administration. |
| `auth:execute` | _reserved_ | Reserved for future auth-related actions.                        |

### `questionnaire_builder` — Frontend placeholder

| Scope                           | Status     | Description                            |
| ------------------------------- | ---------- | -------------------------------------- |
| `questionnaire_builder:read`    | _frontend_ | View questionnaire builder.            |
| `questionnaire_builder:write`   | _frontend_ | Edit in questionnaire builder.         |
| `questionnaire_builder:delete`  | _frontend_ | Delete in questionnaire builder.       |
| `questionnaire_builder:manage`  | _frontend_ | Manage questionnaire builder settings. |
| `questionnaire_builder:execute` | _frontend_ | Execute questionnaire builder actions. |

### `ai` — Frontend placeholder

| Scope        | Status     | Description               |
| ------------ | ---------- | ------------------------- |
| `ai:read`    | _frontend_ | View AI features.         |
| `ai:write`   | _frontend_ | Configure AI features.    |
| `ai:delete`  | _frontend_ | Delete AI configurations. |
| `ai:manage`  | _frontend_ | Manage AI settings.       |
| `ai:execute` | _frontend_ | Execute AI actions.       |

## API Endpoints

### GET /api/v1/scope

Returns all scopes defined in the Python registry.

**Required scope:** `user:read`

### GET /api/v1/role_scope

Returns role-to-scope mappings, merging built-in registry mappings with
any DB-persisted custom assignments. Each entry contains `role_key` and
a sorted list of `scopes`.

**Required scope:** `user:read`

### GET /api/v1/role_scope_entry

Paginated list of DB-persisted role-scope assignments. Supports filtering
by `role_id`, `scope_key`, and `search` (partial match on scope_key).

**Required scope:** `user:read`

### POST /api/v1/role_scope_entry

Assign a scope to a role. The `scope_key` must exist in the scope catalogue.
Duplicate assignments are rejected with `409 Conflict`.

**Required scope:** `user:write`

**Request body:**

```json
{
  "role_id": "string",
  "scope_key": "string"
}
```

### GET /api/v1/role_scope_entry/\{id\}

Retrieve a single role-scope assignment by ID.

**Required scope:** `user:read`

### DELETE /api/v1/role_scope_entry/\{id\}

Soft-delete a role-scope assignment.

**Required scope:** `user:write`

### PUT /api/v1/role/\{id\}/scope

Replace all scope assignments for a role with the provided list. Computes a
diff against current DB state: adds missing scopes, soft-deletes removed
scopes, and leaves unchanged scopes intact.

**Required scope:** `user:write`

**Request body:**

```json
{
  "scope_keys": ["user:read", "user:write", "folder:read"]
}
```

**Response:**

```json
{
  "role_id": "string",
  "scope_keys": ["folder:read", "user:read", "user:write"],
  "added": ["user:write"],
  "removed": ["device:read"],
  "unchanged": ["folder:read", "user:read"]
}
```

### GET /api/v1/role/\{id\}/scope

Returns the scope keys currently assigned to a role in the DB.

**Required scope:** `user:read`

**Response:**

```json
{
  "role_id": "string",
  "scope_keys": ["folder:read", "user:read"]
}
```

## Database Schema

The `role_scope` table stores custom role-scope assignments:

| Column       | Type     | Description                            |
| ------------ | -------- | -------------------------------------- |
| `id`         | string   | Primary key (UUID)                     |
| `role_id`    | string   | FK to `role.id`                        |
| `scope_key`  | string   | Scope identifier (e.g. `user:read`)    |
| `created_at` | datetime | Record creation timestamp              |
| `updated_by` | string   | User who last modified                 |
| `updated_at` | datetime | Last modification timestamp            |
| `deleted_at` | datetime | Soft-delete timestamp (null if active) |

Built-in roles (admin, provider, integration, responder) get their scopes
from the Python registry. DB assignments are additive — they extend
(never reduce) a role's effective scope set.
