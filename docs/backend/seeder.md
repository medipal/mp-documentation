# Seeder — Environment-Specific Seed Data

The seeder populates the database with initial data (roles, statuses, default
users, etc.) in foreign-key dependency order. It supports **environment-specific
overrides** so that each deployment gets the exact data it needs without
duplicating the shared baseline.

---

## How It Works

Seed data lives under `src/mp_server/seeder/data/` in two layers:

```
src/mp_server/seeder/data/
  default/          # base data — always loaded first
  development/      # overrides for ENV=development
  local/            # overrides for ENV=local
  staging/          # overrides for ENV=staging
  testing/          # overrides for ENV=testing
```

On every `seed_all()` call the seeder:

1. Reads the `ENV` environment variable (defaults to `development`).
2. Iterates every database table in foreign-key dependency order.
3. For each table, loads entries from `default/{table}.yaml` (if it exists).
4. If `{ENV}/{table}.yaml` exists, loads those entries and **merges by `id`**:
   - Entries with a matching `id` — the environment version **replaces** the default entirely.
   - Entries with a new `id` — **appended** to the list.
   - Default entries whose `id` is absent from the env file — **kept as-is**.
5. Processes and upserts the merged list (`session.merge`).

If a table has no file in `default/` but does have one in the environment
folder, it is still seeded — environment folders can introduce tables that
have no baseline data.

---

## Directory Layout

### `default/` — Bare Minimum

Contains only what every environment needs to function:

| File                                   | Records | Purpose                                                           |
| -------------------------------------- | ------- | ----------------------------------------------------------------- |
| `role.yaml`                            | 4       | admin, provider, responder, integration                           |
| `device_status.yaml`                   | 2       | ACTIVE, INACTIVE                                                  |
| `device_type.yaml`                     | 3       | MOBILE, DESKTOP, TABLET                                           |
| `device_registration_status.yaml`      | 2       | INITIALIZED, PROCESSED                                            |
| `enrollment_status.yaml`               | 7       | PENDING_CONSENT, ENROLLED, COMPLETED, ...                         |
| `enrollment_user_status.yaml`          | 7       | mirrors enrollment_status                                         |
| `enrollment_user_type.yaml`            | 9       | PATIENT, PROVIDER, CAREGIVER, ...                                 |
| `questionnaire_status.yaml`            | 3       | DRAFT, PUBLISHED, ARCHIVED                                        |
| `questionnaire_identity_policy.yaml`   | 3       | IDENTIFIED, PSEUDONYMOUS, ANONYMOUS                               |
| `questionnaire_submission_source.yaml` | 3       | MOBILE_APP, WEB_APP, OTHER                                        |
| `permission_access_level.yaml`         | 3       | OWNER, EDITOR, VIEWER                                             |
| `folder.yaml`                          | 1       | root folder                                                       |
| `user.yaml`                            | 1       | default-admin                                                     |
| `user_role.yaml`                       | 1       | default-admin &rarr; role-admin                                   |
| `folder_permission.yaml`               | 1       | default-admin OWNER on root                                       |
| `role_scope.yaml`                      | 122     | scope assignments for admin (44), provider (35), integration (43) |

### `development/`, `staging/`, `local/` — Team Users

Each adds two admin users for the development team on top of the defaults:

| File                     | What it adds                                              |
| ------------------------ | --------------------------------------------------------- |
| `user.yaml`              | `user-mateusz`, `user-rafal` (both with `hash:` password) |
| `user_role.yaml`         | Both users &rarr; role-admin                              |
| `folder_permission.yaml` | Both users EDITOR on root                                 |

### `testing/` — Functional Test Data

Adds a full set of users, a registered device, and related data for
integration and end-to-end tests:

| File                       | What it adds                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `user.yaml`                | Overrides default-admin (`force_password_change: false`), adds provider, responder (with phone number), integration |
| `user_role.yaml`           | Role bindings for provider (provider + admin), responder, integration                                               |
| `folder_permission.yaml`   | Provider EDITOR on root                                                                                             |
| `device.yaml`              | ACTIVE mobile device owned by responder, authorized by provider                                                     |
| `device_registration.yaml` | PROCESSED registration for the device                                                                               |

---

## Adding a New Environment Override

1. Create a folder matching the `ENV` value:
   ```bash
   mkdir src/mp_server/seeder/data/demo
   ```
2. Add YAML files **only** for the tables you want to override or extend.
   Each file is a list of records with at least an `id` field.
3. Records with an `id` that matches a default entry replace it;
   records with a new `id` are appended.

You do **not** need to copy the full defaults — only the differences.

---

## Adding a New Table to Seed Data

1. Create `src/mp_server/seeder/data/default/{table_name}.yaml` with baseline
   entries (can be an empty file if the table only has data in specific
   environments).
2. Optionally create `{env}/{table_name}.yaml` in any environment folder
   that needs extra or different records.
3. The table name must match the SQLAlchemy model's `__tablename__` and follow
   `snake_case` convention (the seeder converts it to `PascalCase` to resolve
   the ORM class).

---

## Password Hashing

Any string field whose value starts with `hash:` is bcrypt-hashed at seed
time. The actual password comes from the app config key
`seeder.default_password` (interpolated from `${SEED_DEFAULT_PASSWORD}`).

```yaml
- id: my-user
  password: "hash:" # uses seeder.default_password
  # password: "hash:secret"  # falls back to literal "secret" if config is empty
```

---

## Running the Seeder

```bash
# via CLI
mp-server db seed

# via API (testing router)
POST /testing/reset-db
```

The `ENV` variable must be set in the process environment before the seeder
runs. In Docker this is typically set in `docker-compose.yaml` or `.env`.
