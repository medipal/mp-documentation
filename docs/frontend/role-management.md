# Role & Access Management

Scope-based access control (RBAC) with role management, permission scopes, and API key administration.

---

## Overview

| Property       | Value                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------- |
| Routes         | `/admin-panel/access` (Users, Sessions, Roles, API Keys tabs), `/role/[id]` (role detail)                     |
| Feature flag   | `FEATURE_ROLES=true`                                                                                          |
| Pages          | `admin-panel/access/_partial/{users,sessions,roles,api-keys}.vue`, `role/[id]/config/{info,users,scopes}.vue` |
| Stores         | `useScopeStore`, `useRoleStore`, `useApiKeyStore`, `useProviderStore`                                         |
| Key components | `ScopeMatrix`, `CreateApiKeyModal`, `ChangeUserRoleModal`, `ResetUserPasswordModal`                           |

---

## Scope-Based Access Control

### How Scopes Work

Scopes follow the `resource:action` format (e.g. `questionnaire:write`, `role:delete`). Each user receives scopes derived from their assigned roles. Scopes are bootstrapped at login time from the `/me` response via `scopeStore.setUserScopes()`.

### ScopeStore API

```typescript
const scopeStore = useScopeStore();

// Permission checks
scopeStore.hasScope("user:write"); // single scope
scopeStore.hasAnyScope("plugin:read", "webhook:read"); // any match
scopeStore.hasAllScopes("role:read", "role:write"); // all required

// User scopes
scopeStore.setUserScopes(scopes); // called at login

// Role scope management
await scopeStore.fetchAllScopes(); // full scope registry
await scopeStore.fetchRoleScopes(roleId); // scopes for a role
await scopeStore.syncRoleScopes(roleId, scopeKeys); // update role scopes
```

### `scopedAction()` Utility

Auto-disables table row actions when the current user lacks the required scope:

```typescript
scopedAction(
  { label: "Delete", icon: "lucide:trash", onClick: () => deleteItem(id) },
  "item:delete",
);
// Returns action as-is if user has scope, otherwise { ...action, disabled: true }
// Accepts string or array (any-match)
```

Disabled buttons show a `@common.scopes.noPermission` tooltip.

### Scope Keys

| Scope Key                       | Description                    |
| ------------------------------- | ------------------------------ |
| `questionnaire:read`            | View questionnaires            |
| `questionnaire:write`           | Create/edit questionnaires     |
| `questionnaire:delete`          | Delete questionnaires          |
| `questionnaire_submission:read` | View questionnaire submissions |
| `enrollment:read`               | View enrollments               |
| `enrollment:write`              | Create/edit enrollments        |
| `enrollment:delete`             | Delete enrollments             |
| `folder:read`                   | View folders                   |
| `folder:write`                  | Create/edit folders            |
| `folder:delete`                 | Delete folders                 |
| `user:read`                     | View users                     |
| `user:write`                    | Create/edit users              |
| `user:delete`                   | Delete users                   |
| `role:read`                     | View roles                     |
| `role:write`                    | Create/edit roles              |
| `role:delete`                   | Delete roles                   |
| `user_role:write`               | Assign roles to users          |
| `user_role:delete`              | Unassign roles from users      |
| `permission:write`              | Create/edit permissions        |
| `permission:delete`             | Delete permissions             |
| `auth:register_device`          | Register devices               |
| `auth:api_key`                  | Create API keys                |
| `device:delete`                 | Delete devices                 |
| `plugin:read`                   | View plugins                   |
| `plugin:write`                  | Create/edit plugins            |
| `plugin:delete`                 | Delete plugins                 |
| `webhook:read`                  | View webhooks                  |
| `vault:read`                    | View vault entries             |
| `workflow:read`                 | View workflows                 |
| `config:read`                   | View engine config             |
| `event_subscription:read`       | View event delivery tasks      |

### Admin Panel Tab Visibility

The `tabScopeMap` in `admin-panel.vue` gates each admin tab:

```typescript
const tabScopeMap = {
  "admin-panel-access": () => userStore.isAdmin,
  "admin-panel-event-delivery-tasks": () =>
    scopeStore.hasScope("event_subscription:read"),
  "admin-panel-workflows": () =>
    FEATURE_WORKFLOWS && scopeStore.hasScope("workflow:read"),
  "admin-panel-engines": () => scopeStore.hasScope("config:read"),
  "admin-panel-system": () =>
    scopeStore.hasAnyScope("plugin:read", "webhook:read", "vault:read"),
};
```

### Sidebar Dynamic Path Resolution

`resolveAdminPanelPath()` in `Sidepanel.vue` uses the same scope map to resolve the first visible admin tab for the sidebar link. The `activePrefix` pattern keeps the sidebar highlight active across all admin panel sub-tabs.

---

## ScopeMatrix Component

