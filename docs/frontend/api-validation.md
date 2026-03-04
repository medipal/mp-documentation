# API Validation

::: info
This section is under development.
:::

Medipal uses AJV (Another JSON Validator) for client-side validation of data against JSON Schema definitions.

## Purpose

Client-side validation provides immediate feedback to users before data is sent to the server, improving the user experience and reducing unnecessary API calls.

## Schema Loading

JSON Schema definitions are loaded from the schema package and compiled into validators at build time.

## Validation in Forms

Form components use the compiled validators to check field values on blur and on submit, displaying inline error messages.

## Consistency with Backend

Because both client and server validate against the same JSON Schema definitions, validation rules are guaranteed to be consistent.
