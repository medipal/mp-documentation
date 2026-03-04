# Security Model

## Overview

Medipal is a medical platform that processes patient health data. This document covers the security model of `mp-frontend` and the related `mp-mobile-app` — how secrets are managed, how tokens are protected, and what developers must know when handling sensitive data.

**What the frontend is responsible for:**

- Storing JWT tokens securely in localStorage (web) or SQLite (mobile)
- Encrypting certain localStorage values with `CRYPTO_KEY`
- Enforcing UI-level access control based on server-returned permissions
- Transmitting all data over HTTPS

**What the frontend is NOT responsible for:**

- Authentication enforcement (server validates every token)
- Authorization decisions (server enforces permissions on every API call)
- PII persistence (patient data passes through but is not stored in the browser)

---

## Secrets & Environment Variables

### Build-Time Secrets (Docker `--secret`)

Passed at build time via `docker build --secret` and **never baked into the image layer**:

| Secret            | Purpose                                       |
| ----------------- | --------------------------------------------- |
| `npm_token`       | GitHub Package Registry auth for private pkgs |
| `giget_token`     | Nuxt layer fetching (`@medipal/mp-nuxt-*`)    |
| `api_url`         | Backend base URL                              |
| `api_key`         | Static `X-API-KEY` header value               |
| `api_tenant_id`   | Multi-tenant identifier                       |
| `api_instance_id` | Instance identifier                           |
| `crypto_key`      | Encryption key for localStorage values        |

