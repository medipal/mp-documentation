# Code Generation Pipeline

Medipal's CI pipeline automatically generates typed clients and models from the schema definitions whenever `mp-schema` changes.

## Pipeline Steps

1. **Validate** — JSON Schema files are validated for correctness
2. **Generate OpenAPI specifications** — derive OpenAPI 3.x specs from schema definitions
3. **Generate TypeScript API clients** — `mp-typescript-api-generator` + `mp-typescript-api-generator-templates` produce three typed Axios clients:
   - `mp-frontend-api` — admin frontend client
   - `mp-mobile-app-api` — mobile app client
   - `mp-mobile-app-tracker-api` — tracker client (from `mp-tracker-api-spec`)
4. **Generate Python models** — `genma` + `yamser` produce four server-side modules:
   - `mp-server-pydantic-models` — Pydantic v2 request/response models
   - `mp-server-sql-alchemy-models` — SQLAlchemy 2.0 ORM models
   - `mp-server-api` — FastAPI route stubs
   - `mp-server-config-schema` — application configuration schema
5. **Publish** — generated packages are published to GitHub Packages (npm) and consumed as git submodules (Python)

## Tooling

| Tool                                    | Language   | Role                                                                                                  |
| --------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------- |
| `genma`                                 | Python     | Code generation engine — reads schema definitions, produces source files via Jinja2 templates         |
| `yamser`                                | Python     | YAML serialisation/deserialisation with schema validation and reference resolution                    |
| `mp-typescript-api-generator`           | TypeScript | CLI tool wrapping `swagger-typescript-api` with Medipal-specific configuration                        |
| `mp-typescript-api-generator-templates` | ETA        | Templates controlling the shape of generated `Api` classes, method signatures, and type exports       |
| `mp-typescript-api-validation`          | TypeScript | AJV-based runtime request validation, used by frontend and mobile to validate payloads before sending |

## Generated Artefacts

| Repository                     | Type                      | Consumer        |
| ------------------------------ | ------------------------- | --------------- |
| `mp-frontend-api`              | TypeScript API client     | `mp-frontend`   |
| `mp-mobile-app-api`            | TypeScript API client     | `mp-mobile-app` |
| `mp-mobile-app-tracker-api`    | TypeScript API client     | `mp-mobile-app` |
| `mp-server-pydantic-models`    | Python Pydantic models    | `mp-server`     |
| `mp-server-sql-alchemy-models` | Python SQLAlchemy ORM     | `mp-server`     |
| `mp-server-api`                | FastAPI route definitions | `mp-server`     |
| `mp-server-config-schema`      | Configuration schema      | `mp-server`     |

::: warning Never edit manually
These repositories are regenerated on every `mp-schema` push. Manual edits will be overwritten.
:::

## Triggering Generation

Generation runs automatically on push to the `mp-schema` main branch and can be triggered manually via GitHub Actions.

See [Platform Architecture](/overview/platform) for how these artefacts fit into the full dependency graph.
