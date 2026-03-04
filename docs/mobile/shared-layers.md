# Shared Layers

::: info
This section is under development.
:::

The mobile application shares several Nuxt layers and plugins with the frontend to maximise code reuse.

## Shared via mp-nuxt-api-layer

Both `mp-frontend` and `mp-mobile-app` extend `mp-nuxt-api-layer`, which provides:

- API client composables
- Authentication token handling
- Error handling utilities

## Shared Patterns

While the mobile app has its own SQLite-based data layer, it follows the same component and composable patterns as the frontend for consistency.

## Differences from Frontend

- **Storage:** SQLite instead of server-side sessions
- **Authentication:** Device-based token storage instead of cookie-based
- **Navigation:** Capacitor navigation instead of browser routing
