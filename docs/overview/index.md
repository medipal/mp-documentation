# Platform Overview

::: info
This section is under development.
:::

Medipal is a medical questionnaire management platform built as a suite of microservices and client applications.

## What is Medipal?

Medipal enables healthcare organisations to design, distribute, and manage digital questionnaires across web and mobile devices.

## Architecture at a Glance

The platform consists of a Python/FastAPI backend, a Nuxt 3 frontend, a Capacitor-based mobile app, a shared JSON Schema layer, and supporting services for authentication, events, and storage.

## Key Concepts

- **Schema-driven development** — a single source of truth generates typed clients for every service.
- **Plugin architecture** — extend functionality without modifying core code.
- **Offline-first mobile** — SQLite-backed local storage with background sync.
