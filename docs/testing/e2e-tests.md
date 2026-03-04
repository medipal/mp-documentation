# E2E Tests

::: info
This section is under development.
:::

The `mp-e2e-tests` repository contains Playwright-based end-to-end tests that verify cross-application user workflows.

## Technology

- **Playwright** — cross-browser testing framework
- **TypeScript** — test language

## Test Scope

E2E tests cover critical user journeys across the frontend application, including authentication, questionnaire management, and data submission flows.

## Running Tests

Tests can be run locally against a development environment or in CI against staging.

## CI Integration

E2E tests run as part of the deployment pipeline to catch regressions before production releases.
