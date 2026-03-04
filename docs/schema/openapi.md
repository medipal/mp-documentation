# OpenAPI Specifications

::: info
This section is under development.
:::

Medipal uses OpenAPI 3.x specifications to define the backend API contract. These specs are generated from the JSON Schema definitions.

## Specification Structure

The OpenAPI specs describe all available endpoints, request/response schemas, authentication requirements, and error responses.

## Generation Process

OpenAPI specs are derived from the entity schemas and route definitions, ensuring the API contract stays in sync with the data model.

## Consuming the Specs

The frontend and mobile API clients are generated directly from these OpenAPI specs using `swagger-typescript-api`.
