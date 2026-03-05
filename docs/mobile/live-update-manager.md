# Live Update Manager

`mp-live-update-manager` is a full-stack Nuxt 4 application for managing over-the-air (OTA) live update bundles for the Medipal mobile app. It handles build orchestration, bundle storage, environment promotion, and audit logging.

For the client-side Capacitor plugin that applies updates on-device, see [Live Update](./live-update).

---

## Purpose

- Build live update bundles from any `mp-mobile-app` branch or tag
- Store immutable bundles on S3 with metadata
- Promote bundles across environments (development → staging → production)
- Invalidate CloudFront cache on deployment for instant propagation
- Maintain a complete audit trail of all actions

---

## Tech Stack

| Layer            | Technologies                                        |
| ---------------- | --------------------------------------------------- |
| **Frontend**     | Nuxt 4, Vue 3, TypeScript, Tailwind CSS, Nuxt UI v4 |
| **Backend**      | Nitro, AWS SDK v3 (S3 + CloudFront), Jose (JWT)     |
| **Code Quality** | ESLint 9, Prettier, Husky, lint-staged              |
| **Deployment**   | Docker (Node.js 22 Alpine), GitHub Actions          |

---

## Project Structure

```
mp-live-update-manager/
├── app/                              # Frontend (Nuxt 4)
│   ├── components/                   # Vue components
│   │   ├── ActivateDialog.vue        # Bundle deployment modal
│   │   ├── AppHeader.vue             # Navigation bar
│   │   ├── AuditTable.vue            # Audit entries table
│   │   ├── BuildLogViewer.vue        # Live log streaming modal
│   │   ├── BuildPanel.vue            # Build creation + status
│   │   ├── BundleTable.vue           # Bundle list
│   │   ├── DeleteConfirmDialog.vue   # Delete confirmation
│   │   └── EnvironmentCard.vue       # Environment status card
│   ├── composables/
│   │   └── useAuth.ts                # Auth state + API helper
│   ├── middleware/
│   │   └── auth.global.ts            # Client route guard
│   ├── pages/
│   │   ├── index.vue                 # Dashboard
│   │   ├── builds.vue                # Build management
│   │   ├── audit.vue                 # Audit log viewer
│   │   └── login.vue                 # Login form
│   └── types/
│       └── index.ts                  # Shared TypeScript interfaces
├── server/                           # Backend (Nitro)
│   ├── api/                          # 12 API endpoints
│   │   ├── auth/                     # login, session, logout
│   │   ├── builds/                   # create, list, get, logs
│   │   ├── bundles/                  # list, delete
│   │   ├── environments/             # list, activate
│   │   ├── git/                      # branches
│   │   └── audit/                    # log
│   ├── middleware/                   # API key + JWT validation
│   └── utils/                        # S3, CloudFront, audit, build worker
├── nuxt.config.ts
├── Dockerfile
└── package.json
```

---

## Setup

### Prerequisites

- Node.js 22+
- AWS credentials with S3 and CloudFront access
- GitHub token with read access to `mp-mobile-app`

### Installation

```bash
git clone https://github.com/medipal/mp-live-update-manager.git
cd mp-live-update-manager
cp .env.example .env    # fill in all required values
npm install
npm run dev             # starts on http://localhost:3000
```

---

## Authentication

All API requests require two layers of authentication:

1. **API Key** — `X-API-Key` header on every request (anti-DDoS)
2. **JWT Token** — `Authorization: Bearer <token>` on all routes except login

### Auth Flow

```
Client                              Server
  │                                   │
  ├─ POST /api/auth/login ───────────►│  (username + password + API key)
  │                                   │
  │◄── JWT token (HS256, 24h) ───────┤
  │                                   │
  ├─ GET /api/builds ────────────────►│  (Authorization: Bearer <token>)
  │  + X-API-Key header               │
  │                                   │
```

Credentials are configured via `AUTH_USERNAME` and `AUTH_PASSWORD` environment variables. Single-user authentication — no RBAC.

---

## API Endpoints

| Method | Endpoint                           | Description                      |
| ------ | ---------------------------------- | -------------------------------- |
| POST   | `/api/auth/login`                  | Generate JWT token               |
| GET    | `/api/auth/session`                | Validate current session         |
| POST   | `/api/auth/logout`                 | Clear authentication             |
| GET    | `/api/environments`                | List environments with manifests |
| POST   | `/api/environments/[env]/activate` | Deploy bundle to environment     |
| POST   | `/api/builds`                      | Queue new build from git ref     |
| GET    | `/api/builds`                      | List all builds                  |
| GET    | `/api/builds/[id]`                 | Get build details                |
| GET    | `/api/builds/[id]/logs`            | Get build logs                   |
| GET    | `/api/bundles`                     | List all bundles                 |
| DELETE | `/api/bundles/[id]`                | Delete bundle (fails if active)  |
| GET    | `/api/git/branches`                | List remote branches and tags    |
| GET    | `/api/audit`                       | Fetch audit log                  |

---

## Build Orchestration

Builds are queued in-memory and executed serially (max 1 concurrent build).

### Build Flow

```
Queue → Clone → Install → Generate → Package → Upload → Done
  │                                                        │
  └─ Status tracked in real-time with log streaming ───────┘
```

