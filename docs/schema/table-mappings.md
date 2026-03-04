# Table Mappings

::: info
This section is under development.
:::

Table mappings bridge the gap between JSON Schema definitions and PostgreSQL database columns.

## How It Works

Each entity schema includes mapping metadata that defines how schema properties translate to database columns, including types, constraints, and indexes.

## Column Types

The mapping layer converts JSON Schema types to PostgreSQL column types (e.g., `string` to `VARCHAR`, `integer` to `INTEGER`).

## Generated Output

Table mappings are used to generate SQLAlchemy models and Alembic migration scripts for the backend.
