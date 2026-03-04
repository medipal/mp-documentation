# Testing Strategy

::: info
This section is under development.
:::

Medipal employs a multi-layered testing strategy covering unit tests, integration tests, API tests, and end-to-end tests.

## Test Types

- **Unit tests** — isolated tests for individual functions and components
- **Integration tests** — tests for service interactions and database operations
- **API tests** — automated tests against the running backend API
- **E2E tests** — browser-based tests simulating real user workflows

## Test Repositories

- [`mp-e2e-tests`](https://github.com/medipal/mp-e2e-tests) — Playwright-based cross-application end-to-end tests
- [`mp-api-tests`](https://github.com/medipal/mp-api-tests) — Python/pytest-based API integration tests
- Individual repos contain their own unit and integration tests
