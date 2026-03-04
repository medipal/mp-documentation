# Database

## Stack

| Layer   | Technology                    | Notes                                                         |
| ------- | ----------------------------- | ------------------------------------------------------------- |
| Driver  | `@capacitor-community/sqlite` | Native SQLite on iOS/Android; `jeep-sqlite` (WASM) in browser |
| ORM     | Kysely 0.27.6                 | Type-safe SQL query builder                                   |
| Adapter | `capacitor-sqlite-kysely`     | Kysely dialect for Capacitor SQLite                           |

Connection name: `"nuxt"`. The `<jeep-sqlite>` element is injected into `document.body` by `app/plugins/sqlite.ts` before the database is opened.

## Using the Database

**Always use `useSql()`.** Never import `db` directly — it bypasses the composable abstraction and makes code harder to test.

```ts
// Correct
const sql = useSql();
const tenants = await sql.getTenants();

// Avoid
import { db } from "@/database";
const tenants = await db.selectFrom("tenants").selectAll().execute();
```

### Available Methods

```ts
const sql = useSql();

// Tenants
await sql.getTenants(); // → Tenant[]
await sql.saveTenant(tenant);
await sql.deleteTenant(tenantId);

// Enrollments
await sql.getEnrollments(); // → Enrollment[]
await sql.saveEnrollment(enrollment);

// Questionnaires
await sql.getQuestionnaires(); // → Questionnaire[]
await sql.saveQuestionnaire(q);

// Pending submissions
await sql.getPendingSubmits(); // → PendingSubmit[]
await sql.addPendingSubmit(submit);
await sql.deletePendingSubmit(id);
await sql.moveToSubmits(id); // Marks as successfully sent
```

## Schema

### `tenants`

One row per registered healthcare provider. Stores API credentials and auth tokens.

| Column             | Type    | Description                     |
| ------------------ | ------- | ------------------------------- |
| `tenant_id`        | TEXT PK | Unique tenant identifier        |
| `instance_id`      | TEXT    | Instance within tenant          |
| `name`             | TEXT    | Display name                    |
| `url`              | TEXT    | API base URL                    |
| `api_key`          | TEXT    | API key                         |
| `access_token`     | TEXT    | Current JWT access token        |
| `refresh_token`    | TEXT    | JWT refresh token               |
| `token_expires_at` | TEXT    | ISO datetime of token expiry    |
| `token_issued_at`  | TEXT    | ISO datetime of token issuance  |
| `user_data`        | TEXT    | JSON blob with user/device info |

### `enrollments`

Patient enrollment records. Each row links a patient to a questionnaire with scheduling data.

| Column                  | Type    | Description                        |
| ----------------------- | ------- | ---------------------------------- |
| `enrollment_id`         | TEXT PK | Unique enrollment ID               |
| `tenant_id`             | TEXT FK | → `tenants.tenant_id`              |
| `instance_id`           | TEXT    |                                    |
| `user_id`               | TEXT    | Patient identifier                 |
| `questionnaire_id`      | TEXT    | Linked questionnaire               |
| `questionnaire_name`    | TEXT    | Display name                       |
| `questionnaire_version` | TEXT    | Version string                     |
| `schedule_payload`      | TEXT    | JSON — complex schedule definition |
| `availability`          | TEXT    | JSON — computed access windows     |
| `status`                | TEXT    | `active`, `expired`, etc.          |

### `questionnaires`

Questionnaire definitions (JSON Schema + UI Schema).

| Column             | Type    | Description                       |
| ------------------ | ------- | --------------------------------- |
| `questionnaire_id` | TEXT PK |                                   |
| `tenant_id`        | TEXT FK |                                   |
| `instance_id`      | TEXT    |                                   |
| `name`             | TEXT    | Display name                      |
| `version`          | TEXT    | Version string                    |
| `body`             | TEXT    | JSON blob — full JsonForms schema |

### `pending_submits`

Queue of submissions waiting to be sent. These exist until a successful API response is received.

| Column             | Type    | Description               |
| ------------------ | ------- | ------------------------- |
| `submission_id`    | TEXT PK |                           |
| `tenant_id`        | TEXT FK |                           |
| `instance_id`      | TEXT    |                           |
| `patient_id`       | TEXT    |                           |
| `questionnaire_id` | TEXT    |                           |
| `device_id`        | TEXT    |                           |
| `payload`          | TEXT    | JSON form submission data |
| `request`          | TEXT    | Serialized HTTP request   |
| `response`         | TEXT    | Last HTTP response        |
| `status`           | TEXT    | `pending`, `failed`, etc. |
| `error`            | TEXT    | Last error message        |
| `created_at`       | TEXT    | ISO datetime              |

### `submits`

History of successfully sent submissions (audit log). A submission is moved here from `pending_submits` only after a confirmed API `200`.

| Column             | Type    | Description               |
| ------------------ | ------- | ------------------------- |
| `submission_id`    | TEXT PK |                           |
| `tenant_id`        | TEXT FK |                           |
| `questionnaire_id` | TEXT    |                           |
| `enrollment_id`    | TEXT    |                           |
| `schedule_id`      | TEXT    |                           |
| `schedule_name`    | TEXT    |                           |
| `payload`          | TEXT    | JSON form submission data |
| `created_at`       | TEXT    | ISO datetime              |

::: warning Do not confuse `pending_submits` and `submits`
`pending_submits` = not yet sent. `submits` = successfully sent history. A row moves from pending → submits only after a successful API response.
:::

## Migrations

Migration files live in `app/database/migrations/` and follow the naming convention:

```
YYYYMMDD[N]_description.migration.ts
```

Example: `app/database/migrations/202503231_create_pending_submits_table.migration.ts`

Each migration exports `up` (required) and `down` (optional):

```ts
import type { Kysely } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("example")
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("example").execute();
}
```

Migrations are auto-discovered via `import.meta.glob` and run by Kysely's `BrowserMigrator` on every app startup. The migrator is idempotent — it skips already-applied migrations.

::: tip Adding a migration

1. Create `app/database/migrations/YYYYMMDD[N]_your_change.migration.ts`
2. Export `up` (and optionally `down`)
3. No registration needed — auto-discovered at build time
   :::
