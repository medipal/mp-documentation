# API Client

## API Generation Pipeline

The `api` object developers use in stores and components is the end result of a multi-step generation pipeline:

```
mp-schema  (private repo)
  └─ OpenAPI / JSON Schema definitions for all backend endpoints
       ↓  mp-typescript-api-generator  (code generation tool)
@medipal/mp-frontend-api  (npm package, published to GitHub Packages)
  └─ Auto-generated TypeScript API class with typed methods
     (e.g. v1QuestionnaireList, v1UserCreate, ...)
       ↓  installed as a dependency, version pinned in package.json
@medipal/mp-nuxt-api-layer  (private Nuxt layer, loaded via extends:)
  └─ Provides useApi() composable
     Uses a TypeScript Proxy to route semantic names through methodMap
       ↓
app/api.config.ts  (this repo)
  └─ createApi() — instantiates Api class with baseURL, headers, interceptors
     methodMap — maps semantic names → generated method names
       ↓
const { api } = useApi()  ← what developers use in stores/components
```

### Updating the API Client

When the backend schema changes, `mp-frontend-api` is regenerated and published as a new version. To pick up changes:

1. Bump `@medipal/mp-frontend-api` in `package.json` to the new version.
2. Run `npm install`.
3. TypeScript will immediately surface any breaking changes (renamed or removed methods, changed parameter shapes).

## Overview

The API client is auto-generated and distributed as `@medipal/mp-frontend-api`. The frontend never constructs raw Axios calls — all requests go through the `api` object returned by `useApi()`.

## Getting the API Client

```typescript
const { api } = useApi();
// api is an instance of Api from @medipal/mp-frontend-api
// useApi() is provided by @medipal/mp-nuxt-api-layer
```

## API Client Factory (`app/api.config.ts`)

`createApi()` instantiates the `Api` class with:

- `baseURL` from `NUXT_PUBLIC_API_URL`
- `X-API-KEY` header from `NUXT_PUBLIC_API_KEY`
- Request interceptor: inject `Authorization: Bearer <token>`
- Response interceptor: 401/403 token refresh + request queuing

Two instances are created:

| Instance   | Purpose                                                 |
| ---------- | ------------------------------------------------------- |
| `api`      | Main client — throws on 4xx/5xx                         |
| `apiToken` | Refresh calls only — accepts 401/403 to inspect failure |

## Error Handling Pattern

All store actions follow this pattern:

```typescript
try {
  const { data } = await api.someMethod(params);
  // update store state
  return data;
} catch (error) {
  toast.add({
    title: t("@toasts.domain.failedToXxx"),
    description: formatError({ error }), // useFormatAxiosError()
    color: "error",
    icon: "lucide:x-circle",
  });
  throw new Error("Human readable message", { cause: error });
}
```

`useFormatAxiosError()` — composable at `app/composables/useFormatAxiosError.ts` — extracts a readable string from Axios error responses.

## Type Safety

All API response types are inferred from the client package:

```typescript
// types/questionnaire.ts
const { api: _api } = useApi();

export type Questionnaire = Awaited<
  ReturnType<typeof _api.questionnaireDetail>
>["data"];

export type QuestionnaireSection = Awaited<
  ReturnType<typeof _api.questionnaireDetail>
>["data"]["payload"]["sections"][number];
```

Types update automatically when `@medipal/mp-frontend-api` is updated.

## Method Map

The method map in `app/api.config.ts` maps semantic names to generated method names:

### Auth

| Semantic                   | Generated Method                   |
| -------------------------- | ---------------------------------- |
| `api.login`                | `v1AuthLoginCredentialsCreate`     |
| `api.loginMfa`             | `providerMfaVerifyLogin`           |
| `api.loginAzure`           | `v1ProviderLoginAzureAdCreate`     |
| `api.refreshToken`         | `v1AuthRefreshCreate`              |
| `api.mfaSetup`             | `v1AuthMfaSetupCreate`             |
| `api.mfaVerify`            | `v1AuthMfaVerifyCreate`            |
| `api.mfaEnable`            | `v1AuthMfaEnablePartialUpdate`     |
| `api.requestPasswordReset` | `v1AuthPasswordResetRequestCreate` |
| `api.resetPassword`        | `v1ResetPasswordCreate`            |
| `api.deviceRegister`       | `v1AuthDeviceRegisterCreate`       |

### Users

| Semantic             | Generated Method             |
| -------------------- | ---------------------------- |
| `api.userList`       | `v1UserList`                 |
| `api.userDetail`     | `v1UserDetail`               |
| `api.userCreate`     | `v1UserCreate`               |
| `api.userUpdate`     | `v1UserPartialUpdate`        |
| `api.userDelete`     | `v1UserDelete`               |
| `api.userProfile`    | `v1CurrentUserList`          |
| `api.changePassword` | `v1UserChangePasswordCreate` |

### Folders

| Semantic                  | Generated Method        |
| ------------------------- | ----------------------- |
| `api.folderList`          | `v1FolderList`          |
| `api.folderDetail`        | `v1FolderDetail`        |
| `api.folderCreate`        | `v1FolderCreate`        |
| `api.folderPartialUpdate` | `v1FolderPartialUpdate` |
| `api.folderDelete`        | `v1FolderDelete`        |
| `api.folderConfig`        | `v1ConfigFolderDetail`  |

### Questionnaires

