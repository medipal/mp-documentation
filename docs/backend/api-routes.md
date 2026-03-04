# API Routes

::: info
This section is under development.
:::

The backend exposes a RESTful API built with FastAPI. Routes are organised by domain module.

## Route Organisation

Routes are defined in each module's `routes.py` file and mounted on the FastAPI application with appropriate prefixes.

## Request Validation

Request bodies and query parameters are validated using Pydantic models derived from the schema definitions.

## Response Format

All API responses follow a consistent JSON structure with typed response models.

## Error Handling

Errors are returned as structured JSON responses with appropriate HTTP status codes and error details.
