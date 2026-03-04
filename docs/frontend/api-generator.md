# API Generator

::: info
This section is under development.
:::

Medipal uses `swagger-typescript-api` with custom templates to generate typed TypeScript API clients from OpenAPI specifications.

## Generation Process

The generator reads the OpenAPI spec from `mp-schema` and produces a fully typed API client with request/response types, endpoint methods, and error types.

## Custom Templates

Custom ETA templates control the output format, ensuring the generated client matches the project's coding conventions.

## Output Repositories

- `mp-frontend-api` — client for the web application
- `mp-mobile-app-api` — client for the mobile application

## Regeneration

Clients are regenerated automatically by CI when the OpenAPI spec changes. They should never be edited manually.
