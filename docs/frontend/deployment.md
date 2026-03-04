# Deployment

## Overview

The application can be deployed in two ways:

1. **Docker** — multi-stage build producing a Docker image that runs a Nitro (Node.js) server (primary deployment method)
2. **Node server** — Nuxt output server (`index.mjs`) for SSR-capable deployments

## Docker Deployment

### Multi-Stage Build

The `Dockerfile` uses two stages:

```
Stage 1: builder
  ├─ Base: node:20-alpine
  ├─ Receives build secrets via --secret (not baked into image)
  ├─ Runs: nuxt build
  └─ Outputs: .output/

Stage 2: runner  ← deployed image
  ├─ Base: node:20-alpine
  ├─ Copies .output/ from builder
  ├─ Exposes port 3000
  └─ Runs: node .output/server/index.mjs  (Nitro server)
```

### Required Build Secrets

Passed via `docker build --secret`:

| Secret            | Purpose                         |
| ----------------- | ------------------------------- |
| `npm_token`       | GitHub Package Registry auth    |
| `giget_token`     | Nuxt layer fetching             |
| `api_url`         | Backend base URL                |
| `api_key`         | Static API key                  |
| `api_tenant_id`   | Multi-tenant identifier         |
| `api_instance_id` | Instance identifier             |
| `crypto_key`      | Encryption key for localStorage |

### Build Command

```bash
docker build \
  --secret id=npm_token,src=.secrets/npm_token \
  --secret id=api_url,src=.secrets/api_url \
  --secret id=api_key,src=.secrets/api_key \
  --secret id=api_tenant_id,src=.secrets/api_tenant_id \
  --secret id=api_instance_id,src=.secrets/api_instance_id \
  --secret id=crypto_key,src=.secrets/crypto_key \
  -t mp-frontend:latest .
```

## Runtime Environment — Why Vars Cannot Be Baked In

Nuxt `runtimeConfig.public.*` values are resolved **at server startup** from the process environment. They are **not** embedded in the build output. This means:

- The same Docker image can be deployed to development, staging, and production by passing different env vars.
- Secrets never need to be stored inside the image layer.
- Changing a config value does not require a rebuild — just a container restart with new vars.

All required vars must be passed to the container via `-e` flags or docker-compose `environment:`.

**Minimal run example:**

```bash
docker run -p 3000:3000 \
  -e NUXT_PUBLIC_API_URL=https://api.example.com \
  -e NUXT_PUBLIC_API_KEY=your-key \
  -e NUXT_PUBLIC_API_TENANT_ID=uuid \
  -e NUXT_PUBLIC_API_INSTANCE_ID=uuid \
  -e NUXT_PUBLIC_CRYPTO_KEY=your-key \
  mp-frontend:latest
```

::: info
`NITRO_HOST=0.0.0.0` and `NITRO_PORT=3000` are already set in the Dockerfile and do not need to be passed at runtime.
:::

**Env var naming convention:** Nuxt reads `NUXT_PUBLIC_FOO` and exposes it as `useRuntimeConfig().public.FOO`. Always use the `NUXT_PUBLIC_` prefix for public runtime config.

## Environment Variables (Runtime Config)

All env vars are accessed in code via `useRuntimeConfig().public.*`. Never use `process.env` directly in components or stores.

