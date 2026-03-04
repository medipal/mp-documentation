# Contributing to Schemas

::: info
This section is under development.
:::

Guidelines for adding new entities or modifying existing schemas in `mp-schema`.

## Adding a New Entity

1. Create a new YAML schema file following the naming conventions
2. Define all properties with appropriate types and validation
3. Add table mapping metadata
4. Update the OpenAPI specification
5. Run the generation pipeline locally to verify output

## Modifying an Existing Entity

When modifying schemas, ensure backward compatibility. Breaking changes require coordinated updates across the backend, frontend, and mobile app.

## Review Process

All schema changes require review from at least one team member familiar with the downstream consumers (backend, frontend, mobile).
