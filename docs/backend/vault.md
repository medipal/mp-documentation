# Vault API — Front-End Integration Guide

This document covers every vault endpoint, request/response shapes, the
reference resolution mechanism, and the UI patterns you will need to implement.

The vault is a centralised, encrypted-at-rest store for **secrets** (API keys,
SMTP passwords, tokens) and **variables** (base URLs, feature flags, shared
config values). Once stored, secrets and variables can be referenced in plugin
instance configurations and workflow input mappings using the `$secret:<key>`
and `$var:<key>` syntax — the server resolves them at runtime so plaintext
credentials never appear in config payloads.

All endpoints require the `admin` or `integration` role and accept either
`Authorization: Bearer <token>` or `X-API-KEY: <key>`.

---

## Table of Contents

### Vault Entries

1. [Create a Vault Entry](#1-create-a-vault-entry)
2. [List Vault Entries](#2-list-vault-entries)
3. [Get a Single Vault Entry](#3-get-a-single-vault-entry)
4. [Update a Vault Entry](#4-update-a-vault-entry)
5. [Delete a Vault Entry](#5-delete-a-vault-entry)

### Reference Resolution

6. [Using References in Plugin Configs](#6-using-references-in-plugin-configs)
7. [Using References in Workflow Input Mappings](#7-using-references-in-workflow-input-mappings)
8. [Reference Syntax Rules](#8-reference-syntax-rules)

### Operations

9.  [Environment Setup](#9-environment-setup)
10. [Important UI Considerations](#10-important-ui-considerations)

---

## 1. Create a Vault Entry

```
POST /api/v1/vault_entry
```

### Request Body

| Field         | Type      | Required | Default | Notes                                                                                         |
| ------------- | --------- | -------- | ------- | --------------------------------------------------------------------------------------------- |
| `key`         | `string`  | yes      | —       | Unique lookup key (e.g. `smtp_password`). Used in `$secret:<key>` and `$var:<key>` references |
| `kind`        | `string`  | yes      | —       | `SECRET` or `VAR`                                                                             |
| `value`       | `string`  | yes      | —       | The plaintext value. Encrypted server-side when kind is `SECRET`                              |
| `description` | `string`  | no       | `null`  | Optional human-readable description                                                           |
| `enabled`     | `boolean` | no       | `true`  | When `false`, references to this entry fail resolution                                        |

### Response (200)

```json
{
  "id": "ve-abc-123",
  "key": "smtp_password",
  "kind": "SECRET",
  "value": "******",
  "description": "SMTP server password for outbound emails",
  "enabled": true,
  "created_at": "2026-02-28T10:00:00Z",
  "updated_at": null,
  "deleted_at": null
}
```

> **SECRET values are always masked as `"\*\*\*\***"` in API responses.\*\* The
> plaintext is encrypted with Fernet (AES-128-CBC) before storage and is
> never returned via the API. VAR values are returned in plaintext.

### Errors

| Status | Code               | When                                       |
| ------ | ------------------ | ------------------------------------------ |
| `409`  | `VAULT.KEY_EXISTS` | A vault entry with this key already exists |

---

## 2. List Vault Entries

```
GET /api/v1/vault_entry
```

### Query Parameters

| Param      | Type      | Default | Notes                                       |
| ---------- | --------- | ------- | ------------------------------------------- |
| `limit`    | `integer` | `25`    | Min `1`                                     |
| `offset`   | `integer` | `0`     | Min `0`                                     |
| `kind`     | `string`  | —       | Filter by `SECRET` or `VAR`                 |
| `key`      | `string`  | —       | Filter by key (partial match)               |
| `enabled`  | `boolean` | —       | Filter by enabled flag                      |
| `search`   | `string`  | —       | Text search on key and description          |
| `sort_by`  | `string`  | —       | Field to sort by (e.g. `key`, `created_at`) |
| `sort_dir` | `string`  | `asc`   | `asc` or `desc`                             |

### Response (200)

```json
{
  "vault_entries": [
    {
      "id": "ve-abc-123",
      "key": "smtp_password",
      "kind": "SECRET",
      "value": "******",
      "description": "SMTP server password",
      "enabled": true,
      "created_at": "2026-02-28T10:00:00Z",
      "updated_at": null,
      "deleted_at": null
    },
    {
      "id": "ve-def-456",
      "key": "api_base_url",
      "kind": "VAR",
      "value": "https://api.example.com",
      "description": "Base URL for external API calls",
      "enabled": true,
      "created_at": "2026-02-28T09:00:00Z",
      "updated_at": null,
      "deleted_at": null
    }
  ],
  "total": 2,
  "limit": 25,
  "offset": 0,
  "has_next": false,
  "has_previous": false
}
```

---

## 3. Get a Single Vault Entry

```
GET /api/v1/vault_entry/{id}
```

### Response (200)

```json
{
  "id": "ve-abc-123",
  "key": "smtp_password",
  "kind": "SECRET",
  "value": "******",
  "description": "SMTP server password",
  "enabled": true,
  "created_at": "2026-02-28T10:00:00Z",
  "updated_at": null,
  "deleted_at": null
}
```

### Errors

| Status | Code              | When                  |
| ------ | ----------------- | --------------------- |
| `404`  | `VAULT.NOT_FOUND` | Vault entry not found |

---

## 4. Update a Vault Entry

```
PATCH /api/v1/vault_entry/{id}
```

Partial update — only send the fields you want to change.

### Request Body (all fields optional)

| Field         | Type      | Notes                                                      |
| ------------- | --------- | ---------------------------------------------------------- |
| `key`         | `string`  | Must be unique across non-deleted entries                  |
| `kind`        | `string`  | `SECRET` or `VAR`. Changing to `SECRET` encrypts the value |
| `value`       | `string`  | Re-encrypted automatically if kind is `SECRET`             |
| `description` | `string`  |                                                            |
| `enabled`     | `boolean` | Use this to enable/disable without deleting                |

### Response (200)

Same shape as [Get a Single Vault Entry](#3-get-a-single-vault-entry)
(SECRET values are masked).

### Errors

| Status | Code               | When                                     |
| ------ | ------------------ | ---------------------------------------- |
| `404`  | `VAULT.NOT_FOUND`  | Vault entry not found                    |
| `409`  | `VAULT.KEY_EXISTS` | New key conflicts with an existing entry |

---

## 5. Delete a Vault Entry

```
DELETE /api/v1/vault_entry/{id}
```

### Response (200)

```json
{
  "message": "Vault entry ve-abc-123 deleted."
}
```

> This is a **soft delete** (`deleted_at` is set). Existing configs that
> reference the deleted entry will fail resolution at runtime — update or
> remove those references first.

### Errors

| Status | Code              | When                  |
| ------ | ----------------- | --------------------- |
| `404`  | `VAULT.NOT_FOUND` | Vault entry not found |

---

## 6. Using References in Plugin Configs

Once a vault entry is created, you can reference it in any plugin instance's
`config_json` field. The server resolves references at runtime when the plugin
is invoked — the reference string is stored as-is in the database.

### Example

**1. Create the vault entries:**

```
POST /api/v1/vault_entry
{ "key": "smtp_host", "kind": "VAR", "value": "mail.example.com" }

POST /api/v1/vault_entry
{ "key": "smtp_password", "kind": "SECRET", "value": "s3cret-p4ssw0rd" }
```

**2. Use references in the plugin instance config:**

```
POST /api/v1/plugin_instance
{
  "plugin_definition_id": "email-sender-def",
  "name": "Production Email",
  "config_json": {
    "host": "$var:smtp_host",
    "port": 587,
    "username": "noreply@example.com",
    "password": "$secret:smtp_password",
    "use_tls": true
  }
}
```

**3. At runtime**, when the plugin is invoked, the server replaces
`"$var:smtp_host"` with `"mail.example.com"` and `"$secret:smtp_password"`
with the decrypted `"s3cret-p4ssw0rd"`. The plugin receives:

```json
{
  "host": "mail.example.com",
  "port": 587,
  "username": "noreply@example.com",
  "password": "s3cret-p4ssw0rd",
  "use_tls": true
}
```

> **Resolved values are never logged or returned via the API.** The config
> stored in the database always contains the reference strings, not plaintext
> secrets.

---

## 7. Using References in Workflow Input Mappings

Vault references also work in workflow node input mappings. After JSONLogic
expressions are evaluated, the resolver runs a second pass to replace any
`$secret:<key>` or `$var:<key>` strings in the resolved output.

### Example

A workflow node's `input_mapping` might look like:

```json
{
  "recipient": { "var": "event.data.user_email" },
  "api_key": "$secret:sendgrid_key",
  "from_address": "$var:noreply_email"
}
```

After evaluation:

- `recipient` is resolved from the event payload via JSONLogic
- `api_key` is decrypted from the vault
- `from_address` is looked up from the vault as a plaintext variable

---

## 8. Reference Syntax Rules

| Pattern         | Kind     | Example                 |
| --------------- | -------- | ----------------------- |
| `$secret:<key>` | `SECRET` | `$secret:smtp_password` |
| `$var:<key>`    | `VAR`    | `$var:api_base_url`     |

### Rules

- **Full-string match only.** The entire string value must be `$secret:<key>`
  or `$var:<key>`. A string like `"prefix $secret:key suffix"` is **not**
  treated as a reference and passes through unchanged.

- **Key characters.** Keys may contain letters, digits, and underscores:
  `[a-zA-Z0-9_]`.

- **Nested structures.** The resolver traverses dicts and lists recursively.
  Non-string values (numbers, booleans, `null`) are never affected.

- **Disabled entries.** Referencing a disabled vault entry (`enabled: false`)
  raises a resolution error at runtime. The plugin invocation or workflow node
  will fail with error code `VAULT.DISABLED`.

- **Missing entries.** Referencing a non-existent key raises a resolution
  error with code `VAULT.RESOLVE_FAILED`.

- **No circular references.** Resolved values are not scanned again — if a
  vault entry's value happens to contain `$secret:...`, it is treated as a
  literal string after resolution.

---

## 9. Configuration

The vault requires `vault.encryption_key` in `app_config.yaml` to encrypt
and decrypt SECRET values. This should be a Fernet-compatible key (URL-safe
base64, 32 bytes).

### Generating a Dedicated Key

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### app_config.yaml

```yaml
vault:
  encryption_key: "${VAULT_ENCRYPTION_KEY}"
```

The value is resolved from the environment variable at startup via the
standard config store. You can reuse an existing secret (e.g. `JWT_SECRET`)
or provide a dedicated Fernet key.

> **Keep this key safe.** If the key is lost, all SECRET values become
> unrecoverable. If the key is compromised, rotate it and re-encrypt all
> secrets.

---

## 10. Important UI Considerations

### Secret vs Variable Visual Distinction

Use clear visual indicators to differentiate the two kinds:

| Kind     | Display Value    | Badge Colour | Icon Suggestion |
| -------- | ---------------- | ------------ | --------------- |
| `SECRET` | `******`         | red / dark   | lock / shield   |
| `VAR`    | actual plaintext | blue / grey  | code / variable |

### Value Input

- For `SECRET` entries, use a password input field (masked by default with a
  show/hide toggle).
- For `VAR` entries, use a standard text input.
- On **create**, the value is required. On **update**, omitting the `value`
  field leaves the existing value unchanged.

### Key Field

- The key must be unique. Display a validation error if the API returns
  `409 VAULT.KEY_EXISTS`.
- Consider using a monospace font for the key field since it represents a
  code-level identifier.
- Suggest a naming convention hint, e.g. _"Use lowercase with underscores
  (smtp_password, api_base_url)"_.

### Reference Helper

When editing a plugin instance config or workflow input mapping, consider
providing:

- A **vault reference picker** — a dropdown or autocomplete that lists
  available vault entries and inserts `$secret:<key>` or `$var:<key>` into
  the config field.
- Fetch available entries with `GET /api/v1/vault_entry?enabled=true`.
- Group by kind (`SECRET` / `VAR`) for clarity.

### Enable / Disable Toggle

Use `PATCH /api/v1/vault_entry/{id}` with `{ "enabled": false }` to disable
an entry without deleting it. Show a warning that disabling will cause
runtime failures for any configs still referencing this key.

### Deletion Warning

When deleting a vault entry, warn the user that any plugin configs or workflow
input mappings referencing this key will fail at runtime until the references
are updated or removed.

### Pagination

All list endpoints share the same pagination contract:

```
?limit=25&offset=0
```

Use `has_next` / `has_previous` booleans to enable/disable pagination
controls. `total` gives the full count for "showing X of Y" labels.

### Timestamps

All timestamps are ISO-8601 UTC. Convert to the user's local timezone for
display.

---

## Error Code Reference

| Code                   | HTTP Status | Description                                    |
| ---------------------- | ----------- | ---------------------------------------------- |
| `VAULT.NOT_FOUND`      | `404`       | Vault entry does not exist                     |
| `VAULT.KEY_EXISTS`     | `409`       | A vault entry with this key already exists     |
| `VAULT.DISABLED`       | `422`       | Referenced vault entry is disabled             |
| `VAULT.RESOLVE_FAILED` | `422`       | Failed to resolve a vault reference at runtime |
