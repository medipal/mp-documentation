# Webhooks API — Front-End Integration Guide

This document covers every webhook endpoint, request/response shapes, and
the UI patterns you will need to implement.

All endpoints require the `admin` or `integration` role and accept either
`Authorization: Bearer <token>` or `X-API-KEY: <key>`.

---

## Table of Contents

1. [Create a Webhook](#1-create-a-webhook)
2. [List Webhooks](#2-list-webhooks)
3. [Get a Single Webhook](#3-get-a-single-webhook)
4. [Update a Webhook](#4-update-a-webhook)
5. [Delete a Webhook](#5-delete-a-webhook)
6. [Rotate Secret](#6-rotate-secret)
7. [List Deliveries](#7-list-deliveries)
8. [Get a Single Delivery](#8-get-a-single-delivery)
9. [Retry a Delivery](#9-retry-a-delivery)
10. [Important UI Considerations](#10-important-ui-considerations)

---

## 1. Create a Webhook

```
POST /api/v1/webhook
```

### Request Body

| Field         | Type       | Required | Default | Notes                                                                                               |
| ------------- | ---------- | -------- | ------- | --------------------------------------------------------------------------------------------------- |
| `name`        | `string`   | yes      | —       | User-friendly label                                                                                 |
| `url`         | `string`   | yes      | —       | HTTPS endpoint that will receive events                                                             |
| `event_types` | `string[]` | yes      | —       | CloudEvent types to subscribe to, e.g. `["medipal.submission.created"]`. Use `["*"]` for all events |
| `description` | `string`   | no       | `null`  | Optional human-readable description                                                                 |
| `enabled`     | `boolean`  | no       | `true`  | Whether the webhook is active immediately                                                           |

### Response (200)

```json
{
  "id": "whk-abc-123",
  "name": "My Webhook",
  "url": "https://example.com/hook",
  "secret": "a1b2c3d4e5f6...64 hex chars",
  "event_types": ["medipal.submission.created"],
  "description": null,
  "enabled": true,
  "created_at": "2026-02-27T10:00:00Z",
  "updated_at": null,
  "deleted_at": null
}
```

> **The `secret` field is the full HMAC-SHA256 signing key (64 hex characters).
> It is only returned here and on rotate. You must display it to the user
> immediately and warn them it cannot be retrieved again.**

---

## 2. List Webhooks

```
GET /api/v1/webhook
```

### Query Parameters

| Param     | Type      | Default | Notes                          |
| --------- | --------- | ------- | ------------------------------ |
| `limit`   | `integer` | `25`    | Min `1`                        |
| `offset`  | `integer` | `0`     | Min `0`                        |
| `enabled` | `boolean` | —       | Optional filter by active flag |

### Response (200)

```json
{
  "webhooks": [
    {
      "id": "whk-abc-123",
      "name": "My Webhook",
      "url": "https://example.com/hook",
      "secret_hint": "f6a8",
      "event_types": ["medipal.submission.created"],
      "description": null,
      "enabled": true,
      "created_at": "2026-02-27T10:00:00Z",
      "updated_at": null,
      "deleted_at": null
    }
  ],
  "total": 1,
  "limit": 25,
  "offset": 0,
  "has_next": false,
  "has_previous": false
}
```

> **`secret_hint`** is the last 4 characters of the signing secret. The full
> secret is never returned in list or detail views.

---

## 3. Get a Single Webhook

```
GET /api/v1/webhook/{id}
```

### Response (200)

```json
{
  "id": "whk-abc-123",
  "name": "My Webhook",
  "url": "https://example.com/hook",
  "secret_hint": "f6a8",
  "event_types": ["medipal.submission.created"],
  "description": null,
  "enabled": true,
  "created_at": "2026-02-27T10:00:00Z",
  "updated_at": null,
  "deleted_at": null
}
```

### Errors

| Status | When              |
| ------ | ----------------- |
| `404`  | Webhook not found |

---

## 4. Update a Webhook

```
PATCH /api/v1/webhook/{id}
```

Partial update — only send the fields you want to change.

### Request Body (all fields optional)

| Field         | Type       | Notes                                       |
| ------------- | ---------- | ------------------------------------------- |
| `name`        | `string`   |                                             |
| `url`         | `string`   |                                             |
| `event_types` | `string[]` |                                             |
| `description` | `string`   |                                             |
| `enabled`     | `boolean`  | Use this to enable/disable without deleting |

> **You cannot change the secret via PATCH.** Use the
> [Rotate Secret](#6-rotate-secret) endpoint instead.

### Response (200)

Same shape as [Get a Single Webhook](#3-get-a-single-webhook) (includes
`secret_hint`, not the full secret).

### Errors

| Status | When              |
| ------ | ----------------- |
| `400`  | Invalid payload   |
| `404`  | Webhook not found |

---

## 5. Delete a Webhook

```
DELETE /api/v1/webhook/{id}
```

### Response (200)

```json
{
  "message": "Webhook whk-abc-123 deleted."
}
```

> This is a **soft delete** (`deleted_at` is set). Already-queued deliveries
> will continue retrying until they succeed or exhaust their attempt budget.

### Errors

| Status | When              |
| ------ | ----------------- |
| `404`  | Webhook not found |

---

## 6. Rotate Secret

```
POST /api/v1/webhook/{id}/rotate_secret
```

No request body required.

### Response (200)

```json
{
  "id": "whk-abc-123",
  "name": "My Webhook",
  "url": "https://example.com/hook",
  "secret": "new-64-hex-char-secret...",
  "event_types": ["medipal.submission.created"],
  "description": null,
  "enabled": true,
  "created_at": "2026-02-27T10:00:00Z",
  "updated_at": "2026-02-27T11:00:00Z",
  "deleted_at": null
}
```

> **The old secret becomes invalid immediately.** The new `secret` is returned
> in full exactly once — display it and warn the user to copy it before closing
> the dialog.

### Errors

| Status | When              |
| ------ | ----------------- |
| `404`  | Webhook not found |

---

## 7. List Deliveries

```
GET /api/v1/webhook/{id}/delivery
```

### Query Parameters

| Param    | Type      | Default | Notes   |
| -------- | --------- | ------- | ------- |
| `limit`  | `integer` | `25`    | Min `1` |
| `offset` | `integer` | `0`     | Min `0` |

### Response (200)

```json
{
  "deliveries": [
    {
      "id": "dlv-xyz-789",
      "webhook_id": "whk-abc-123",
      "event_id": "evt-001",
      "event_type": "medipal.submission.created",
      "payload": { "...full CloudEvent JSON..." },
      "status": "SUCCESS",
      "http_status": 200,
      "response_body": "OK",
      "error": null,
      "attempts": 1,
      "max_attempts": 5,
      "next_attempt_at": "2026-02-27T10:00:00Z",
      "delivered_at": "2026-02-27T10:00:01Z",
      "created_at": "2026-02-27T10:00:00Z",
      "updated_at": "2026-02-27T10:00:01Z"
    }
  ],
  "total": 1,
  "limit": 25,
  "offset": 0,
  "has_next": false,
  "has_previous": false
}
```

Results are ordered newest-first.

### Delivery Status Values

| Status    | Meaning                                        |
| --------- | ---------------------------------------------- |
| `PENDING` | Queued, waiting for next delivery attempt      |
| `SUCCESS` | Delivered successfully (`delivered_at` is set) |
| `FAILED`  | Exhausted all `max_attempts` (default 5)       |

### Errors

| Status | When              |
| ------ | ----------------- |
| `404`  | Webhook not found |

---

## 8. Get a Single Delivery

```
GET /api/v1/webhook/{id}/delivery/{delivery_id}
```

### Response (200)

Same shape as a single item from the [List Deliveries](#7-list-deliveries)
array.

### Errors

| Status | When                                                                               |
| ------ | ---------------------------------------------------------------------------------- |
| `404`  | Webhook not found, delivery not found, or delivery does not belong to this webhook |

---

## 9. Retry a Delivery

```
POST /api/v1/webhook/{id}/delivery/{delivery_id}/retry
```

No request body required.

### What Happens

- `status` is reset to `PENDING`
- `attempts` is reset to `0` (full retry budget restored)
- `next_attempt_at` is set to now (picked up on next worker cycle)
- `error` is cleared

### Response (200)

Same shape as [Get a Single Delivery](#8-get-a-single-delivery), reflecting
the reset fields.

### Errors

| Status | When                                                                               |
| ------ | ---------------------------------------------------------------------------------- |
| `404`  | Webhook not found, delivery not found, or delivery does not belong to this webhook |

---

## 10. Important UI Considerations

### Secret Handling

- On **create** and **rotate**, the response contains the full 64-character
  `secret`. Display it in a copyable field with a warning like
  _"Copy this secret now — it will not be shown again."_
- On every other endpoint the API returns `secret_hint` (last 4 characters)
  instead. Display this as a masked value, e.g. `••••••••f6a8`.

### Pagination

All list endpoints (`GET /webhook`, `GET .../delivery`, `GET /event_delivery_task`)
share the same pagination contract:

```
?limit=25&offset=0
```

Use `has_next` / `has_previous` booleans to enable/disable pagination
controls. `total` gives the full count for "showing X of Y" labels.

### Delivery Status Badges

Suggested colour mapping:

| Status    | Colour |
| --------- | ------ |
| `PENDING` | yellow |
| `SUCCESS` | green  |
| `FAILED`  | red    |

### Retry Button

Show a "Retry" action on deliveries with `status === "FAILED"`. After a
successful retry call the status will flip to `PENDING` — poll or re-fetch to
track progress.

### Enable / Disable Toggle

Use `PATCH /api/v1/webhook/{id}` with `{ "enabled": true|false }` to
toggle a webhook without deleting it.

### Event Types

- Present a multi-select of known event types (fetched from
  `GET /api/v1/event_definition`).
- Include a wildcard `*` option labelled something like
  _"All events"_ for convenience.

### Timestamps

All timestamps are ISO-8601 UTC. Convert to the user's local timezone for
display.
