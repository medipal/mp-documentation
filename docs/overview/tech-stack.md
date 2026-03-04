# Tech Stack

An overview of the technologies, frameworks, and tools used across the Medipal platform.

## Backend

- **Language:** Python 3.12+
- **Framework:** FastAPI
- **Database:** PostgreSQL with Alembic migrations
- **ORM:** SQLAlchemy
- **Cache:** Redis
- **Task scheduling:** APScheduler
- **Events:** CloudEvents with outbox pattern
- **Internal libraries:** pylog (logging), storiel (storage), confirion (config), genma (code generation), yamser (YAML serialisation), fyler (file utilities), structo (data structures)

## Frontend

- **Framework:** Nuxt 4 / Vue 3
- **Language:** TypeScript
- **UI library:** Nuxt UI
- **Styling:** Tailwind CSS
- **State management:** Pinia
- **Authentication:** Credentials + Azure AD (MSAL)

## Mobile

- **Framework:** Nuxt 4 + Capacitor 7
- **Local database:** Encrypted SQLite (`@capacitor-community/sqlite`)
- **Push notifications:** Native iOS/Android push
- **Live updates:** Custom Capacitor plugin (OTA)

## Schema & Code Generation

- **Schema format:** JSON Schema (YAML)
- **API specs:** OpenAPI 3.x
- **Python code generation:** `genma` + `yamser` (Jinja2 templates)
- **TypeScript client generation:** `mp-typescript-api-generator` (wraps `swagger-typescript-api`)
- **TypeScript templates:** `mp-typescript-api-generator-templates` (ETA)
- **Runtime validation:** `mp-typescript-api-validation` (AJV)

## Infrastructure

- **CI/CD:** GitHub Actions (`mp-github-actions`)
- **IaC:** Terraform (`mp-tf-infrastructure`) — HCL
- **Cloud:** AWS (EC2, RDS, S3, CloudFront, Route 53, ElastiCache Redis)
- **Containers:** Docker, AWS ECR
- **Proxy:** Nginx (`mp-frontend-nginx-proxy`)
- **Mobile builds:** Fastlane (iOS TestFlight, Google Play)
- **Code signing:** `mp-fastlane-certificates` (fastlane match)
- **Documentation:** VitePress

## Testing

- **End-to-end:** Playwright (`mp-e2e-tests`)
- **API integration:** pytest (`mp-api-tests`)

## Plugin System

- **Server plugins:** `mp-server-plugin-sdk` (Python) — hooks for events, scheduling, and custom API endpoints
- **Frontend plugins:** `mp-frontend-plugin-template` (TypeScript) — starter template for extending the admin UI