**Stages:**

1. **Cloning** — `git clone --depth 1 --branch <ref>` from `mp-mobile-app`
2. **Installing** — `npm ci` with `NPM_TOKEN` and `GIGET_TOKEN`
3. **Building** — `nuxt generate` (static bundle)
4. **Packaging** — `generate_live_update_package.js` → `live-update.zip`
5. **Uploading** — S3 PUT (ZIP + `metadata.json`)
6. **Logging** — audit entry creation
7. **Cleanup** — remove build directory

Build logs are streamed to the UI in real-time with 2-second polling. Failed stage output is highlighted in red.

---

## Environment Promotion

Three environments: **development**, **staging**, **production**.

### Activation Flow

```
Select bundle → Activate on environment → Update manifest.json → CloudFront invalidation
```

1. User selects a bundle and target environment
2. Server updates `manifest.json` on S3 (no-cache headers for instant propagation)
3. CloudFront cache invalidation is triggered automatically
4. Mobile app detects the new manifest on next launch and downloads the updated bundle

Safety checks prevent deleting bundles that are currently active on any environment.

---

## S3 Storage Layout

```
s3://{S3_BUCKET}/{S3_PREFIX}/
├── bundles/{bundleId}/
│   ├── live-update.zip           # Immutable, Cache-Control: max-age=31536000
│   └── metadata.json             # Immutable, Cache-Control: max-age=31536000
├── environments/{env}/
│   └── manifest.json             # No-cache, no-store (instant propagation)
└── audit/
    └── log.jsonl                 # Append-only audit trail
```

**Bundle metadata:**

```json
{
  "version": "1.2.3",
  "hash": "a1b2c3d4-...",
  "timestamp": "2026-03-05T12:00:00.000Z",
  "gitSha": "abc123def456",
  "gitBranch": "main",
  "size": 5242880,
  "builtBy": "live-update-manager"
}
```

**Environment manifest:**

```json
{
  "hash": "a1b2c3d4-...",
  "version": "1.2.3",
  "timestamp": "2026-03-05T12:00:00.000Z",
  "contentUrl": "https://cdn.medipal.dev/live-update/bundles/..."
}
```

---

## Audit Trail

All actions are logged in JSONL format on S3 (`audit/log.jsonl`). The log is append-only.

### Entry Schema

```json
{
  "timestamp": "2026-03-05T12:00:00.000Z",
  "action": "activate",
  "environment": "production",
  "bundleId": "1.2.3_abc123",
  "version": "1.2.3",
  "fromVersion": "1.2.2",
  "user": "admin",
  "details": "Promoted to production"
}
```

Actions: `activate`, `delete`, `upload`.

---

## Docker Deployment

```dockerfile
# Multi-stage build
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
RUN apk add --no-cache git
WORKDIR /app
COPY --from=builder /app/.output .output
ENV NITRO_HOST=0.0.0.0
ENV NITRO_PORT=3000
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

```bash
docker build -t mp-live-update-manager .
docker run -p 3000:3000 --env-file .env mp-live-update-manager
```

---

## Environment Variables

| Variable                     | Required | Default                   | Description                              |
| ---------------------------- | -------- | ------------------------- | ---------------------------------------- |
| `API_KEY`                    | Yes      | —                         | Anti-DDoS key for all API requests       |
| `AUTH_USERNAME`              | No       | `admin`                   | Login username                           |
| `AUTH_PASSWORD`              | Yes      | —                         | Login password                           |
| `JWT_SECRET`                 | Yes      | —                         | HS256 signing key                        |
| `JWT_EXPIRES_IN`             | No       | `24h`                     | Token expiration                         |
| `AWS_ACCESS_KEY_ID`          | Yes      | —                         | AWS credentials                          |
| `AWS_SECRET_ACCESS_KEY`      | Yes      | —                         | AWS credentials                          |
| `AWS_REGION`                 | No       | `eu-north-1`              | AWS region                               |
| `S3_BUCKET`                  | No       | `mp-cdn-files`            | S3 bucket name                           |
| `S3_PREFIX`                  | No       | `live-update`             | S3 key prefix                            |
| `CLOUDFRONT_DISTRIBUTION_ID` | Yes      | —                         | CloudFront distribution for invalidation |
| `CDN_BASE_URL`               | No       | `https://cdn.medipal.dev` | CDN base URL for bundle URLs             |
| `GIT_REPO_URL`               | Yes      | —                         | Repository to clone for builds           |
| `GIT_TOKEN`                  | No       | —                         | GitHub token for authenticated clones    |
| `NPM_TOKEN`                  | No       | —                         | npm registry token                       |
| `GIGET_TOKEN`                | No       | —                         | Giget token                              |
| `BUILD_API_URL`              | No       | `http://localhost:8000`   | API URL injected into builds             |
| `BUILD_CRYPTO_KEY`           | No       | —                         | Crypto key injected into builds          |

---

## See Also

- [Live Update](./live-update) — client-side Capacitor plugin
- [Mobile App Builder](./mobile-app-builder) — native app store builds
- [Deployment](./deployment) — mobile deployment overview
- [Platform Architecture](/overview/platform) — how Live Update Manager fits into the system
