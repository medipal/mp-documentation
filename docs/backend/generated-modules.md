# Generated Modules

::: info
This section is under development.
:::

Several backend modules are auto-generated from `mp-schema` definitions. These should not be edited manually.

## What's Generated

- **SQLAlchemy models** — database table definitions
- **Pydantic schemas** — request/response validation models
- **Repository base classes** — CRUD operations for each entity
- **Route stubs** — basic endpoint definitions

## Generation Pipeline

Generated modules are updated whenever `mp-schema` changes, as part of the CI/CD pipeline. See [Code Generation Pipeline](/schema/code-generation) for details.

## Extending Generated Code

Custom business logic should be placed in non-generated service and repository files that import and extend the generated base classes.
