# Shared Layers

The mobile application shares several Nuxt layers and plugins with the frontend to maximise code reuse.

## Shared via mp-nuxt-api-layer

Both `mp-frontend` and `mp-mobile-app` extend `mp-nuxt-api-layer`, which provides:

- API client composables
- Authentication token handling
- Error handling utilities

See [Nuxt API Layer](/frontend/mp-nuxt-api-layer) for full documentation.

## Shared via mp-nuxt-sqlite-layer

`mp-mobile-app` extends `mp-nuxt-sqlite-layer`, which provides schema-agnostic SQLite + Kysely database infrastructure:

- **Connection management** — singleton `SQLiteConnection` and `Kysely` instance via `useSqliteConnection()`, `initDatabase()`, `useDatabase()`
- **Migration runner** — `runMigrations()` wraps Kysely's `Migrator` with a consumer-provided `getMigrations()` callback
- **CRUD helper** — optional `useTableCrud()` for generic per-table operations

### What the layer provides vs. what the app owns

| Layer (`mp-nuxt-sqlite-layer`)          | App (`mp-mobile-app`)                             |
| --------------------------------------- | ------------------------------------------------- |
| `SQLiteConnection` singleton            | `Database` interface (schema types)               |
| `Kysely` instance lifecycle             | Migration files (`*.migration.ts`)                |
| `runMigrations()` with callback pattern | `getMigrations()` using `import.meta.glob`        |
| `useTableCrud()` generic CRUD           | Domain-specific composables (`useSql()`)          |
| `defineSqliteConfig()` type helper      | `app/database/config.ts` with app-specific config |
|                                         | JeepSqlite initialization (browser support)       |
|                                         | Background sync logic                             |

### Why `getMigrations()` is a callback

`import.meta.glob()` is resolved at compile-time by Vite within the module that contains it. A glob inside the layer would only discover the layer's own files. The consumer defines `getMigrations()` in their own scope where the glob resolves to the app's migration files.

See [SQLite Layer](/mobile/mp-nuxt-sqlite-layer) for full documentation.

## Shared Patterns

While the mobile app has its own SQLite-based data layer, it follows the same component and composable patterns as the frontend for consistency.

## Differences from Frontend

- **Storage:** SQLite instead of server-side sessions
- **Authentication:** Device-based token storage instead of cookie-based
- **Navigation:** Capacitor navigation instead of browser routing
