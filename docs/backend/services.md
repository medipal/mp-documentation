# Service Layer

::: info
This section is under development.
:::

Services contain the business logic of the application, sitting between the API routes and the data access layer.

## Service Pattern

Each domain module has a service class that encapsulates business rules, validation, and orchestration of repository calls.

## Dependency Injection

Services are injected into route handlers using FastAPI's dependency injection system.

## Cross-Service Communication

Services can call other services when business operations span multiple domains.
