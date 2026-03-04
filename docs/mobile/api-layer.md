# API Layer

## Overview

The app communicates with three external API surfaces:

| Client      | Package                              | Config File                  | Purpose                                            |
| ----------- | ------------------------------------ | ---------------------------- | -------------------------------------------------- |
| Main API    | `@medipal/mp-frontend-api`           | `app/api.config.ts`          | Device auth, enrollments, questionnaire submission |
| Tracker API | `@medipal/mp-mobile-app-tracker-api` | `app/tracker_api.config.ts`  | Analytics events                                   |
| Nuxt Layer  | `@medipal/mp-nuxt-api-layer`         | via `nuxt.config.ts extends` | Shared `useApi()` composable                       |

## `useTenantApi()` — Per-Tenant API Client

This is the **primary** way to make authenticated API calls.

```ts
const api = useTenantApi(tenantId);
const response = await api.get("/some/endpoint");
```

### What It Does

- Creates a per-tenant Axios instance using the tenant's stored `url` and `access_token`
- Automatically handles token refresh:
  1. On `401`, calls `refreshToken` for that specific tenant
  2. Queues all concurrent requests that arrive during refresh
  3. Retries queued requests with the new token once refresh completes
  4. Uses an `isRefreshing` flag to prevent multiple simultaneous refresh calls

::: danger Do not implement your own token refresh
All API calls must go through `useTenantApi()`. Implementing token refresh logic elsewhere will cause race conditions and duplicate refresh calls.
:::

### Token Storage

Tokens are stored in the `tenants` SQLite table:

| Column             | Description                                |
| ------------------ | ------------------------------------------ |
| `access_token`     | Bearer token attached to every API request |
| `refresh_token`    | Used to obtain a new access token          |
| `token_expires_at` | ISO datetime for proactive refresh         |

## Main API Methods

Defined in `app/api.config.ts`, using `@medipal/mp-frontend-api`:

| Method                | Purpose                                                   |
| --------------------- | --------------------------------------------------------- |
| `deviceLogin`         | Authenticate device with enrollment token                 |
| `refreshToken`        | Refresh an expired access token                           |
| `deviceConsent`       | Submit device terms acceptance                            |
| `currentUser`         | Fetch current user info                                   |
| `deviceEnrollConsent` | Submit enrollment consent                                 |
| `enrollmentUpdate`    | Update enrollment status                                  |
| `deviceSync`          | Full device sync (questionnaires, enrollments, schedules) |
| `questionnaireSubmit` | Submit a completed questionnaire response                 |
| `getInstance`         | Fetch tenant instance details                             |

## Nuxt API Layer

The app extends `github:medipal/mp-nuxt-api-layer`:

```ts
// nuxt.config.ts
extends: ['github:medipal/mp-nuxt-api-layer']
```

This provides the `useApi()` composable and shared API utilities. It requires `GIGET_AUTH` (a GitHub Classic PAT) set as an environment variable at dev/build time.

## Error Handling

| Scenario                        | Behaviour                                             |
| ------------------------------- | ----------------------------------------------------- |
| `401` response                  | `useTenantApi` interceptor refreshes token, retries   |
| Refresh fails                   | `NotAuthenticatedEvent` emitted → redirect to re-auth |
| Network error during submission | Submission saved as `pending_submits`, retried later  |

## Environment Variables

```ini
API_URL=https://api.example.com
TRACKER_API_URL=https://tracker.example.com
TRACKER_API_KEY=your-tracker-key
GIGET_AUTH=ghp_xxxx     # GitHub PAT for fetching mp-nuxt-api-layer
```
