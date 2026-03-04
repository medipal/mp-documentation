# Schema Overview

::: info
This section is under development.
:::

The [`mp-schema`](https://github.com/medipal/mp-schema) repository is the single source of truth for the entire Medipal platform. It contains JSON Schema definitions, OpenAPI specifications, and table mappings that drive code generation for all services.

## Purpose

By defining data models once in a schema-first approach, Medipal ensures type safety and consistency across the Python backend, TypeScript frontend, and mobile applications.

## What's in mp-schema?

- **Entity definitions** — JSON Schema files describing every domain entity
- **OpenAPI specifications** — API contracts for the backend
- **Table mappings** — database column definitions derived from schemas
- **Code generation configs** — templates and scripts for generating typed clients
