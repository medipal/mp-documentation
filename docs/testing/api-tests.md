# API Tests

::: info
This section is under development.
:::

The `mp-api-tests` repository contains automated tests for the backend API.

## Technology

- **Python** — test language
- **pytest** — test framework
- **httpx** — async HTTP client

## Test Scope

API tests verify endpoint behaviour including request validation, response formats, authentication, authorisation, and error handling.

## Running Tests

Tests run against a live backend instance with a dedicated test database.

## CI Integration

API tests are executed as part of the backend deployment pipeline to ensure API contracts are maintained.
