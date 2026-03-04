# Nuxt API Layer

::: info
This section is under development.
:::

The `mp-nuxt-api-layer` is a shared Nuxt layer that provides API integration utilities used by both the frontend and mobile applications.

## Purpose

This layer abstracts common API concerns — authentication headers, error handling, request/response interceptors — into a reusable Nuxt module.

## Usage

Both `mp-frontend` and `mp-mobile-app` extend this layer via `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  extends: ["mp-nuxt-api-layer"],
});
```

## Provided Features

- Typed API client composables
- Authentication token injection
- Request/response error handling
- API base URL configuration
