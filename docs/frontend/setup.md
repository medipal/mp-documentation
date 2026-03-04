# Setup & Installation

## Prerequisites

- **Node.js** ≥ 20.0.0
- Access to `npm.pkg.github.com` for private packages (`@medipal/mp-frontend-api`, `@medipal/mp-nuxt-api-layer`)
- A GitHub personal access token (PAT) with `read:packages` scope

## 1. Authenticate with GitHub Packages

The project uses packages hosted on GitHub Package Registry. You need to authenticate before installing.

Create or edit `~/.npmrc`:

```
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_PAT
@medipal:registry=https://npm.pkg.github.com
```

## 2. Clone and Install

```bash
git clone https://github.com/medipal/mp-frontend.git
cd mp-frontend
npm install
```

## 3. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with the appropriate values:

| Variable                                       | Required | Description                                                             |
| ---------------------------------------------- | -------- | ----------------------------------------------------------------------- |
| `NUXT_PUBLIC_API_URL`                          | Yes      | Backend base URL (e.g. `https://api.medipal.com`)                       |
| `NUXT_PUBLIC_API_KEY`                          | Yes      | Static API key sent as `X-API-KEY` header                               |
| `NUXT_PUBLIC_API_TENANT_ID`                    | Yes      | Multi-tenant identifier                                                 |
| `NUXT_PUBLIC_API_INSTANCE_ID`                  | Yes      | Instance identifier sent to the backend                                 |
| `NUXT_PUBLIC_CRYPTO_KEY`                       | Yes      | Encryption key for sensitive localStorage values                        |
| `NUXT_PUBLIC_MOCK_API_URL`                     | No       | Optional mock API URL for local development                             |
| `NUXT_PUBLIC_QUESTIONNAIRE_CORES`              | No       | JSON array of questionnaire core manifest URLs                          |
| `NUXT_PUBLIC_QUESTIONNAIRE_ENGINES`            | No       | JSON array of engine manifest URLs                                      |
| `NUXT_PUBLIC_SHARED_DEMO_PATIENT_CREATION`     | No       | Enables shared demo patient creation flow                               |
| `S3_ANONYMOUS_BUCKET`                          | No       | S3 bucket for anonymous questionnaire HTML files                        |
| `S3_ANONYMOUS_REGION`                          | No       | AWS region (default: `eu-central-1`)                                    |
| `S3_ANONYMOUS_CDN_URL`                         | No       | CloudFront CDN base URL (e.g. `https://cdn.medipal.dev`)                |
| `AWS_ACCESS_KEY_ID`                            | No       | AWS credentials for S3 access                                           |
| `AWS_SECRET_ACCESS_KEY`                        | No       | AWS credentials for S3 access                                           |
| `FEATURE_AI_TOOLS`                             | No       | Enable AI Designer assistant (`true`/`false`)                           |
| `FEATURE_ANONYMOUS_QUESTIONNAIRES`             | No       | Enable anonymous questionnaire option (`true`/`false`)                  |
| `FEATURE_ENGINE_BUILDER`                       | No       | Enable engine version publishing to CDN (`true`/`false`)                |
| `FEATURE_WORKFLOWS`                            | No       | Enable visual Workflow Editor (`true`/`false`)                          |
| `FEATURE_ROLES`                                | No       | Enable Roles management tab in Admin Panel (`true`/`false`)             |
| `FEATURE_SHARED_DOCUMENTS`                     | No       | Enable Shared Documents tab in Admin Panel → System (`true`/`false`)    |
| `FEATURE_SUPERSET_DASHBOARDS`                  | No       | Enable Superset analytics dashboards (`true`/`false`)                   |
| `FEATURE_QUESTIONNAIRE_REVISIONS`              | No       | Enable Revision History tab in questionnaire Relations (`true`/`false`) |
| `S3_SHARED_DOCUMENTS_BUCKET`                   | No       | S3 bucket for shared Markdown documents (consent, etc.)                 |
| `S3_SHARED_DOCUMENTS_REGION`                   | No       | AWS region for shared documents bucket (default: `eu-central-1`)        |
| `S3_SHARED_DOCUMENTS_CDN_URL`                  | No       | CloudFront CDN URL for shared documents bucket                          |
| `NUXT_PUBLIC_SHARED_DOCUMENTS_CDN_URL`         | No       | CDN base URL embedded in device auth QR code payload                    |
| `NUXT_PUBLIC_SHARED_DOCUMENTS_CONSENT_LOCALES` | No       | Comma-separated locale codes for consent (e.g. `en_GB,pl_PL`)           |

::: tip
All environment variables are accessed in code via `useRuntimeConfig().public.*`. Never use `process.env` directly in components or stores.
:::

## 4. Run Development Server

```bash
npm run dev
```

The app starts at `http://localhost:3000`.

## 5. Other Scripts

```bash
npm run build          # Production build (requires env vars at build time for some)
npm run preview        # Preview production build locally
npm run lint           # Run ESLint
npm run lint:fix       # Auto-fix lint issues
npm run check-types    # TypeScript type check (no emit)
npm run pseudo-locale  # Regenerate en_PS pseudo-locale file
```

## Documentation Scripts

```bash
npm run docs:dev       # Start VitePress dev server (http://localhost:5173/mp-frontend/)
npm run docs:build     # Build documentation site
npm run docs:preview   # Preview built documentation
```

## 6. Configure Root Folder (Required for Questionnaire Creation)

After the application is running, you must configure the **root folder** before questionnaires can be created. Navigate to the root folder's **Configuration → Advanced** tab and set the following:

### Questionnaire Engines (required)

Add at least one CDN URL pointing to a questionnaire engine `manifest.json`. Without this, the "Create Questionnaire" modal will have no engine to select.

Example:

```
https://cdn.example.com/engines/@medipal/questionnaire-engine-default
```

### Questionnaire Cores (required)

Add at least one CDN URL pointing to a questionnaire core `manifest.json`. Cores provide the rendering runtime for questionnaires.

Example:

```
https://cdn.example.com/cores/@medipal/questionnaire-core-default
```

### Default Questionnaire Language (required)

Under the **Language Settings** section, you must:

1. Enable **Allow multiple languages**
2. Set the **Initial Default Language** (e.g. `en_GB`)
3. Configure **Available Languages** (the languages users can choose from when creating questionnaires)

::: warning
If no default language is configured on the root folder, creating a questionnaire will fail because the language settings section in the creation modal relies on the folder's `questionnaire_config` to determine available and default languages.
:::

These settings are **inherited** by child folders. You only need to configure them on the root folder unless a child folder needs to override them.

## Common Issues

### `npm install` fails with 401

You haven't authenticated with GitHub Package Registry. Follow step 1 above.

### `nuxt prepare` fails

Run `npm install` first — `postinstall` runs `nuxt prepare` automatically.

### App shows login page but credentials don't work

Check that `NUXT_PUBLIC_API_URL` and `NUXT_PUBLIC_API_KEY` are correctly set in `.env`.

### TypeScript errors after pulling

Run `npm run postinstall` (or `npx nuxt prepare`) to regenerate Nuxt's auto-import type declarations.
