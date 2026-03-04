# List Endpoints — Front-End Integration Guide

Every collection endpoint (`GET /api/v1/<resource>`) supports filtering,
sorting, pagination, and soft-delete controls via query parameters. This
document covers the full feature set and the error responses you'll get when
something is wrong.

---

## Table of Contents

1. [Pagination](#1-pagination)
2. [Sorting](#2-sorting)
3. [Filtering](#3-filtering)
4. [Filter Operators](#4-filter-operators)
5. [Operators by Column Type](#5-operators-by-column-type)
6. [Soft-Delete Controls](#6-soft-delete-controls)
7. [Response Shape](#7-response-shape)
8. [Validation Errors](#8-validation-errors)
9. [Full Examples](#9-full-examples)

---

## 1. Pagination

| Parameter | Type  | Default | Description             |
| --------- | ----- | ------- | ----------------------- |
| `limit`   | `int` | `25`    | Max items to return     |
| `offset`  | `int` | `0`     | Number of items to skip |

```
GET /api/v1/user?limit=10&offset=20
```

The response includes helpers so you don't need to calculate pagination state
yourself — see [Response Shape](#7-response-shape).

---

## 2. Sorting

| Parameter  | Type     | Default | Description                     |
| ---------- | -------- | ------- | ------------------------------- |
| `sort_by`  | `string` | —       | Field name to sort on           |
| `sort_dir` | `string` | `asc`   | Sort direction: `asc` or `desc` |

```
GET /api/v1/user?sort_by=created_at&sort_dir=desc
```

When no `sort_by` is provided the endpoint uses a stable default
(typically `created_at desc, id asc`) so pagination order is consistent.

Sortable fields vary by endpoint. If you use an unsupported field the
error response tells you exactly which fields are valid — see
[Validation Errors](#8-validation-errors).

---

## 3. Filtering

Filters are passed as query parameters. The simplest form is an **equality
check** — just use the field name directly:

```
GET /api/v1/user?enabled=true
GET /api/v1/role?key=admin
```

For other operators, append `__<operator>` to the field name:

```
GET /api/v1/user?email__ilike=%25@example.com%25
GET /api/v1/user?created_at__gte=2025-01-01T00:00:00Z
GET /api/v1/event_delivery_task?status__in=PENDING,FAILED
```

Multiple filters are ANDed together:

```
GET /api/v1/user?enabled=true&created_at__gte=2025-01-01T00:00:00Z
```

This returns users where `enabled = true` AND `created_at >= 2025-01-01`.

---

## 4. Filter Operators

| Suffix     | SQL Equivalent                | Value Type            | Example                                 |
| ---------- | ----------------------------- | --------------------- | --------------------------------------- |
| _(none)_   | `=`                           | single value          | `?status=ACTIVE`                        |
| `__ne`     | `!=`                          | single value          | `?status__ne=DELETED`                   |
| `__lt`     | `<`                           | single value          | `?count__lt=100`                        |
| `__lte`    | `<=`                          | single value          | `?count__lte=100`                       |
| `__gt`     | `>`                           | single value          | `?count__gt=0`                          |
| `__gte`    | `>=`                          | single value          | `?created_at__gte=2025-01-01T00:00:00Z` |
| `__in`     | `IN (...)`                    | comma-separated       | `?status__in=PENDING,FAILED`            |
| `__not_in` | `NOT IN (...)`                | comma-separated       | `?status__not_in=DELETED,ARCHIVED`      |
| `__ilike`  | `ILIKE` (with your wildcards) | string with `%` / `_` | `?name__ilike=%25test%25`               |

**URL encoding note:** `%` must be encoded as `%25` in query strings. Most
HTTP clients handle this automatically when you pass the value as a parameter
rather than building the URL string manually.

### Operators available only via JSON body filters

These operators are supported by the query engine but not mapped in the
legacy query-parameter interface. They are available when sending a
structured JSON filter body (used by some advanced endpoints):

| Operator      | SQL Equivalent                                   | Value Type        |
| ------------- | ------------------------------------------------ | ----------------- |
| `is_null`     | `IS NULL` / `IS NOT NULL`                        | `true` or `false` |
| `contains`    | `LIKE '%val%'` (case-sensitive)                  | string            |
| `icontains`   | `ILIKE '%val%'` (case-insensitive, auto-escaped) | string            |
| `starts_with` | `LIKE 'val%'`                                    | string            |
| `ends_with`   | `LIKE '%val'`                                    | string            |
| `between`     | `BETWEEN start AND end`                          | `[start, end]`    |

---

## 5. Operators by Column Type

Not every operator works on every field. The API assigns operators based on
the column's data type:

| Column Type         | Allowed Operators                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **String/Text**     | `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `not_in`, `is_null`, `contains`, `icontains`, `starts_with`, `ends_with`, `ilike`, `between` |
| **Integer/Numeric** | `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `not_in`, `is_null`, `between`                                                               |
| **DateTime**        | `eq`, `ne`, `lt`, `lte`, `gt`, `gte`, `in`, `not_in`, `is_null`, `between`                                                               |
| **Boolean**         | `eq`, `ne`, `is_null`                                                                                                                    |
| **JSON**            | `eq`, `ne`, `is_null`                                                                                                                    |

If you use an operator that doesn't match the field's type (e.g.
`enabled__ilike=%25true%25` on a boolean column), the API returns a
validation error listing the operators that field actually supports.

---

## 6. Soft-Delete Controls

Records are soft-deleted (they keep a `deleted_at` timestamp instead of being
removed). By default, list endpoints **exclude** deleted records.

| Parameter         | Type   | Default | Description                                       |
| ----------------- | ------ | ------- | ------------------------------------------------- |
| `include_deleted` | `bool` | `false` | Return both active and deleted records            |
| `only_deleted`    | `bool` | `false` | Return **only** deleted records (e.g. trash view) |

```
GET /api/v1/webhook?include_deleted=true
GET /api/v1/webhook?only_deleted=true
```

---

## 7. Response Shape

All list endpoints return the same pagination envelope:

```json
{
  "users": [ ... ],
  "total": 57,
  "limit": 25,
  "offset": 0,
  "has_next": true,
  "has_previous": false
}
```

| Field          | Type    | Description                                                                              |
| -------------- | ------- | ---------------------------------------------------------------------------------------- |
| `<resource>`   | `array` | The items for this page (key name varies by endpoint, e.g. `users`, `roles`, `webhooks`) |
| `total`        | `int`   | Total matching records across all pages                                                  |
| `limit`        | `int`   | The limit that was applied                                                               |
| `offset`       | `int`   | The offset that was applied                                                              |
| `has_next`     | `bool`  | `true` if there are more items after this page                                           |
| `has_previous` | `bool`  | `true` if `offset > 0`                                                                   |

### Iterating through pages

```typescript
let offset = 0;
const limit = 25;
let hasNext = true;

while (hasNext) {
  const res = await fetch(`/api/v1/user?limit=${limit}&offset=${offset}`);
  const body = await res.json();

  // process body.users ...

  hasNext = body.has_next;
  offset += limit;
}
```

---

## 8. Validation Errors

When a query parameter is invalid, the API returns **400** with a
`QUERY_VALIDATION_ERROR` that tells you what went wrong and what's accepted.

### Error shape

```json
{
  "error": {
    "code": "QUERY_VALIDATION_ERROR",
    "message": "Human-readable description of the problem",
    "details": {
      "field": "the_field_that_was_rejected",
      "allowed_values": ["list", "of", "valid", "values"]
    }
  }
}
```

| Key                            | Type       | Description                                          |
| ------------------------------ | ---------- | ---------------------------------------------------- |
| `error.code`                   | `string`   | Always `"QUERY_VALIDATION_ERROR"`                    |
| `error.message`                | `string`   | What went wrong (for logging / developer tools)      |
| `error.details`                | `object`   | Structured context, or `null` for edge cases         |
| `error.details.field`          | `string`   | The field name the caller provided that was rejected |
| `error.details.allowed_values` | `string[]` | Sorted list of values the endpoint actually accepts  |

### Invalid sort field

```
GET /api/v1/event_delivery_task?sort_by=_event_subject
```

```json
{
  "error": {
    "code": "QUERY_VALIDATION_ERROR",
    "message": "Unsupported sort field: _event_subject",
    "details": {
      "field": "_event_subject",
      "allowed_values": ["created_at", "done_at", "id", "status", "target"]
    }
  }
}
```

### Invalid filter field

```
GET /api/v1/webhook?nonexistent=foo
```

```json
{
  "error": {
    "code": "QUERY_VALIDATION_ERROR",
    "message": "Unsupported filter field: nonexistent",
    "details": {
      "field": "nonexistent",
      "allowed_values": ["created_at", "enabled", "id", "name", "url"]
    }
  }
}
```

### Invalid filter operator

```
GET /api/v1/webhook?enabled__ilike=%25true%25
```

```json
{
  "error": {
    "code": "QUERY_VALIDATION_ERROR",
    "message": "Unsupported op 'ilike' for field 'enabled'",
    "details": {
      "field": "enabled",
      "allowed_values": ["eq", "is_null", "ne"]
    }
  }
}
```

### Handling errors in TypeScript

```typescript
if (
  response.status === 400 &&
  body.error?.code === "QUERY_VALIDATION_ERROR" &&
  body.error.details
) {
  const { field, allowed_values } = body.error.details;
  console.warn(
    `Invalid query param "${field}". Valid options:`,
    allowed_values,
  );
}
```

If `details` is `null`, fall back to displaying `error.message` directly.

---

## 9. Full Examples

### List users, sorted by newest, page 2

```
GET /api/v1/user?sort_by=created_at&sort_dir=desc&limit=25&offset=25
```

### Search users by email

```
GET /api/v1/user?email__ilike=%25@example.com%25
```

### Active webhooks created this year

```
GET /api/v1/webhook?enabled=true&created_at__gte=2025-01-01T00:00:00Z
```

### Event delivery tasks with specific statuses

```
GET /api/v1/event_delivery_task?status__in=PENDING,FAILED&sort_by=created_at&sort_dir=desc
```

### Roles excluding system roles

```
GET /api/v1/role?is_system__ne=true
```

### Deleted webhooks (trash view)

```
GET /api/v1/webhook?only_deleted=true&sort_by=created_at&sort_dir=desc
```
