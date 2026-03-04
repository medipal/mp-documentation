# CI/CD Pipeline

Medipal uses GitHub Actions for continuous integration and deployment across all repositories. Shared workflows are centralised in `mp-github-actions`.

## Pipeline Overview

Every repository has its own workflow configuration. Common stages include linting, testing, building, and deploying.

## Schema-Driven Generation

When `mp-schema` changes, CI pipelines automatically regenerate:

- **TypeScript API clients** — `mp-frontend-api`, `mp-mobile-app-api`, `mp-mobile-app-tracker-api` (via `mp-typescript-api-generator`)
- **Python Pydantic models** — `mp-server-pydantic-models` (via `genma` + `yamser`)
- **Python SQLAlchemy ORM** — `mp-server-sql-alchemy-models`
- **FastAPI route stubs** — `mp-server-api`
- **Configuration schema** — `mp-server-config-schema`

See [Code Generation Pipeline](/schema/code-generation) for the full breakdown.

## Docker Builds

Backend and frontend services are containerised using Docker. Images are pushed to AWS ECR and deployed via Nginx reverse proxy.

- `mp-server` and `mp-tracker` produce Docker images
- `mp-frontend` and `mp-mobile-app` are built as static assets served behind `mp-frontend-nginx-proxy`
- Mobile native builds use Fastlane (`mp-mobile-app-builder`) for iOS TestFlight and Google Play distribution

## Deployment Environments

- **Development** — automatic deployment on push to `development`
- **Staging** — automatic deployment on push to `main`
- **Production** — manual approval required

Infrastructure is managed by `mp-tf-infrastructure` (Terraform on AWS).

## Centralized Workflows

The `mp-github-actions` repository provides shared workflows and composite actions used across the platform:

| Workflow        | Purpose                                                                              |
| --------------- | ------------------------------------------------------------------------------------ |
| Code generation | `mp-schema` push → regenerate TypeScript clients, Pydantic models, SQLAlchemy models |
| Build & test    | ESLint, Prettier, Vitest, Playwright e2e                                             |
| Publish         | npm packages to GitHub Packages, Docker images to AWS ECR                            |
| Mobile          | Android/iOS native builds via Fastlane, app store deployment                         |
| Deploy          | EC2 pull-based deployment for frontend services                                      |

See [Platform Architecture](/overview/platform) for how CI/CD fits into the overall system.
