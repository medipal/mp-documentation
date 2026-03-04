# Code Generation Pipeline

::: info
This section is under development.
:::

Medipal's CI pipeline automatically generates typed clients and models from the schema definitions whenever `mp-schema` changes.

## Pipeline Steps

1. Validate JSON Schema files
2. Generate OpenAPI specifications
3. Generate TypeScript API clients (`mp-frontend-api`, `mp-mobile-app-api`)
4. Generate Python models and SQLAlchemy definitions
5. Publish generated packages

## Generated Artefacts

- **TypeScript API clients** — used by the frontend and mobile app
- **Python models** — used by the backend server
- **Database migrations** — Alembic migration scripts

## Triggering Generation

Generation runs automatically on push to the `mp-schema` main branch and can be triggered manually via GitHub Actions.
