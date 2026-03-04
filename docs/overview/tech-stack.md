# Tech Stack

::: info
This section is under development.
:::

An overview of the technologies, frameworks, and tools used across the Medipal platform.

## Backend

- **Language:** Python 3.12+
- **Framework:** FastAPI
- **Database:** PostgreSQL with Alembic migrations
- **ORM:** SQLAlchemy
- **Task scheduling:** APScheduler
- **Events:** CloudEvents with outbox pattern

## Frontend

- **Framework:** Nuxt 3 / Vue 3
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **State management:** Pinia
- **Authentication:** Credentials + Azure AD (MSAL)

## Mobile

- **Framework:** Nuxt 3 + Capacitor 7
- **Local database:** SQLite
- **Live updates:** Custom Capacitor plugin (OTA)

## Schema & Code Generation

- **Schema format:** JSON Schema (YAML)
- **API specs:** OpenAPI 3.x
- **Client generation:** swagger-typescript-api

## Infrastructure

- **CI/CD:** GitHub Actions
- **Containers:** Docker, AWS ECR
- **Proxy:** Nginx
- **Documentation:** VitePress
