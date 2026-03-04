# Platform Overview

Medipal is a medical questionnaire management platform built as a suite of microservices and client applications.

## What is Medipal?

Medipal enables healthcare organisations to design, distribute, and manage digital questionnaires across web and mobile devices.

## Architecture at a Glance

The platform consists of:

- **Backend** — Python/FastAPI server with PostgreSQL, Redis, and a plugin system
- **Frontend** — Nuxt 4 admin SPA for clinicians and administrators
- **Mobile** — Nuxt 4 + Capacitor 7 hybrid app (iOS & Android) with offline-first storage
- **Tracker** — standalone Python analytics service for mobile usage events
- **Schema layer** — shared JSON Schema definitions that drive code generation for all typed clients and models
- **Questionnaire pipeline** — core builder → engine builder → single-file HTML bundles delivered via CDN and embedded as iframes
- **Infrastructure** — Terraform (AWS), GitHub Actions CI/CD, Nginx reverse proxy, Fastlane mobile builds

## Key Concepts

- **Schema-driven development** — `mp-schema` is the single source of truth. CI/CD auto-generates TypeScript API clients (frontend, mobile, tracker), Python Pydantic models, SQLAlchemy ORM, route stubs, and configuration schema from it.
- **Plugin architecture** — server plugins extend functionality via `mp-server-plugin-sdk` (Python); frontend plugins use `mp-frontend-plugin-template` (TypeScript). Plugins are loaded dynamically without modifying core code.
- **Code generation pipeline** — `genma` + `yamser` (Python) and `mp-typescript-api-generator` (TypeScript) transform schema changes into ready-to-use packages across all services.
- **Offline-first mobile** — encrypted SQLite-backed local storage with background sync, push notifications, and OTA live updates.
- **Infrastructure-as-code** — `mp-tf-infrastructure` manages AWS resources (VPC, EC2, RDS, S3, CloudFront, Route 53) via Terraform; `mp-github-actions` provides centralised CI/CD workflows.

See [Platform Architecture](/overview/platform) for the full dependency diagram.
