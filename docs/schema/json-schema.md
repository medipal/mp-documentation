# JSON Schema Conventions

::: info
This section is under development.
:::

All Medipal schemas follow a consistent set of JSON Schema conventions to ensure predictable code generation.

## File Organisation

Schema files are written in YAML and stored in the `mp-schema` repository under a structured directory layout.

## Naming Conventions

Properties use `snake_case`. Schema titles use `PascalCase`. File names use `kebab-case`.

## Validation Keywords

Standard JSON Schema validation keywords (`required`, `enum`, `pattern`, `minLength`, etc.) are used to enforce data integrity at the API boundary.

## Custom Extensions

Custom `x-` extension properties are used to drive code generation behaviour and table mapping configuration.
