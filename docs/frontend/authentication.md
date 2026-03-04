# Authentication

## Overview

The application supports three authentication methods:

1. **Credentials** — email + password
2. **Azure AD OAuth** — Microsoft SSO
3. **MFA** — TOTP-based multi-factor authentication (optional or enforced)

All token state is managed by the `useAuth()` composable, which reads from and writes to `localStorage`.

## Token Storage

| Key                | Value                                    |
| ------------------ | ---------------------------------------- |
| `access_token`     | JWT bearer token                         |
| `refresh_token`    | Refresh token                            |
| `issued_at`        | ISO timestamp                            |
| `expires_at`       | ISO timestamp                            |
| `token_type`       | `"mfa_challenge"` or standard token type |
| `auth_method`      | `"azure_ad"` or `""` (credentials)       |
| `is_authenticated` | `"true"` / `"false"`                     |

## `useAuth()` Composable

`app/composables/useAuth.ts` — all token access goes through this composable. Never read localStorage token keys directly.

```typescript
const {
  accessToken, // Ref<string>
  refreshToken, // Ref<string>
  issuedAt, // Ref<string>
  expiresAt, // Ref<string>
  tokenType, // Ref<string>  — "mfa_challenge" = user in MFA flow
  authMethod, // Ref<string>  — "azure_ad" = OAuth session
  isAuthenticated, // Ref<boolean>
  forceMfa, // Ref<boolean> — set from backend config
  setTokens, // (data) => void — persist all token fields
  clearTokens, // () => void — wipe all fields
  refreshAccessToken, // (refreshFn, grant_type) => Promise<string|null>
} = useAuth();
```

`refreshAccessToken` calls the backend refresh endpoint, stores the new access token, and returns it. Returns `null` on failure, which triggers logout via the event bus.

## Authentication Flows

### Credentials Login

```
1. useUserStore().login({ email, password })
        ↓
2. api.login() → backend
        ↓
3. auth.setTokens(response.data)
        ↓
4a. If token_type === "mfa_challenge" → redirect /mfa-verify
4b. Otherwise → eventBus.userLoggedIn.emit(data) → bootstrap
```

### Azure AD OAuth

```
1. User clicks Azure login button
        ↓
2. api.loginAzure() → redirect to Microsoft login
        ↓
3. Microsoft redirects back to /oauth/callback
        ↓
4. Tokens set, auth.authMethod = "azure_ad"
        ↓
5. Middleware detects Azure AD session → emits userLoggedIn
```

### MFA Flow

- **Setup**: `/mfa-setup` → `api.mfaSetup()` + `api.mfaEnable()`
- **Verify**: `/mfa-verify` → `api.mfaVerify()` or `api.loginMfa()`
- `force_mfa` flag comes from backend config fetched during initialization

## Global Auth Middleware

`app/middleware/auth.global.ts` runs on every client-side navigation:

```
1. Fetch user profile via api.userProfile()
   └─ On 401/403 → clearTokens() + navigate to /login

2. If shouldChangePassword → redirect /change-password

3. If authMethod === "azure_ad":
   └─ If !isAuthenticated → emit userLoggedIn + set isAuthenticated = true
   └─ Return (no further MFA checks for Azure sessions)

4. If tokenType === "mfa_challenge" AND mfa_enabled → redirect /mfa-verify

5. If forceMfa AND !mfa_enabled AND NOT challenged → redirect /mfa-setup
```

**Bypass paths** (no redirect logic): `/login`, `/register`, `/forgot-password`, `/reset-password`, `/change-password`, `/mfa-setup`, `/mfa-verify`, `/mfa-setup-success`, `/oauth/callback`.

## Token Refresh Logic

### Request Interceptor

Injects `Authorization: Bearer <accessToken>` on every outgoing request.

### Response Interceptor (401/403 Handling)

