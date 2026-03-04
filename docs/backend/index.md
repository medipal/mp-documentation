# Backend Overview

::: info
This section is under development.
:::

The [`mp-server`](https://github.com/medipal/mp-server) repository contains the Medipal backend — a Python FastAPI application that serves as the central API for the platform.

## Key Technologies

- **FastAPI** — async web framework
- **SQLAlchemy** — ORM and query builder
- **Alembic** — database migrations
- **PostgreSQL** — primary database
- **APScheduler** — task scheduling
- **CloudEvents** — event-driven messaging with outbox pattern

## Core Concepts

The backend follows a layered architecture with routes, services, and repositories. Auto-generated modules from [`mp-schema`](https://github.com/medipal/mp-schema) provide typed models and database definitions.
