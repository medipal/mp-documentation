# CI/CD Pipeline

::: info
This section is under development.
:::

Medipal uses GitHub Actions for continuous integration and deployment across all repositories.

## Pipeline Overview

Every repository has its own workflow configuration. Common stages include linting, testing, building, and deploying.

## Schema-Driven Generation

When `mp-schema` changes, CI pipelines automatically regenerate typed API clients for both the frontend and mobile app.

## Docker Builds

Backend and frontend services are containerised using Docker. Images are pushed to AWS ECR and deployed via Nginx reverse proxy.

## Deployment Environments

- **Development** — automatic deployment on push to `develop`
- **Staging** — automatic deployment on push to `main`
- **Production** — manual approval required
