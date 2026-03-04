# API Keys (Service Tokens)

API keys are long-lived bearer tokens for 3rd-party integrations. They allow
programmatic access to the API without interactive login, Azure AD, or device
registration flows.

## Key Concepts

- **Acts as the creator**: An API key carries the identity of the user who
  created it (`user_id` = creator). All actions performed with the key are
  attributed to that user.

- **Scoped subset**: At creation time, the caller specifies which scopes the
  key should carry. These must be a subset of the creator's current scopes.
  At validation time, effective scopes are computed as the **intersection** of
  the key's assigned scopes and the creator's current role scopes. If the
  creator loses a role, the key's effective scope shrinks accordingly.

- **No refresh token**: API keys are single long-lived bearer tokens with
  explicit revocation. There is no refresh mechanism.

- **Token format**: `mp_key_` prefix + 43 base62 characters (derived from
  32 random bytes, ~190 bits of entropy).

- **Hash-only storage**: Only the SHA-256 hash of the token is persisted. The
  plaintext is returned exactly once at creation time. It cannot be recovered.

- **MFA/password bypass**: API key authentication sets `auth_path = "api_key"`,
  which bypasses MFA and password-reset enforcement (same treatment as Azure AD).

## Endpoints

All endpoints require the `auth:api_key` scope.

### Create a key

```
POST /api/v1/api_key
```

**Request body:**

```json
{
  "name": "CI/CD Pipeline",
  "description": "Used by GitHub Actions",
  "scope_keys": ["questionnaire:read", "enrollment:read"],
  "expires_in": 2592000
}
```

- `name` (required): Human-friendly label.
- `description` (optional): What the key is used for.
- `scope_keys` (required): Scopes to assign (subset of creator's scopes).
- `expires_in` (required): Lifetime in seconds (minimum 3600 = 1 hour).

**Response (200):**

```json
{
  "id": "abc-123",
  "user_id": "user-456",
  "name": "CI/CD Pipeline",
  "token": "mp_key_7fR3kL9mNpQvWxYz...",
  "token_hint": "z...",
  "scope_keys": ["questionnaire:read", "enrollment:read"],
  "expires_at": "2026-04-02T12:00:00Z",
  "is_revoked": false,
  "created_at": "2026-03-03T12:00:00Z"
}
```

**Important**: Store the `token` value immediately. It is shown only once and
cannot be retrieved later.

### List keys

```
GET /api/v1/api_key?limit=25&offset=0&is_revoked=false
```

Returns a paginated list of the current user's keys. The `token` and
`token_hash` fields are never included — only `token_hint` (last 4 characters).

### Get a key

```
GET /api/v1/api_key/{id}
```

Returns a single key's metadata. Ownership is enforced — attempting to access
another user's key returns 404.

### Revoke a key

```
DELETE /api/v1/api_key/{id}
```

Sets `is_revoked = true` and `revoked_at` to the current timestamp. The key
can no longer be used for authentication. This action is irreversible.

## Using an API Key

Include the token as a Bearer token in the `Authorization` header:

```
Authorization: Bearer mp_key_7fR3kL9mNpQvWxYz...
```

The server detects the `mp_key_` prefix and routes the token to API key
validation instead of JWT decoding.

## Security Considerations

- **Scope intersection**: Even if a key was created with broad scopes, its
  effective scope at validation time is always intersected with the creator's
  current role scopes. Removing a role from the creator immediately reduces
  what the key can do.

- **Revocation**: Keys can be revoked at any time. Revoked keys are rejected
  immediately — there is no grace period.

- **Expiry**: Keys have a mandatory expiry. After expiration, the key is
  rejected even if it has not been explicitly revoked.

- **No MFA**: API keys bypass MFA enforcement because they are designed for
  server-to-server communication. The creator already passed MFA when they
  created the key.

## Roles with `auth:api_key` scope

By default, the following roles have the `auth:api_key` scope:

- `admin`
- `integration`

The `provider` role does **not** have this scope by default (it is in the
provider-excluded set). It can be granted via the role-scope management API
if needed.
