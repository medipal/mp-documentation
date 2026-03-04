# Backend Overview

The Medipal backend ecosystem spans multiple repositories — the core API server, auto-generated modules, a plugin system, an analytics tracker, and shared Python libraries.

## Repositories

### Core

| Repository                                                            | Description                                                                      |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [mp-server](https://github.com/medipal/mp-server)                     | Main FastAPI backend — RESTful API, RBAC, scheduler, event system, plugin loader |
| [mp-tracker](https://github.com/medipal/mp-tracker)                   | Standalone Python analytics service for mobile usage events                      |
| [mp-tracker-api-spec](https://github.com/medipal/mp-tracker-api-spec) | OpenAPI spec for tracker endpoints                                               |

### Generated Modules

These repositories are **auto-generated** from `mp-schema` via `genma` + `yamser` and consumed as git submodules by `mp-server`:

| Repository                                                                              | Description                                                         |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [mp-server-pydantic-models](https://github.com/medipal/mp-server-pydantic-models)       | Pydantic v2 request/response models for all API endpoints           |
| [mp-server-sql-alchemy-models](https://github.com/medipal/mp-server-sql-alchemy-models) | SQLAlchemy 2.0 ORM model classes mapping to PostgreSQL tables       |
| [mp-server-api](https://github.com/medipal/mp-server-api)                               | FastAPI route definitions generated from OpenAPI specs              |
| [mp-server-config-schema](https://github.com/medipal/mp-server-config-schema)           | Application configuration schema (YAML-based, validated at startup) |

::: warning Never edit manually
These repos are regenerated on every `mp-schema` push. Manual edits will be overwritten.
:::

### Plugin System

| Repository                                                                            | Description                                                                                       |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [mp-server-plugin-sdk](https://github.com/medipal/mp-server-plugin-sdk)               | Python SDK defining the plugin interface — hooks for events, scheduling, and custom API endpoints |
| [mp-server-plugin-smtp-email](https://github.com/medipal/mp-server-plugin-smtp-email) | Built-in SMTP email plugin — transactional emails (invitations, password resets, notifications)   |

### Internal Python Libraries

Shared packages used across `mp-server`, `mp-tracker`, and code generation tooling:

| Repository                                        | Description                                                                                   |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [pylog](https://github.com/medipal/pylog)         | Structured JSON logging with correlation IDs and request context                              |
| [storiel](https://github.com/medipal/storiel)     | Storage abstraction — unified API for local filesystem and S3                                 |
| [confirion](https://github.com/medipal/confirion) | Configuration management — loads, merges, and validates YAML/env config at startup            |
| [genma](https://github.com/medipal/genma)         | Code generation engine — reads schema definitions, produces source files via Jinja2 templates |
| [yamser](https://github.com/medipal/yamser)       | YAML serialisation/deserialisation with schema validation and reference resolution            |
| [fyler](https://github.com/medipal/fyler)         | File utilities — temp file management, path resolution, archive handling                      |
| [structo](https://github.com/medipal/structo)     | Data structure helpers — deep merge, diff, flatten, schema-aware transforms                   |

## Key Technologies

- **FastAPI** — async web framework
- **SQLAlchemy** — ORM and query builder
- **Alembic** — database migrations
- **PostgreSQL** — primary database
- **Redis** — caching
- **APScheduler** — task scheduling (heartbeat, tracker ping, enrollment reminders)
- **CloudEvents** — event-driven messaging with outbox pattern

## Core Concepts

The backend follows a layered architecture with routes, services, and repositories. Auto-generated modules from [`mp-schema`](https://github.com/medipal/mp-schema) provide typed models and database definitions. Plugins extend server functionality via `mp-server-plugin-sdk` without modifying core code.

See [Platform Architecture](/overview/platform) for how backend services fit into the full dependency graph.