| Variable                                   | Required | Purpose                                   |
| ------------------------------------------ | -------- | ----------------------------------------- |
| `NUXT_PUBLIC_API_URL`                      | Yes      | Backend base URL                          |
| `NUXT_PUBLIC_API_KEY`                      | Yes      | Static API key (`X-API-KEY` header)       |
| `NUXT_PUBLIC_API_TENANT_ID`                | Yes      | Multi-tenant identifier                   |
| `NUXT_PUBLIC_API_INSTANCE_ID`              | Yes      | Instance identifier                       |
| `NUXT_PUBLIC_CRYPTO_KEY`                   | Yes      | Encryption key for sensitive localStorage |
| `NUXT_PUBLIC_MOCK_API_URL`                 | No       | Mock API URL for development              |
| `NUXT_PUBLIC_QUESTIONNAIRE_CORES`          | No       | JSON array of core manifest URLs          |
| `NUXT_PUBLIC_QUESTIONNAIRE_ENGINES`        | No       | JSON array of engine manifest URLs        |
| `NUXT_PUBLIC_SHARED_DEMO_PATIENT_CREATION` | No       | Enables shared demo patient creation      |
| `NUXT_PUBLIC_CLIENTID`                     | No       | Azure AD application (client) ID          |
| `NUXT_PUBLIC_AUTHORITY`                    | No       | Azure AD tenant authority URL             |
| `NUXT_PUBLIC_REDIRECT_URI`                 | No       | OAuth callback URL                        |
| `NUXT_PUBLIC_POSTLOGOUT_REDIRECT_URI`      | No       | Post-logout redirect URL                  |
| `APP_VERSION`                              | Auto     | Injected from `package.json` version      |
| `GIT_COMMIT`                               | Auto     | Git commit SHA at build time              |
| `GIT_BRANCH`                               | Auto     | Git branch — controls Sentry and devtools |
| `DOCKER_IMAGE`                             | Auto     | Docker image tag                          |
| `DOCKER_IMAGE_ID`                          | Auto     | Docker image digest                       |
| `BUILD_TIMESTAMP`                          | Auto     | ISO timestamp of the build                |

## Reverse Proxy — mp-frontend-nginx-proxy

The Nitro container (port 3000) is **not** exposed directly to the internet. In production it sits behind `mp-frontend-nginx-proxy` — a separate repository containing an nginx configuration that:

- Terminates SSL
- Routes incoming traffic to the Nitro container on port 3000
- Handles caching headers and compression

All nginx configuration for production lives in the `mp-frontend-nginx-proxy` repo.

## GitHub Actions — Application Deployment

Existing workflows for the main application:

- `.github/workflows/deploy-development.yml` — deploy to development environment
- `.github/workflows/deploy-staging.yml` — deploy to staging environment

## GitHub Actions — Documentation Deployment

The documentation is deployed to GitHub Pages automatically:

**Workflow**: `.github/workflows/deploy-docs.yml`
**Trigger**: Push to `main` branch with changes in `docs/**`, or manual dispatch

```yaml
# Workflow deploys to: https://medipal.github.io/mp-frontend/
```

### Enabling GitHub Pages

To activate GitHub Pages for the repository:

1. Go to **Settings → Pages**
2. Under **Source**, select **GitHub Actions**
3. Push a commit to `main` that changes any file under `docs/`

::: info
GitHub Pages requires GitHub Pro, Team, or Enterprise for private repositories.
:::

## Documentation Scripts

Run documentation locally:

```bash
npm run docs:dev      # Dev server at http://localhost:5173/mp-frontend/
npm run docs:build    # Build to docs/.vitepress/dist/
npm run docs:preview  # Preview built docs at http://localhost:4173/mp-frontend/
```

## Local Development with Mock API

Set `NUXT_PUBLIC_MOCK_API_URL` in `.env` to point to a local mock server:

```bash
NUXT_PUBLIC_MOCK_API_URL=http://localhost:8080
```

When set, the API client routes requests to the mock server instead of the real backend.

## Sentry Integration

Sentry is active when `GIT_BRANCH` is not a development branch. Configure via the Sentry Nuxt module in `nuxt.config.ts`. The DSN and environment are injected at build time.

## Mobile App Deployment

The patient-facing mobile app (`mp-mobile-app`) is distributed through native app stores
using `mp-mobile-app-builder` and Fastlane.

- [iOS Build](/mobile/ios-build) — Fastlane `beta` lane, `fastlane match` code signing, TestFlight upload
- [Android Build](/mobile/android-build) — Fastlane `internal` lane, Google Play internal testing track
