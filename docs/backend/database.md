# Database & Migrations

::: info
This section is under development.
:::

Medipal uses PostgreSQL as its primary database, with Alembic for schema migrations.

## Database Setup

PostgreSQL 16+ is required. The connection is configured via environment variables.

## SQLAlchemy Models

Database models are generated from `mp-schema` definitions and extended with custom fields and relationships as needed.

## Alembic Migrations

Schema changes are managed through Alembic migration scripts. Migrations are auto-generated from model changes and reviewed before application.

## Seeding

Initial data can be loaded using the [seeder](/backend/seeder) utility.
