# Nuxt SQLite Layer

[`mp-nuxt-sqlite-layer`](https://github.com/medipal/mp-nuxt-sqlite-layer) is a shared Nuxt layer providing schema-agnostic SQLite + Kysely database infrastructure for Capacitor apps. It delivers connection management, a migration runner, and optional CRUD helpers. All schema definitions, migration files, and domain logic remain in the consuming application.

## Installation

### Peer Dependencies

The consuming app must install:

```sh
npm install kysely @capacitor-community/sqlite capacitor-sqlite-kysely
```

### Nuxt Config

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  extends: [
    ["github:medipal/mp-nuxt-sqlite-layer", { auth: process.env.GIGET_AUTH }],
  ],
});
```

Requires `GIGET_AUTH` env var (GitHub Classic PAT with `repo` scope).

## API Reference

### Composables (auto-imported)

| Composable                       | Description                                                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `useSqliteConnection()`          | Returns singleton `SQLiteConnection` instance                                                   |
| `initDatabase(config)`           | Initializes the Kysely database instance (call once at startup)                                 |
| `useDatabase<DB>()`              | Returns the typed `Kysely<DB>` instance                                                         |
| `useTableCrud<DB, T>(db, table)` | Generic CRUD operations for a table (`getAll`, `getById`, `insert`, `updateById`, `deleteById`) |

### Utilities (auto-imported)

| Utility                            | Description                                                  |
| ---------------------------------- | ------------------------------------------------------------ |
| `runMigrations(db, getMigrations)` | Runs all pending migrations using consumer-provided callback |

### Types

| Export                       | Description                                                    |
| ---------------------------- | -------------------------------------------------------------- |
| `SqliteLayerConfig`          | Configuration interface (`databaseName`, `getMigrations`)      |
| `defineSqliteConfig(config)` | Type-safe config helper (returns the same config, pure typing) |

## Configuration

The consumer creates a config file using `defineSqliteConfig()`:

```ts
// app/database/config.ts
import { defineSqliteConfig } from "@medipal/mp-nuxt-sqlite-layer/types";
import { getMigrations } from "./index";

export default defineSqliteConfig({
  databaseName: "nuxt",
  getMigrations,
});
```

| Field           | Type                                       | Description                                                       |
| --------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `databaseName`  | `string`                                   | SQLite database name (must match existing DB for data continuity) |
| `getMigrations` | `() => Promise<Record<string, Migration>>` | Async callback returning migration map                            |

## Consumer Setup

### 1. Define the database schema

```ts
// app/database/index.ts
import type { Migration } from "kysely";

export interface Database {
  users: {
    id?: bigint;
    name: string;
    email: string;
  };
}

export async function getMigrations(): Promise<Record<string, Migration>> {
  const modules = import.meta.glob<Migration>(
    "~/database/migrations/*.migration.ts",
  );
  const result: Record<string, Migration> = {};
  for (const [path, loader] of Object.entries(modules)) {
    const name = path.substring(
      path.lastIndexOf("/") + 1,
      path.indexOf(".migration.ts"),
    );
    result[name] = await loader();
  }
  return result;
}
```

### 2. Initialize at startup

```ts
// app/plugins/initializeApp.ts (simplified)
import sqliteConfig from "~/database/config";

initDatabase(sqliteConfig);
const db = useDatabase();
await runMigrations(db, sqliteConfig.getMigrations);
```

### 3. Use in composables

```ts
// app/composables/useSql.ts
import type { Database } from "~/database";

export const useSql = () => {
  const db = useDatabase<Database>();

  return {
    getTenants: () => db.selectFrom("tenants").selectAll().execute(),
    // ...
  };
};
```

## Architecture

### Why schema-agnostic?

The layer provides only infrastructure — it has no knowledge of what tables exist. This means:

- **Multiple apps** can consume the same layer with completely different schemas
- **Schema changes** don't require publishing a new layer version
- **Type safety** is preserved — the consumer passes their `Database` type to `useDatabase<Database>()`

### Why `getMigrations()` is a callback

`import.meta.glob()` is resolved at **compile-time** by Vite within the module that contains it. A glob written inside the layer would only discover the layer's own files, not the consumer's migrations. By accepting a callback, the consumer defines `getMigrations()` in their own scope where `import.meta.glob` resolves to the app's migration files.

### Why JeepSqlite stays in the app

The `<jeep-sqlite>` custom element (WASM fallback for browser development) must be injected into the app's DOM. This is platform-specific initialization that belongs in the consuming app's plugin (`app/plugins/sqlite.ts`), not in the shared layer.

### Responsibility split

```
mp-nuxt-sqlite-layer (infrastructure)
    ├─ useSqliteConnection()     → singleton SQLiteConnection
    ├─ initDatabase(config)      → creates Kysely instance
    ├─ useDatabase<DB>()         → typed Kysely accessor
    ├─ useTableCrud()            → generic CRUD helper
    └─ runMigrations()           → migration runner with callback

mp-mobile-app (domain)
    ├─ app/database/index.ts     → Database interface + getMigrations()
    ├─ app/database/config.ts    → defineSqliteConfig({ databaseName, getMigrations })
    ├─ app/database/migrations/  → *.migration.ts files
    ├─ app/composables/useSql.ts → domain-specific queries
    ├─ app/plugins/sqlite.ts     → JeepSqlite + connection open
    └─ app/plugins/initializeApp.ts → initDatabase() + runMigrations()
```