`ScopeMatrix` (`app/components/ScopeMatrix.vue`) renders a resource × action checkbox grid.

**Props:**

| Prop              | Type       | Description                                         |
| ----------------- | ---------- | --------------------------------------------------- |
| `availableScopes` | `Scope[]`  | Full list of scope objects (key, name, description) |
| `modelValue`      | `string[]` | Selected scope keys (v-model)                       |
| `readonly`        | `boolean`  | Disable all editing                                 |
| `disabledScopes`  | `string[]` | Scope keys the user cannot toggle                   |

**Features:**

- Rows = resources (part before `:`), columns = actions (part after `:`)
- Row/column toggle checkboxes for bulk selection
- Indeterminate state for partial selections
- Used in: Role Scopes tab, Create API Key modal

---

## Role Management

### Role List

Admin Panel → Access → **Roles** tab (`admin-panel/access/_partial/roles.vue`).

Table with name, description, system badge, and row actions (edit, delete) gated by `role:write` / `role:delete` scopes.

### Role Detail Page

`/role/[id]` with three config tabs:

#### Info Tab

Edit role name and description. System roles show a read-only warning.

#### Assigned Users Tab

Table of users assigned to this role with columns: user link, email, granted at, granted by. Row actions:

- **Unassign** — gated by `user_role:delete`

Header action:

- **Assign User** — gated by `user_role:write`

#### Scopes Tab

`ScopeMatrix` for editing the role's scopes. Scopes the current user doesn't hold are passed as `disabledScopes` — you can't grant permissions you don't have yourself.

### Modals

| Modal                   | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `CreateRoleModal`       | Create a new role with name and description  |
| `EditRoleModal`         | Edit an existing role's name and description |
| `DeleteRoleModal`       | Confirm role deletion                        |
| `AssignUserRoleModal`   | Assign a user to this role                   |
| `UnassignUserRoleModal` | Confirm removing a user from the role        |

All modals follow the async-submit pattern (`onSubmit: async (data) => { ... }`).

---

## API Key Management

### API Keys Tab

Admin Panel → Access → **API Keys** tab (`admin-panel/access/_partial/api-keys.vue`).

Table columns: name, token hint, scopes (badges), expires at, last used at, status.

**Status badges:**

- `active` — token is valid and not expired
- `expired` — past expiration date
- `revoked` — manually revoked

Row action: **Revoke** — gated by `auth:api_key` scope.

### CreateApiKeyModal

Two-step wizard:

1. **Form step** — name, description, expiry date, scopes selection via `ScopeMatrix`
   - `delegatableScopes` — only scopes the current user holds are available for delegation
2. **Token reveal step** — displays the generated token with a copy button and one-time-display warning

### API Key Store

```typescript
const apiKeyStore = useApiKeyStore();

await apiKeyStore.fetchTokens(); // list all tokens
await apiKeyStore.revokeToken(id); // revoke a token
apiKeyStore.showCreateApiKeyModal(); // open creation wizard
apiKeyStore.showRevokeApiKeyModal(id); // confirm revocation
```

---

## User Management Enhancements

### Role Badges Column

The users table (`admin-panel/access/_partial/users.vue`) shows a **role badges** column. A role-based filter dropdown allows filtering users by their assigned roles.

### ChangeUserRoleModal

Multi-role assignment dropdown — select multiple roles to assign to a user. Triggered via `providerStore.showChangeUserRoleModal(user)`.

### ResetUserPasswordModal

Manual password entry with a **Generate** button that creates a random 16-character password using `crypto.getRandomValues` and auto-copies to clipboard. Triggered via `providerStore.showResetUserPasswordModal(user)`.

### Force Password Change

Toggle the force-password-change flag for a user. Triggered via `providerStore.showForcePasswordChangeModal(user)`.

### Back Navigation

Role detail and user detail pages use `parentPath` / `parentTab` query params for back-navigation to the correct sub-tab in the admin panel.

---

## i18n Keys

| Namespace                                 | Content                               |
| ----------------------------------------- | ------------------------------------- |
| `@pages.adminPanel.tabs.access.roles.*`   | Roles table headers, actions, empty   |
| `@pages.adminPanel.tabs.access.apiKeys.*` | API keys table, status labels         |
| `@pages.role.*`                           | Role detail page (tabs, sections)     |
| `@modals.role.*`                          | Create / edit / assign role modals    |
| `@modals.adminPanel.*`                    | API key, password, role change modals |
| `@toasts.role.*`                          | Role success / error toasts           |
| `@toasts.scope.*`                         | Scope sync success / error toasts     |
| `@toasts.apiKey.*`                        | API key success / error toasts        |
| `@common.scopes.*`                        | Scope labels, no-permission tooltip   |

---

## See Also

- [Authentication](./authentication) — login flow, token refresh, session management
- [Plugin Management](./plugin-management) — plugin instances used in workflow ACTION nodes