```
1. If 401 or 403 and not already retried:
   a. If another refresh is in progress → push request to failedQueue
   b. Otherwise:
      - Set isRefreshing = true
      - Call refreshAccessToken()
      - On success → flush queue + retry original request
      - On failure → flush queue with error + logout
```

This ensures only one token refresh call is in-flight at a time. Concurrent requests that fail with 401 are queued and automatically replayed after the new token is obtained.

Two API instances are created in `app/api.config.ts`:

- `api` — main client, throws on 4xx/5xx
- `apiToken` — used only for refresh calls; accepts 401/403 responses to inspect refresh failure

## Server-Side JWT Verification

The Nuxt server (Nitro) includes a global middleware that cryptographically verifies JWT tokens on all `/api/*` routes before they reach any route handler.

### Global Middleware (`server/middleware/auth.ts`)

```
Request to /api/*
  └─ Extract Authorization: Bearer <token>
       └─ Missing? → 401 "Missing Authorization header"
  └─ Verify signature (HS256) + expiry via jose.jwtVerify()
       └─ Invalid/expired? → 401
  └─ Reject refresh tokens (payload.refresh === true) → 403
  └─ Reject MFA challenge tokens (payload.mfa_challenge === true) → 403
  └─ Attach verified payload → event.context.auth
```

Non-`/api/*` routes (pages, static assets) are not affected by this middleware.

### `event.context.auth`

After the middleware runs, every `/api/*` route handler can access the verified JWT payload via `event.context.auth`:

```typescript
// server/types/auth.ts
interface JwtPayload {
  sub: string;
  exp: number;
  iat: number;
  role: "provider" | "device";
  pid?: string;
  did?: string;
  pat?: string;
  auth_method?: string;
  token_type?: string;
  refresh?: boolean;
  mfa_challenge?: boolean;
}
```

The `H3EventContext` is augmented in `server/types/h3.d.ts` so TypeScript knows about `event.context.auth`.

### Auth Helpers (`server/utils/requireAuth.ts`)

Two auto-imported helpers provide convenient access with error handling:

| Helper                     | Purpose                                                       |
| -------------------------- | ------------------------------------------------------------- |
| `requireAuth(event)`       | Returns `JwtPayload` or throws 401 if auth context is missing |
| `requireRole(event, role)` | Returns `JwtPayload` or throws 403 if the role doesn't match  |

```typescript
// Example: server route that requires "provider" role
export default defineEventHandler(async (event) => {
  const auth = requireRole(event, "provider");
  // auth.sub is the verified user ID
});
```

### AI Chat Token Refresh

The AI chat endpoint (`/api/ai/chat`) uses `DefaultChatTransport` with a custom `fetch` wrapper that handles 401 responses by refreshing the access token and replaying the request. This is necessary because the Vercel AI SDK's streaming transport bypasses the Axios interceptor chain.

## Bootstrap Sequence

`app/plugins/initialize.client.ts` runs once on page load:

```
1. Provide static UI definitions (sidepanel menu structure)
        ↓
2. api.configList() → set auth.forceMfa from backend response
        ↓
3. auth.refreshAccessToken() using stored refresh_token
        ↓
4a. Success → setTimeout(500ms) → eventBus.userLoggedIn.emit()
4b. Failure → stay on login page
```

The 500ms delay gives the UI time to mount before data-fetching starts.

## Post-Login Side Effects

`app.vue` listens for the `userLoggedIn` event and triggers:

- `user.fetchProfile()` — load current user data
- `folderStore.fetchUserFolders()` — load folder tree
- `providerStore.fetch()` — load available languages/locales
- Start 10-minute token refresh interval

On `userLoggedOut`:

- Clear the refresh interval

## Permissions

`usePermissionStore` manages folder and questionnaire permissions.

**Permission levels:** `OWNER`, `EDITOR`, `VIEWER`

Permission checks are server-side only. The frontend fetches permissions per resource and adjusts UI visibility accordingly. There is no client-side permission evaluation logic.