::: warning
These values are visible in the final JavaScript bundle. Docker `--secret` prevents them from appearing in image history, not from being readable in the shipped code. See [CRYPTO_KEY section](#crypto-key-token-encryption) for the threat model.
:::

### Runtime Environment Variables (`NUXT_PUBLIC_*`)

Resolved at server startup — not embedded in the build output:

| Variable                      | Purpose                                    |
| ----------------------------- | ------------------------------------------ |
| `NUXT_PUBLIC_CRYPTO_KEY`      | AES encryption key for localStorage values |
| `NUXT_PUBLIC_API_KEY`         | Static API key sent as `X-API-KEY`         |
| `NUXT_PUBLIC_API_TENANT_ID`   | Multi-tenant identifier                    |
| `NUXT_PUBLIC_API_INSTANCE_ID` | Instance identifier                        |
| `NUXT_PUBLIC_API_URL`         | Backend base URL                           |

These are accessed in code via `useRuntimeConfig().public.*`. Never read from `process.env` directly in components or stores.

### CI-Only Secrets (Never in Application Code)

These exist only in CI/CD pipelines and deployment workflows:

| Secret                      | Used For                                     |
| --------------------------- | -------------------------------------------- |
| `MATCH_PASSWORD`            | Fastlane Match — decrypts iOS certificates   |
| `APP_STORE_CONNECT_API_KEY` | App Store Connect API for TestFlight/release |
| `ANDROID_KEYSTORE_*`        | Android signing keystore credentials         |
| `GOOGLE_PLAY_JSON_KEY`      | Google Play API for publishing               |

---

## CRYPTO_KEY — Token Encryption

### What it encrypts

`CRYPTO_KEY` is used by the `useLocalStorage` utility to encrypt the following localStorage keys before writing them to disk:

| Key                | Contents                                 |
| ------------------ | ---------------------------------------- |
| `access_token`     | JWT bearer token                         |
| `refresh_token`    | Refresh token                            |
| `issued_at`        | ISO timestamp                            |
| `expires_at`       | ISO timestamp                            |
| `token_type`       | `"mfa_challenge"` or standard token type |
| `auth_method`      | `"azure_ad"` or `""` (credentials)       |
| `is_authenticated` | `"true"` / `"false"`                     |

### Threat model

`CRYPTO_KEY` is a `NUXT_PUBLIC_*` variable — it is embedded in the JavaScript bundle and visible to anyone who can inspect the page source.

**This encryption does NOT protect against XSS.** An XSS attacker who can run arbitrary JS has access to both the key and the encrypted values.

**What it does protect against:**

- Exported browser profiles or localStorage snapshots being readable in plaintext
- Casual inspection of localStorage in DevTools by non-technical users
- Backup files containing browser storage

### In mp-mobile-app

`CRYPTO_KEY` has a **second role** in the mobile app: it is the AES-CBC key used to decrypt deep-link authentication payloads.

```
medipal://authenticate?payload=<AES-CBC-encrypted-token>
                                        ↑
                          decrypted using CRYPTO_KEY
                          (must match backend's key)
```

This means `CRYPTO_KEY` must be **identical** between the backend and the mobile app build. A mismatch produces a silent decryption failure — the patient sees a generic error and cannot authenticate.

::: danger Key rotation impact
When `CRYPTO_KEY` is rotated:

1. All active mobile sessions that haven't synced yet will fail to decrypt new deep-links
2. Clinicians must re-generate invite links after the rotation
3. Any outstanding deep-links issued before the rotation become invalid
4. Mobile users who have not yet tapped their invite link must receive a new one
   :::

---

## Token Security Model

### Storage locations

| Application   | Token storage                                    | Encryption           |
| ------------- | ------------------------------------------------ | -------------------- |
| mp-frontend   | `localStorage` (browser)                         | AES via `CRYPTO_KEY` |
| mp-mobile-app | Encrypted SQLite (`@capacitor-community/sqlite`) | At-rest encryption   |

### Token lifecycle (web)

```
Login
  └─ api.login() → { access_token, refresh_token, ... }
       └─ auth.setTokens() → encrypted localStorage
            └─ initialize.client.ts starts 10-min refresh interval

Request with expired token
  └─ Response interceptor catches 401/403
       └─ Only one refresh in flight at a time (isRefreshing flag)
       └─ Concurrent 401s are queued in failedQueue
       └─ On refresh success → flush queue, retry all requests
       └─ On refresh failure → logout via event bus

Logout
  └─ auth.clearTokens() → wipe all localStorage keys
       └─ userLoggedOut event → stop refresh interval
```

### Separate API instances

Two Axios instances are created in `app/api.config.ts` to prevent interceptor loops:

- **`api`** — main client; throws on 4xx/5xx; has the 401 → refresh interceptor
- **`apiToken`** — used only for refresh calls; accepts 401/403 without retrying

If the refresh call itself fails with 401, `apiToken` surfaces the error cleanly instead of triggering another refresh attempt.

### Server-Side (BFF) Authentication

The Nuxt server acts as a BFF (Backend For Frontend) and includes a global Nitro middleware (`server/middleware/auth.ts`) that cryptographically verifies every JWT token on `/api/*` routes before forwarding requests to the backend.

**`JWT_SECRET`** is a server-only environment variable (not `NUXT_PUBLIC_*`) that must be identical to the JWT signing secret configured on the backend. It is used to verify HS256 signatures via the `jose` library.

**What the middleware enforces:**

- Signature verification — rejects tampered or forged tokens
- Expiry validation — rejects expired tokens (`exp` claim)
- Token type filtering — rejects refresh tokens and MFA challenge tokens (403)
- Populates `event.context.auth` with the verified `JwtPayload` for route handlers

**What the middleware does NOT do:**

- It does NOT strip the `Authorization` header — route handlers that proxy to the backend still forward the original header
- It does NOT validate scopes or fine-grained permissions — that remains the backend's responsibility

::: warning Header forwarding
The `Authorization` header is preserved after middleware verification. Server routes that forward requests to the backend (e.g., AI chat, engine routes) rely on this behavior — the backend performs its own token validation independently.
:::

### XSS mitigations

- `CRYPTO_KEY` encryption makes raw localStorage values unreadable in plaintext
- Content Security Policy is enforced at the nginx proxy layer (see nginx config in `nginx/`)
- No `eval()` or dynamic code execution in application code
- All user-supplied content rendered through Vue's template compiler (auto-escaping)

---

## Access Control

### Permission levels

| Level    | Capabilities                                       |
| -------- | -------------------------------------------------- |
| `OWNER`  | Full control: create, edit, delete, manage members |
| `EDITOR` | Create and edit content; cannot delete or manage   |
| `VIEWER` | Read-only access                                   |

Permissions are fetched per resource (folder or questionnaire) via `usePermissionStore`.

### Enforcement model

::: warning Frontend permissions are display-only
The frontend hides UI elements (buttons, actions) based on the user's permission level. This is a UX convenience — **it does not block API requests**.

The backend validates permissions on every API call. A `VIEWER` who constructs a direct API call cannot perform `EDITOR` or `OWNER` operations regardless of frontend state.
:::

Never use frontend permission checks to gate access to sensitive data. Use them only to hide actions that would fail server-side anyway.

---

## Mobile App — Additional Security

### SQLite encryption

`mp-mobile-app` uses `@capacitor-community/sqlite` with encryption enabled. Sensitive columns stored at rest:

- `answers_json` — patient questionnaire responses (PII/PHI)
- `access_token` — JWT bearer token per tenant
- `refresh_token` — refresh token per tenant

The database file itself is encrypted on the device. Access requires the app to be running in its native context (not accessible from device file system without jailbreak/root).

### Background sync security

The background runner (`@capacitor/background-runner`) submits queued offline responses when the device regains connectivity. Security constraints:

- It operates with a stored `access_token` directly
- **It cannot refresh tokens** — a 401 during background sync means the submission stays in `pending_submits` and is retried next time the app is in foreground
- Failed submissions are never discarded; they persist in SQLite until successfully sent

### Deep-link authentication

```
1. Clinician generates invite in mp-frontend
        ↓
2. Backend returns AES-CBC encrypted payload using CRYPTO_KEY
        ↓
3. Patient receives: medipal://authenticate?payload=<encrypted>
        ↓
4. plugins/deepLink.ts → useHandleAuthenticationLink()
        ↓
5. utils/urlPayloadDecoder.ts → AES-CBC decrypt with CRYPTO_KEY
        ↓
6. Extracted: { tenantUrl, apiKey, userId, ... }
        ↓
7. POST /api/device-login → tokens written to SQLite
```

The deep-link payload is single-use from a security perspective — once the patient has authenticated, a second tap of the same link calls device-login with already-used credentials (server-side revocation behavior depends on backend configuration).

---

## Transport Security

- All API traffic goes over HTTPS — the nginx proxy terminates TLS
- `NUXT_PUBLIC_API_URL` must always be an `https://` endpoint in production
- Live-update bundles are fetched from `updates.{env}.medipal.dev` — this is a **public CDN endpoint** with no authentication. Ensure the CDN only serves non-sensitive JS bundles
- WebSocket or Server-Sent Events are not used; all communication is request/response

---

## Key Rotation Procedures

### `JWT_SECRET`

**Trigger:** Suspected secret compromise, backend signing key rotation, or security audit requirement.

**Steps:**

1. Generate a new secret (minimum 32 bytes, cryptographically random)
2. Update `JWT_SECRET` on **both** the backend and `mp-frontend` simultaneously
3. Redeploy both services at the same time

**Side effects:**

- All active BFF sessions are immediately invalidated — users will receive 401 on their next server-side API request
- The change must be synchronous across backend and frontend — a mismatch means all requests through the BFF will fail with "Invalid token"
- Client-side tokens stored in localStorage are unaffected, but they will fail server-side verification until the user re-authenticates

### `CRYPTO_KEY`

**Trigger:** Suspected key compromise, security audit requirement, or routine rotation policy.

**Steps:**

1. Generate a new key (minimum 32 bytes, cryptographically random)
2. Update `NUXT_PUBLIC_CRYPTO_KEY` / `crypto_key` secret in all environments (development, staging, production)
3. Update the same key in the backend configuration
4. Rebuild and redeploy `mp-frontend` and `mp-mobile-app`

**Side effects:**

- All current web sessions will fail to decrypt their stored tokens → users are logged out on next page load
- All outstanding mobile deep-link invites become invalid → clinicians must regenerate invites
- Mobile users mid-onboarding must restart the authentication flow

### `API_KEY`

**Trigger:** Key leaked in logs, repository, or to unauthorized party.

**Steps:**

1. Rotate the key in the backend
2. Update `NUXT_PUBLIC_API_KEY` / `api_key` secret
3. Rebuild and redeploy (no session impact — API key is sent on every request, not cached)

### `MATCH_PASSWORD` (Fastlane)

**Trigger:** Password compromised or team member offboarding.

**Steps:**

1. Run `fastlane match change_password` — re-encrypts the certificate repository
2. Update `MATCH_PASSWORD` secret in CI/CD environment
3. Verify next CI build succeeds

### iOS/Android certificates compromised

**Trigger:** `mp-fastlane-certificates` repository is exposed or cloned by unauthorized party.

::: danger This repository must be private
`mp-fastlane-certificates` contains code-signing certificates and provisioning profiles. Exposure allows publishing malicious apps under the Medipal developer account.
:::

**Steps:**

1. Immediately revoke certificates in Apple Developer Portal / Google Play Console
2. Run `fastlane match nuke distribution` to remove all certificates from the repo
3. Run `fastlane match` to regenerate clean certificates
4. Rotate `MATCH_PASSWORD`
5. Notify the App Store / Google Play security teams if malicious builds may have been submitted

### `access_token` / `refresh_token`

These rotate automatically via the refresh interceptor. If a token is suspected compromised:

1. Revoke the refresh token via the backend admin interface
2. The user will be logged out on their next request (401 with no valid refresh token)
3. For bulk revocation (e.g., data breach), rotate the JWT signing secret on the backend — this invalidates all active sessions across all users

---

## GDPR Considerations

### What counts as PII/PHI in Medipal

| Data type                         | Location                                  |
| --------------------------------- | ----------------------------------------- |
| Patient name, email               | API only; not persisted locally           |
| Questionnaire responses (answers) | Mobile: encrypted SQLite; Web: API only   |
| Auth tokens (indirect identifier) | localStorage (web), SQLite (mobile)       |
| Provider/clinician identifiers    | In-memory Pinia stores; cleared on logout |

### Browser (mp-frontend)

The web application does **not** store PII in localStorage or sessionStorage. Only encrypted auth tokens are persisted. Patient data is fetched from the API on demand and held in memory (Pinia stores) until the page is closed or the user logs out.

### Mobile (mp-mobile-app)

`answers_json` in SQLite contains patient questionnaire responses — this is PHI. It is:

- Encrypted at rest on the device
- Transmitted to the backend over HTTPS
- Moved to the `submits` table (immutable audit log) after successful sync
- **Not deleted from the device** after sync — patients retain a local copy

For right-to-erasure requests: the backend is the authoritative store. Frontend holds no independently deletable PII beyond what the backend already manages, except for the mobile SQLite database. Device wipe (app uninstall) removes local data.

### Recommendations

- The Legal configuration page (questionnaire config → Legal) should link to the applicable privacy policy
- Session tokens expire per backend TTL; no indefinite session persistence
- Do not add analytics SDKs (e.g., Google Analytics, Mixpanel) without a GDPR-compliant consent flow — none are currently present