| Semantic                          | Generated Method                |
| --------------------------------- | ------------------------------- |
| `api.questionnaireList`           | `v1QuestionnaireList`           |
| `api.questionnaireDetail`         | `v1QuestionnaireDetail`         |
| `api.questionnaireCreate`         | `v1QuestionnaireCreate`         |
| `api.questionnairePartialUpdate`  | `v1QuestionnairePartialUpdate`  |
| `api.questionnaireFork`           | `v1QuestionnaireForkCreate`     |
| `api.questionnairePublish`        | `v1QuestionnairePublishCreate`  |
| `api.questionnaireDelete`         | `v1QuestionnaireDelete`         |
| `api.questionnaireConfig`         | `v1ConfigQuestionnaireDetail`   |
| `api.questionnaireSubmissionList` | `v1QuestionnaireSubmissionList` |
| `api.questionnaireDeletedList`    | `v1QuestionnaireDeletedList`    |
| `api.questionnaireRestore`        | `v1QuestionnaireRestoreCreate`  |

### Enrollments

| Semantic                 | Generated Method            |
| ------------------------ | --------------------------- |
| `api.enrollmentList`     | `v1EnrollmentList`          |
| `api.enrollmentCreate`   | `v1EnrollmentCreate`        |
| `api.enrollmentUpdate`   | `v1EnrollmentPartialUpdate` |
| `api.enrollmentDelete`   | `v1EnrollmentDelete`        |
| `api.enrollmentUserList` | `v1EnrollmentUserList`      |

### Permissions

| Semantic                                   | Generated Method                         |
| ------------------------------------------ | ---------------------------------------- |
| `api.folderPermissionList`                 | `v1FolderPermissionList`                 |
| `api.folderPermissionCreate`               | `v1FolderPermissionCreate`               |
| `api.folderPermissionPartialUpdate`        | `v1FolderPermissionPartialUpdate`        |
| `api.folderPermissionDelete`               | `v1FolderPermissionDelete`               |
| `api.questionnairePermissionList`          | `v1QuestionnairePermissionList`          |
| `api.questionnairePermissionCreate`        | `v1QuestionnairePermissionCreate`        |
| `api.questionnairePermissionPartialUpdate` | `v1QuestionnairePermissionPartialUpdate` |
| `api.questionnairePermissionDelete`        | `v1QuestionnairePermissionDelete`        |

### Other

| Semantic                    | Generated Method                |
| --------------------------- | ------------------------------- |
| `api.configList`            | `v1ConfigList`                  |
| `api.pluginList`            | `v1PluginDefinitionList`        |
| `api.supersetDashboardList` | `v1AnalyticsDashboardEmbedList` |
| `api.deviceList`            | `v1DeviceList`                  |
| `api.deviceDetail`          | `v1DeviceDetail`                |

## Server-Side API

The Nuxt server (Nitro) hosts several API routes under `server/api/`. These routes run on the server, not in the browser, and are protected by the global JWT verification middleware.

### Server Routes

| Route                                     | Method | Purpose                                  |
| ----------------------------------------- | ------ | ---------------------------------------- |
| `/api/ai/chat`                            | POST   | AI Designer chat — streams LLM responses |
| `/api/engine/build`                       | POST   | Trigger questionnaire engine build       |
| `/api/engine/versions`                    | GET    | List engine versions from CDN            |
| `/api/engine/versions`                    | DELETE | Delete an engine version from CDN        |
| `/api/questionnaire/[id]/anonymous-build` | POST   | Build anonymous questionnaire link       |
| `/api/questionnaire/[id]/anonymous-links` | GET    | List anonymous links for a questionnaire |
| `/api/questionnaire/[id]/anonymous-links` | DELETE | Delete anonymous links                   |
| `/api/hello`                              | GET    | Health check endpoint                    |

### JWT Middleware

All `/api/*` routes are protected by the global middleware at `server/middleware/auth.ts`. This middleware:

1. Extracts the `Authorization: Bearer <token>` header
2. Verifies the HS256 signature and `exp` claim using `JWT_SECRET` (via `jose`)
3. Rejects refresh tokens and MFA challenge tokens with 403
4. Attaches the verified `JwtPayload` to `event.context.auth`

The middleware runs before any route handler. Non-API routes (pages, `_nuxt/*` assets) are not affected.

### Auth Helpers

`server/utils/requireAuth.ts` provides two auto-imported helpers:

```typescript
// Returns JwtPayload or throws 401
const auth = requireAuth(event);

// Returns JwtPayload or throws 403 if role doesn't match
const auth = requireRole(event, "provider");
```

### `JwtPayload` Interface

Defined in `server/types/auth.ts`:

```typescript
interface JwtPayload {
  sub: string; // User ID
  exp: number; // Expiry timestamp
  iat: number; // Issued-at timestamp
  role: "provider" | "device";
  pid?: string; // Provider ID
  did?: string; // Device ID
  pat?: string; // Patient ID
  auth_method?: string;
  token_type?: string;
  refresh?: boolean;
  mfa_challenge?: boolean;
}
```

The `H3EventContext` interface is augmented in `server/types/h3.d.ts` to include `auth: JwtPayload`, providing full type safety in route handlers.

### Auth Header Forwarding

The middleware verifies the token but does **not** strip the `Authorization` header. Route handlers that forward requests to the backend (e.g., engine routes) pass the original header through, allowing the backend to perform its own independent token validation.

### Server Utility

`server/utils/useApiU.ts` — minimal utility for making requests to the backend from server routes. Uses the same `API_URL`/`API_KEY` config but without Axios interceptors.
