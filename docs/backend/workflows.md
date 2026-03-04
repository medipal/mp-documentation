# Workflows & Plugins API — Front-End Integration Guide

This document covers every workflow, plugin, and event subscription endpoint,
request/response shapes, the execution engine internals, and the UI patterns
you will need to implement.

All endpoints require the `admin`, `provider`, or `integration` role (unless
noted otherwise) and accept either `Authorization: Bearer <token>` or
`X-API-KEY: <key>`.

---

## Table of Contents

### Event Subscriptions (Workflow Definitions)

1.  [Create a Subscription](#1-create-a-subscription)
2.  [List Subscriptions](#2-list-subscriptions)
3.  [Get a Single Subscription](#3-get-a-single-subscription)
4.  [Update a Subscription](#4-update-a-subscription)
5.  [Delete a Subscription](#5-delete-a-subscription)

### Workflow Graphs (Nodes & Edges)

6.  [Get Workflow Graph](#6-get-workflow-graph)
7.  [Replace Workflow Graph](#7-replace-workflow-graph)

### Simulation

8.  [Simulate a Workflow Run](#8-simulate-a-workflow-run)

### Workflow Runs (Execution History)

9.  [List Workflow Runs](#9-list-workflow-runs)
10. [Get a Single Workflow Run](#10-get-a-single-workflow-run)
11. [List Run Nodes](#11-list-run-nodes)

### Debugging & Introspection

12. [Reconstruct Node Context](#12-reconstruct-node-context)
13. [Evaluate JSONLogic Expression](#13-evaluate-jsonlogic-expression)

### Plugins

14. [List Plugin Definitions](#14-list-plugin-definitions)
15. [List Plugin Instances](#15-list-plugin-instances)
16. [Create a Plugin Instance](#16-create-a-plugin-instance)
17. [Get a Single Plugin Instance](#17-get-a-single-plugin-instance)
18. [Update a Plugin Instance](#18-update-a-plugin-instance)
19. [Delete a Plugin Instance](#19-delete-a-plugin-instance)

### Supporting Endpoints

20. [List Event Definitions](#20-list-event-definitions)
21. [List Event Delivery Tasks](#21-list-event-delivery-tasks)

### Architecture & Concepts

22. [Core Concepts](#22-core-concepts)
23. [Node Types Reference](#23-node-types-reference)
24. [Execution Engine](#24-execution-engine)
25. [JSONLogic Context](#25-jsonlogic-context)
26. [Event Processing Pipeline](#26-event-processing-pipeline)
27. [Important UI Considerations](#27-important-ui-considerations)

---

## 1. Create a Subscription

```
POST /api/v1/event_subscription
```

### Request Body

| Field                 | Type     | Required | Default | Notes                                                            |
| --------------------- | -------- | -------- | ------- | ---------------------------------------------------------------- |
| `name`                | `string` | yes      | —       | Human-friendly label                                             |
| `event_type`          | `string` | yes      | —       | CloudEvent type to trigger on, e.g. `medipal.submission.created` |
| `description`         | `string` | no       | `null`  | Optional human-readable description                              |
| `enabled`             | `bool`   | no       | `true`  | Whether the subscription is active                               |
| `source_filter`       | `string` | no       | `null`  | Exact match on CloudEvent `source` field                         |
| `subject_filter`      | `string` | no       | `null`  | Exact match on CloudEvent `subject` field                        |
| `condition_jsonlogic` | `object` | no       | `null`  | JSONLogic tree; event is routed only when it evaluates to truthy |

### Response (200)

```json
{
  "id": "a1b2c3d4-...",
  "name": "High Heart Rate Alert",
  "event_type": "medipal.vital.heart_rate.high",
  "description": "Triggers when heart rate exceeds threshold",
  "enabled": true,
  "source_filter": null,
  "subject_filter": null,
  "condition_jsonlogic": null,
  "created_at": "2026-02-28T10:00:00Z",
  "updated_at": null,
  "deleted_at": null
}
```

---

## 2. List Subscriptions

```
GET /api/v1/event_subscription
```

### Query Parameters

| Param        | Type      | Default | Notes                                  |
| ------------ | --------- | ------- | -------------------------------------- |
| `limit`      | `integer` | `25`    | Min `1`, max `250`                     |
| `offset`     | `integer` | `0`     | Min `0`                                |
| `event_type` | `string`  | —       | Filter by exact event type             |
| `enabled`    | `boolean` | —       | Filter by active flag                  |
| `name`       | `string`  | —       | Case-insensitive partial match on name |
| `search`     | `string`  | —       | Case-insensitive partial match on name |
| `sort_by`    | `string`  | —       | Column to sort by                      |
| `sort_dir`   | `string`  | —       | `asc` or `desc`                        |

### Response (200)

```json
{
  "event_subscriptions": [
    {
      "id": "a1b2c3d4-...",
      "name": "High Heart Rate Alert",
      "event_type": "medipal.vital.heart_rate.high",
      "description": null,
      "enabled": true,
      "source_filter": null,
      "subject_filter": null,
      "condition_jsonlogic": null,
      "created_at": "2026-02-28T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 25,
  "offset": 0,
  "has_next": false,
  "has_previous": false
}
```

---

## 3. Get a Single Subscription

```
GET /api/v1/event_subscription/{id}
```

### Response (200)

Same shape as a single item from [Create a Subscription](#1-create-a-subscription).

### Errors

| Status | When                   |
| ------ | ---------------------- |
| `404`  | Subscription not found |

---

## 4. Update a Subscription

```
PATCH /api/v1/event_subscription/{id}
```

Partial update — only send the fields you want to change.

### Request Body (all fields optional)

| Field                 | Type      | Notes                                  |
| --------------------- | --------- | -------------------------------------- |
| `name`                | `string`  |                                        |
| `description`         | `string`  |                                        |
| `enabled`             | `boolean` | Use to enable/disable without deleting |
| `event_type`          | `string`  |                                        |
| `source_filter`       | `string`  |                                        |
| `subject_filter`      | `string`  |                                        |
| `condition_jsonlogic` | `object`  |                                        |

> **To update the workflow graph (nodes/edges) use the
> [Replace Workflow Graph](#7-replace-workflow-graph) endpoint instead.**

### Response (200)

Same shape as [Get a Single Subscription](#3-get-a-single-subscription).

### Errors

| Status | When                   |
| ------ | ---------------------- |
| `400`  | Invalid payload        |
| `404`  | Subscription not found |

---

## 5. Delete a Subscription

```
DELETE /api/v1/event_subscription/{id}
```

### Response (200)

```json
{
  "status": "deleted"
}
```

> This is a **soft delete** (`deleted_at` is set). Already-running workflow
> runs will complete, but no new runs will be triggered.

### Errors

| Status | When                   |
| ------ | ---------------------- |
| `404`  | Subscription not found |

---

## 6. Get Workflow Graph

```
GET /api/v1/event_subscription/{id}/graph
```

Returns the subscription metadata together with its complete workflow graph
(all non-deleted nodes and edges).

### Response (200)

```json
{
  "subscription": {
    "id": "sub-001",
    "name": "High Heart Rate Alert",
    "event_type": "medipal.vital.heart_rate.high",
    "enabled": true,
    "created_at": "2026-02-28T10:00:00Z"
  },
  "nodes": [
    {
      "id": "node-aaa",
      "event_subscription_id": "sub-001",
      "key": "compute_band",
      "name": "Compute Risk Band",
      "type": "COMPUTE",
      "config": {
        "logic": {
          "if": [
            { ">": [{ "var": "event.data.heart_rate" }, 120] },
            "HIGH",
            "NORMAL"
          ]
        }
      },
      "retry_policy": null,
      "timeout_ms": null,
      "continue_on_error": false,
      "created_at": "2026-02-28T10:00:00Z"
    },
    {
      "id": "node-bbb",
      "event_subscription_id": "sub-001",
      "key": "send_alert",
      "name": "Send Alert Email",
      "type": "ACTION",
      "config": {
        "plugin_instance_id": "pi-smtp-001",
        "plugin_action": "send_email",
        "input_mapping": {
          "to": "alerts@example.com",
          "subject": "High heart rate detected",
          "body": { "var": "nodes.compute_band.output.result" }
        }
      },
      "continue_on_error": false,
      "created_at": "2026-02-28T10:00:00Z"
    }
  ],
  "edges": [
    {
      "id": "edge-001",
      "event_subscription_id": "sub-001",
      "from_node_id": "node-aaa",
      "to_node_id": "node-bbb",
      "label": "score is HIGH",
      "condition_jsonlogic": {
        "==": [{ "var": "nodes.compute_band.output.result" }, "HIGH"]
      }
    }
  ]
}
```

### Errors

| Status | When                   |
| ------ | ---------------------- |
| `404`  | Subscription not found |

---

## 7. Replace Workflow Graph

```
PUT /api/v1/event_subscription/{id}/graph
```

**Atomically replaces** the entire workflow graph in a single database
transaction. The old nodes and edges are soft-deleted and new ones are
created. Node configs are validated at save time.

### Request Body

| Field          | Type     | Required | Notes                                                 |
| -------------- | -------- | -------- | ----------------------------------------------------- |
| `subscription` | `object` | no       | Subscription metadata fields to update simultaneously |
| `nodes`        | `array`  | no       | Array of node objects (see below)                     |
| `edges`        | `array`  | no       | Array of edge objects (see below)                     |

#### Node Object

| Field               | Type      | Required | Default | Notes                                                                    |
| ------------------- | --------- | -------- | ------- | ------------------------------------------------------------------------ |
| `id`                | `string`  | no       | —       | Client-side ID; used to wire edges in the same request                   |
| `key`               | `string`  | yes      | —       | Stable key, unique within subscription (used in JSONLogic refs)          |
| `name`              | `string`  | no       | `key`   | Human-friendly label                                                     |
| `description`       | `string`  | no       | `null`  | Optional description                                                     |
| `type`              | `string`  | yes      | —       | One of: `ACTION`, `COMPUTE`, `SWITCH`, `JOIN`, `DELAY`, `END`            |
| `config`            | `object`  | varies   | `null`  | Type-specific configuration (see [Node Types](#21-node-types-reference)) |
| `retry_policy`      | `object`  | no       | `null`  | `{ max_attempts, backoff, base_seconds }`                                |
| `timeout_ms`        | `integer` | no       | `null`  | Hard timeout for node execution                                          |
| `continue_on_error` | `boolean` | no       | `false` | If `true`, workflow continues even if this node fails                    |

#### Edge Object

| Field                 | Type     | Required | Default | Notes                                          |
| --------------------- | -------- | -------- | ------- | ---------------------------------------------- |
| `from_node_id`        | `string` | yes      | —       | Must match a node `id` in the same request     |
| `to_node_id`          | `string` | yes      | —       | Must match a node `id` in the same request     |
| `label`               | `string` | no       | `null`  | UI label for this branch (e.g. `"score < 50"`) |
| `condition_jsonlogic` | `object` | no       | `null`  | JSONLogic tree; edge is taken only when truthy |

### Response (200)

Same shape as [Get Workflow Graph](#6-get-workflow-graph), reflecting the
newly-created nodes/edges with their server-generated IDs.

### Errors

| Status | When                                                                  |
| ------ | --------------------------------------------------------------------- |
| `400`  | Missing required node fields, unknown node ID in edge, invalid config |
| `404`  | Subscription not found                                                |

### Important Notes

- **Client-side IDs**: Provide temporary `id` values on each node so edges
  can reference them via `from_node_id` / `to_node_id`. The server remaps
  these to real DB-generated UUIDs and returns the mapping in the response.
- **Config validation**: Node configs are validated against type-specific
  Pydantic models at save time. `ACTION` and `COMPUTE` nodes **require** a
  non-null config; other types accept `null`.
- **Atomicity**: All old nodes/edges are soft-deleted and new ones created
  within a single transaction. If any validation fails, the entire operation
  is rolled back.

---

## 8. Simulate a Workflow Run

```
POST /api/v1/event_subscription/{id}/test
```

Dry-runs the workflow graph without persisting state or invoking plugins.
Use this for previewing and debugging workflows in the UI.

### Request Body

| Field   | Type     | Required | Notes                                  |
| ------- | -------- | -------- | -------------------------------------- |
| `event` | `object` | yes      | A full CloudEvent envelope (see below) |

#### CloudEvent Envelope

```json
{
  "id": "test-evt-001",
  "source": "medipal/vitals",
  "type": "medipal.vital.heart_rate.high",
  "subject": "patient/123",
  "time": "2026-02-28T10:00:00Z",
  "specversion": "1.0",
  "datacontenttype": "application/json",
  "data": {
    "heart_rate": 135,
    "patient_id": "patient-123"
  }
}
```

### Response (200)

```json
{
  "subscription_id": "sub-001",
  "event_id": "test-evt-001",
  "nodes": [
    {
      "node_id": "node-aaa",
      "key": "compute_band",
      "type": "COMPUTE",
      "status": "completed",
      "input": {
        "logic": {
          "if": [
            { ">": [{ "var": "event.data.heart_rate" }, 120] },
            "HIGH",
            "NORMAL"
          ]
        }
      },
      "output": { "result": "HIGH" },
      "error": null,
      "context": {
        "event": {
          "id": "test-evt-001",
          "type": "medipal.vital.heart_rate.high",
          "data": { "heart_rate": 135 }
        },
        "nodes": {}
      },
      "available_paths": [
        "event",
        "event.data",
        "event.data.heart_rate",
        "event.id",
        "event.type"
      ]
    },
    {
      "node_id": "node-bbb",
      "key": "send_alert",
      "type": "ACTION",
      "status": "completed",
      "input": {
        "to": "alerts@example.com",
        "subject": "High heart rate detected",
        "body": "HIGH"
      },
      "output": { "simulated": true, "input": { "...": "..." } },
      "error": null,
      "context": {
        "event": {
          "id": "test-evt-001",
          "type": "medipal.vital.heart_rate.high",
          "data": { "heart_rate": 135 }
        },
        "nodes": { "compute_band": { "output": { "result": "HIGH" } } }
      },
      "available_paths": [
        "event",
        "event.data",
        "event.data.heart_rate",
        "event.id",
        "event.type",
        "nodes.compute_band.output.result"
      ]
    }
  ],
  "edges_traversed": ["edge-001"]
}
```

### Context Snapshots

In simulation mode, every node in the response includes two extra fields:

| Field             | Type       | Description                                                                |
| ----------------- | ---------- | -------------------------------------------------------------------------- |
| `context`         | `object`   | The full data object available to this node at execution time              |
| `available_paths` | `string[]` | All dot-notation paths usable in `{"var": "..."}` expressions at this node |

These are only present in simulation responses. Use `available_paths` to power
autocomplete or path pickers in your JSONLogic expression editor.

### Simulation Behaviour

| Aspect            | Real Execution                       | Simulation                                      |
| ----------------- | ------------------------------------ | ----------------------------------------------- |
| DB writes         | Creates `WorkflowRun` + node records | Skipped entirely                                |
| Plugin calls      | Invokes real plugin                  | Returns `{ "simulated": true, "input": {...} }` |
| Delays            | Sleeps for `delay_ms`                | Skipped (instant)                               |
| Context snapshots | Not included                         | `context` + `available_paths` per node          |
| Response          | Same summary shape                   | Same shape + context fields                     |

### Errors

| Status | When                                     |
| ------ | ---------------------------------------- |
| `400`  | Missing `event` field or invalid payload |
| `404`  | Subscription not found                   |

---

## 9. List Workflow Runs

```
GET /api/v1/workflow_run
```

**Roles required:** `admin` or `integration` only.

### Query Parameters

| Param                   | Type      | Default | Notes                                               |
| ----------------------- | --------- | ------- | --------------------------------------------------- |
| `limit`                 | `integer` | `25`    | Min `1`                                             |
| `offset`                | `integer` | `0`     | Min `0`                                             |
| `event_subscription_id` | `string`  | —       | Filter by subscription                              |
| `status`                | `string`  | —       | Filter: `pending`, `running`, `completed`, `failed` |
| `event_type`            | `string`  | —       | Filter by event type                                |
| `started_at_gte`        | `string`  | —       | ISO-8601 lower bound                                |
| `started_at_lte`        | `string`  | —       | ISO-8601 upper bound                                |
| `completed_at_gte`      | `string`  | —       | ISO-8601 lower bound                                |
| `completed_at_lte`      | `string`  | —       | ISO-8601 upper bound                                |
| `sort_by`               | `string`  | —       | Column to sort by                                   |
| `sort_dir`              | `string`  | —       | `asc` or `desc`                                     |

### Response (200)

```json
{
  "runs": [
    {
      "id": "run-001",
      "event_subscription_id": "sub-001",
      "event_id": "evt-abc",
      "event_type": "medipal.vital.heart_rate.high",
      "trigger_event": { "...full CloudEvent JSON..." },
      "status": "completed",
      "started_at": "2026-02-28T10:00:00Z",
      "completed_at": "2026-02-28T10:00:02Z",
      "error": null,
      "created_at": "2026-02-28T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 25,
  "offset": 0,
  "has_next": false,
  "has_previous": false
}
```

### Workflow Run Status Values

| Status      | Meaning                                            |
| ----------- | -------------------------------------------------- |
| `pending`   | Created but not yet started                        |
| `running`   | Actively executing nodes                           |
| `completed` | All nodes finished successfully (or reached `END`) |
| `failed`    | A node failed and `continue_on_error` was `false`  |

---

## 10. Get a Single Workflow Run

```
GET /api/v1/workflow_run/{id}
```

**Roles required:** `admin` or `integration` only.

### Response (200)

Same shape as a single item from [List Workflow Runs](#9-list-workflow-runs).

### Errors

| Status | When                   |
| ------ | ---------------------- |
| `404`  | Workflow run not found |

---

## 11. List Run Nodes

```
GET /api/v1/workflow_run/{id}/node
```

**Roles required:** `admin` or `integration` only.

Returns all node execution records for a workflow run, ordered by
`created_at` ascending (traversal order).

### Response (200)

```json
{
  "nodes": [
    {
      "id": "rn-001",
      "workflow_run_id": "run-001",
      "node_id": "node-aaa",
      "node_key": "compute_band",
      "node_type": "COMPUTE",
      "status": "completed",
      "input": {
        "logic": {
          "if": [
            { ">": [{ "var": "event.data.heart_rate" }, 120] },
            "HIGH",
            "NORMAL"
          ]
        }
      },
      "output": { "result": "HIGH" },
      "error": null,
      "started_at": "2026-02-28T10:00:00Z",
      "completed_at": "2026-02-28T10:00:01Z",
      "attempts": 0,
      "created_at": "2026-02-28T10:00:00Z"
    },
    {
      "id": "rn-002",
      "workflow_run_id": "run-001",
      "node_id": "node-bbb",
      "node_key": "send_alert",
      "node_type": "ACTION",
      "status": "completed",
      "input": {
        "to": "alerts@example.com",
        "subject": "High heart rate detected",
        "body": "HIGH"
      },
      "output": { "email_id": "msg-xyz" },
      "error": null,
      "started_at": "2026-02-28T10:00:01Z",
      "completed_at": "2026-02-28T10:00:02Z",
      "attempts": 0,
      "created_at": "2026-02-28T10:00:00Z"
    }
  ]
}
```

### Run Node Status Values

| Status      | Meaning                                         |
| ----------- | ----------------------------------------------- |
| `pending`   | Created, waiting for predecessors               |
| `running`   | Currently executing                             |
| `completed` | Finished successfully                           |
| `failed`    | Node execution raised an error                  |
| `skipped`   | All incoming edge conditions evaluated to false |

### Node Input by Type

Every node records the data it received as `input`. The shape depends on the
node type:

| Node Type | `input` Shape                                                             |
| --------- | ------------------------------------------------------------------------- |
| `COMPUTE` | `{ "logic": <JSONLogic expression> }` — the expression that was evaluated |
| `ACTION`  | The resolved `input_mapping` dict sent to the plugin                      |
| `DELAY`   | `{ "delay_ms": <number> }` — the configured delay                         |
| `SWITCH`  | `null` — routing is handled by edge conditions                            |
| `JOIN`    | `null` — synchronisation only                                             |
| `END`     | `null` — terminal node                                                    |

Input is captured **before** execution, so even failed nodes will have their
`input` recorded for debugging purposes.

### Errors

| Status | When                   |
| ------ | ---------------------- |
| `404`  | Workflow run not found |

---

## 12. Reconstruct Node Context

```
POST /api/v1/workflow_run/{id}/context
```

Reconstructs the full data context that was available to a specific node
during a past workflow run. Use this to inspect what variables and paths
were accessible when debugging expression failures.

### Request Body

| Field      | Type     | Required | Notes                        |
| ---------- | -------- | -------- | ---------------------------- |
| `node_key` | `string` | yes      | The `key` of the target node |

### Response (200)

```json
{
  "context": {
    "event": {
      "id": "evt-001",
      "type": "medipal.submission.created",
      "data": {
        "submission_id": "sub-001",
        "questionnaire_id": "q-001",
        "answers": { "q1": "yes", "q2": 5 }
      }
    },
    "nodes": {
      "compute_score": {
        "output": { "result": 85 }
      }
    }
  },
  "available_paths": [
    "event",
    "event.data",
    "event.data.answers",
    "event.data.answers.q1",
    "event.data.answers.q2",
    "event.data.questionnaire_id",
    "event.data.submission_id",
    "event.id",
    "event.type",
    "nodes.compute_score.output.result"
  ]
}
```

The `context` contains two namespaces:

- **`event`** — the trigger event that started the run
- **`nodes`** — outputs from all nodes that completed **before** the target node

The `available_paths` list contains every dot-notation path usable in
`{"var": "..."}` expressions at this node's position. Use it to power
autocomplete in your expression editor.

### Errors

| Status | When                               |
| ------ | ---------------------------------- |
| `404`  | Workflow run or node key not found |

---

## 13. Evaluate JSONLogic Expression

```
POST /api/v1/workflow/evaluate
```

A sandbox for testing JSONLogic expressions without running a full workflow.
Supports two modes:

- **Direct mode** — provide the expression and a data dict
- **From-run mode** — provide the expression, a past `workflow_run_id`, and a
  `node_key`; the server reconstructs the context automatically

### Request Body

| Field             | Type     | Required | Notes                                                            |
| ----------------- | -------- | -------- | ---------------------------------------------------------------- |
| `expression`      | `object` | yes      | A JSONLogic expression                                           |
| `data`            | `object` | no       | Direct mode: the data dict to evaluate against                   |
| `workflow_run_id` | `string` | no       | From-run mode: ID of the past workflow run                       |
| `node_key`        | `string` | no       | From-run mode: target node key (required with `workflow_run_id`) |

You must provide **either** `data` (direct mode) **or** `workflow_run_id` +
`node_key` (from-run mode), but not both.

### Response (200) — Direct Mode

```json
{
  "result": { "value": "HIGH" },
  "data_used": {
    "score": 85,
    "threshold": 80
  },
  "available_paths": ["score", "threshold"]
}
```

### Response (200) — From-Run Mode

```json
{
  "result": { "value": true },
  "data_used": {
    "event": { "data": { "heart_rate": 135 } },
    "nodes": { "compute_band": { "output": { "result": "HIGH" } } }
  },
  "available_paths": [
    "event",
    "event.data",
    "event.data.heart_rate",
    "nodes.compute_band.output.result"
  ]
}
```

### Errors

| Status | When                                                                |
| ------ | ------------------------------------------------------------------- |
| `400`  | Both modes specified, neither mode specified, or missing `node_key` |
| `404`  | Workflow run or node key not found (from-run mode)                  |

---

## 14. List Plugin Definitions

```
GET /api/v1/plugin_definition
```

Plugin definitions are **auto-discovered** at startup from Python entry
points in the `mp_server.plugins` group. They are read-only via the API.

### Query Parameters

| Param      | Type      | Default | Notes                                  |
| ---------- | --------- | ------- | -------------------------------------- |
| `limit`    | `integer` | `25`    |                                        |
| `offset`   | `integer` | `0`     |                                        |
| `name`     | `string`  | —       | Case-insensitive partial match on name |
| `search`   | `string`  | —       | Case-insensitive partial match on name |
| `sort_by`  | `string`  | —       | Column to sort by                      |
| `sort_dir` | `string`  | —       | `asc` or `desc`                        |

### Response (200)

```json
{
  "plugin_definitions": [
    {
      "id": "pd-001",
      "name": "mp.smtp_email",
      "version": "v1.0.0",
      "runtime": "package",
      "entrypoint": "mp_plugins.smtp:SmtpPlugin",
      "instance_config_schema": {
        "type": "object",
        "properties": {
          "host": { "type": "string" },
          "port": { "type": "integer" },
          "username": { "type": "string" },
          "password": { "type": "string" }
        },
        "required": ["host", "port"]
      },
      "actions": [
        {
          "name": "send_email",
          "title": "Send Email",
          "description": "Send an email via SMTP",
          "input_schema": {
            "type": "object",
            "properties": {
              "to": { "type": "string" },
              "subject": { "type": "string" },
              "body": { "type": "string" }
            },
            "required": ["to", "subject", "body"]
          },
          "output_schema": {
            "type": "object",
            "properties": {
              "email_id": { "type": "string" }
            }
          },
          "idempotent": false,
          "timeout_seconds": 30
        }
      ],
      "dist_name": "mp-plugins-smtp",
      "dist_commit": "abc123...",
      "enabled": true,
      "created_at": "2026-02-28T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 25,
  "offset": 0,
  "has_next": false,
  "has_previous": false
}
```

### Key Fields

| Field                    | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `runtime`                | `"package"` (in-process Python) or `"service"` (external service) |
| `entrypoint`             | Python module:class path for in-process plugins                   |
| `instance_config_schema` | JSON Schema describing what config each instance requires         |
| `actions`                | Declared plugin actions with input/output schemas                 |
| `actions[].input_schema` | JSON Schema used to validate payloads before invoking the plugin  |
| `actions[].idempotent`   | Whether the action is safe to retry                               |

---

## 15. List Plugin Instances

```
GET /api/v1/plugin_instance
```

### Query Parameters

| Param                  | Type      | Default | Notes                                          |
| ---------------------- | --------- | ------- | ---------------------------------------------- |
| `limit`                | `integer` | `25`    |                                                |
| `offset`               | `integer` | `0`     |                                                |
| `plugin_definition_id` | `string`  | —       | Filter by parent definition                    |
| `display_name`         | `string`  | —       | Exact match on display name                    |
| `enabled`              | `boolean` | —       | Filter by active flag                          |
| `search`               | `string`  | —       | Case-insensitive partial match on display name |
| `sort_by`              | `string`  | —       | Column to sort by                              |
| `sort_dir`             | `string`  | —       | `asc` or `desc`                                |

### Response (200)

```json
{
  "plugin_instances": [
    {
      "id": "pi-001",
      "plugin_definition_id": "pd-001",
      "display_name": "Primary SMTP",
      "config_json": { "host": "smtp.example.com", "port": 587 },
      "config_hash": "e3b0c44298fc1c149afb...",
      "enabled": true,
      "created_at": "2026-02-28T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 25,
  "offset": 0,
  "has_next": false,
  "has_previous": false
}
```

---

## 16. Create a Plugin Instance

```
POST /api/v1/plugin_instance
```

### Request Body

| Field                  | Type      | Required | Default | Notes                                                                      |
| ---------------------- | --------- | -------- | ------- | -------------------------------------------------------------------------- |
| `plugin_definition_id` | `string`  | yes      | —       | ID of the plugin definition to instantiate                                 |
| `display_name`         | `string`  | yes      | —       | Human-friendly label (e.g. `"Primary SMTP"`)                               |
| `config_json`          | `object`  | no       | `null`  | Instance-specific config; must match definition's `instance_config_schema` |
| `enabled`              | `boolean` | yes      | —       | Whether the instance is active                                             |

### Response (200)

```json
{
  "id": "pi-001",
  "plugin_definition_id": "pd-001",
  "display_name": "Primary SMTP",
  "config_json": { "host": "smtp.example.com", "port": 587 },
  "config_hash": "e3b0c44298fc1c149afb...",
  "enabled": true,
  "created_at": "2026-02-28T10:00:00Z"
}
```

> **`config_hash`** is automatically computed as a SHA-256 of the
> JSON-serialised `config_json`. It is used for change detection and
> idempotency.

---

## 17. Get a Single Plugin Instance

```
GET /api/v1/plugin_instance/{id}
```

### Response (200)

Same shape as [Create a Plugin Instance](#14-create-a-plugin-instance).

### Errors

| Status | When                      |
| ------ | ------------------------- |
| `404`  | Plugin instance not found |

---

## 18. Update a Plugin Instance

```
PATCH /api/v1/plugin_instance/{id}
```

Partial update — only send the fields you want to change.

### Request Body (all fields optional)

| Field          | Type      | Notes                                     |
| -------------- | --------- | ----------------------------------------- |
| `display_name` | `string`  |                                           |
| `config_json`  | `object`  | `config_hash` is recomputed automatically |
| `enabled`      | `boolean` | Use to enable/disable without deleting    |

### Response (200)

Same shape as [Get a Single Plugin Instance](#15-get-a-single-plugin-instance).

### Errors

| Status | When                      |
| ------ | ------------------------- |
| `404`  | Plugin instance not found |

---

## 19. Delete a Plugin Instance

```
DELETE /api/v1/plugin_instance/{id}
```

### Response

`204 No Content` — empty body.

> This is a **soft delete** (`deleted_at` is set). Any workflow nodes
> referencing this instance will fail at execution time if the instance
> is deleted or disabled.

### Errors

| Status | When                      |
| ------ | ------------------------- |
| `404`  | Plugin instance not found |

---

## 20. List Event Definitions

```
GET /api/v1/event_definition
```

Returns the registry of known CloudEvent types that can be subscribed to.
Use this to populate the event type picker in the UI.

### Query Parameters

| Param        | Type      | Default | Notes                          |
| ------------ | --------- | ------- | ------------------------------ |
| `limit`      | `integer` | `25`    | Min `1`                        |
| `offset`     | `integer` | `0`     | Min `0`                        |
| `event_type` | `string`  | —       | Exact match filter             |
| `deprecated` | `boolean` | —       | Filter by deprecation status   |
| `search`     | `string`  | —       | Case-insensitive partial match |
| `sort_by`    | `string`  | —       | Column to sort by              |
| `sort_dir`   | `string`  | —       | `asc` or `desc`                |

### Response (200)

```json
{
  "event_definitions": [
    {
      "event_type": "medipal.submission.created",
      "schema_version": "v1",
      "description": "Fired when a questionnaire submission is created",
      "data_schema": { "..." },
      "subject_template": "submission/{id}",
      "examples": [],
      "deprecated": false
    }
  ],
  "total": 5,
  "limit": 25,
  "offset": 0,
  "has_next": false,
  "has_previous": false
}
```

---

## 21. List Event Delivery Tasks

```
GET /api/v1/event_delivery_task
```

**Roles required:** `admin` only.

Admin visibility into the event outbox queue. Use this to inspect failed
deliveries, monitor queue depth, and debug event processing issues.

### Query Parameters

| Param                 | Type      | Default | Notes                                              |
| --------------------- | --------- | ------- | -------------------------------------------------- |
| `limit`               | `integer` | `25`    | Min `1`                                            |
| `offset`              | `integer` | `0`     | Min `0`                                            |
| `status`              | `string`  | —       | Filter: `PENDING`, `IN_PROGRESS`, `DONE`, `FAILED` |
| `target`              | `string`  | —       | Filter by delivery target (e.g. `local-handlers`)  |
| `created_at_gte`      | `string`  | —       | ISO-8601 lower bound                               |
| `created_at_lte`      | `string`  | —       | ISO-8601 upper bound                               |
| `next_attempt_at_gte` | `string`  | —       | ISO-8601 lower bound                               |
| `next_attempt_at_lte` | `string`  | —       | ISO-8601 upper bound                               |
| `done_at_gte`         | `string`  | —       | ISO-8601 lower bound                               |
| `done_at_lte`         | `string`  | —       | ISO-8601 upper bound                               |
| `sort_by`             | `string`  | —       | Column to sort by                                  |
| `sort_dir`            | `string`  | —       | `asc` or `desc`                                    |

### Response (200)

```json
{
  "tasks": [
    {
      "id": "task-001",
      "cloudevent": { "...full CloudEvent JSON..." },
      "target": "local-handlers",
      "status": "DONE",
      "error": null,
      "attempts": 1,
      "max_attempts": 3,
      "next_attempt_at": null,
      "locked_until": null,
      "done_at": "2026-02-28T10:00:01Z",
      "created_at": "2026-02-28T10:00:00Z"
    }
  ],
  "total": 1,
  "limit": 25,
  "offset": 0,
  "has_next": false,
  "has_previous": false
}
```

### Delivery Task Status Values

| Status        | Meaning                                        |
| ------------- | ---------------------------------------------- |
| `PENDING`     | Queued, waiting for next worker cycle          |
| `IN_PROGRESS` | Claimed by a worker, currently being processed |
| `DONE`        | Successfully delivered                         |
| `FAILED`      | Exhausted all `max_attempts` (default 3)       |

---

## 22. Core Concepts

### Event Subscriptions

An **Event Subscription** is a workflow definition that reacts to CloudEvents.
It specifies:

- **Which events** to listen for (`event_type`, plus optional `source_filter`,
  `subject_filter`, and `condition_jsonlogic`).
- **What to do** when a matching event arrives — defined as a directed acyclic
  graph (DAG) of **nodes** connected by **edges**.

### Workflow Graph (DAG)

Each subscription owns a graph of **nodes** and **edges**:

```
[COMPUTE: score_band] ──condition──> [ACTION: send_alert] ──> [END]
                       \
                        ──condition──> [ACTION: log_normal] ──> [END]
```

- **Nodes** are computational units (evaluate logic, invoke plugins, branch,
  delay, join, or stop).
- **Edges** are directed connections between nodes, optionally guarded by
  JSONLogic conditions that determine which path the workflow follows.

### Plugins

Plugins are reusable integrations (email, SMS, HTTP, etc.) discovered at
startup via Python entry points:

- **Plugin Definition**: A read-only record describing a plugin's identity,
  capabilities (actions), and per-instance configuration schema.
- **Plugin Instance**: A configured deployment of a definition (e.g.
  "Primary SMTP" with specific host/credentials). Workflow `ACTION` nodes
  reference a plugin instance by ID.

### Workflow Runs

When a CloudEvent matches a subscription, the engine creates a
**Workflow Run** that tracks the entire execution, and a
**Workflow Run Node** per graph node tracking individual status, input,
output, and errors.

---

## 23. Node Types Reference

### ACTION

Invokes a plugin action with resolved input.

| Config Field         | Type     | Required | Description                              |
| -------------------- | -------- | -------- | ---------------------------------------- |
| `plugin_instance_id` | `string` | yes      | ID of the plugin instance to invoke      |
| `plugin_action`      | `string` | yes      | Action name (e.g. `send_email`)          |
| `input_mapping`      | `object` | no       | Template for building the plugin payload |

**`input_mapping`** values are either:

- **Scalar literals** (string, int, bool) — used as-is.
- **JSONLogic dicts** — evaluated against the current context to produce the
  value. Example: `{"var": "event.data.user_id"}` resolves to the actual
  user ID from the triggering event.

```json
{
  "plugin_instance_id": "pi-smtp-001",
  "plugin_action": "send_email",
  "input_mapping": {
    "to": { "var": "event.data.patient_email" },
    "subject": "Alert Notification",
    "body": { "var": "nodes.compute_message.output.result" }
  }
}
```

### COMPUTE

Evaluates a JSONLogic expression and stores the result.

| Config Field | Type     | Required | Description                      |
| ------------ | -------- | -------- | -------------------------------- |
| `logic`      | `object` | yes      | JSONLogic expression to evaluate |

The result is normalised to a dict. If the expression returns a scalar, it
is wrapped as `{"result": <value>}`.

```json
{
  "logic": {
    "if": [{ ">": [{ "var": "event.data.score" }, 80] }, "HIGH", "NORMAL"]
  }
}
```

### SWITCH

Conditional branching node. The node itself performs no computation — routing
is controlled entirely by JSONLogic conditions on its **outgoing edges**.

| Config Field | Type     | Required | Description                          |
| ------------ | -------- | -------- | ------------------------------------ |
| `mode`       | `string` | no       | `FIRST_TRUE` (default) or `ALL_TRUE` |

- `FIRST_TRUE`: Only the first outgoing edge whose condition passes is taken.
- `ALL_TRUE`: All outgoing edges whose conditions pass are taken (parallel
  branches).

> **Note:** In the current engine implementation, edge conditions are
> evaluated during graph traversal regardless of mode. The `mode` field is
> advisory for UI rendering.

### JOIN

Synchronises multiple incoming branches before continuing.

| Config Field | Type      | Required      | Description                              |
| ------------ | --------- | ------------- | ---------------------------------------- |
| `mode`       | `string`  | no            | `ALL`, `ANY`, or `N_OF_M`                |
| `n_required` | `integer` | when `N_OF_M` | Number of branches that must complete    |
| `timeout_ms` | `integer` | no            | Optional timeout before failing the join |

- `ALL`: Wait for all incoming branches (default when mode is omitted).
- `ANY`: Proceed when any branch completes.
- `N_OF_M`: Proceed once `n_required` branches have completed.

If `n_required` is specified and fewer predecessors have completed, the
node raises a `RuntimeError` and fails the workflow run.

### DELAY

Pauses workflow execution for a fixed duration or until a specific time.

| Config Field     | Type      | Required | Description                                 |
| ---------------- | --------- | -------- | ------------------------------------------- |
| `delay_ms`       | `integer` | one of   | Fixed delay in milliseconds (min 0)         |
| `until_template` | `string`  | one of   | Template rendering to an RFC-3339 timestamp |

One of `delay_ms` or `until_template` must be provided.

> **Simulation mode:** Delays are skipped entirely for instant previews.

### END

Terminates workflow execution. Has no configuration fields.

When the executor reaches an `END` node, traversal stops immediately and
the workflow run is marked `completed`. Any remaining unvisited nodes are
not executed.

```json
{
  "type": "END",
  "config": {}
}
```

---

## 24. Execution Engine

### Lifecycle

```
CloudEvent published
  → EventBus.publish()
    → Outbox enqueue (at-least-once guarantee)
      → OutboxWorker.drain()
        ├─ Local handlers (best-effort)
        ├─ SubscriptionRouter.route()
        │   ├─ Load enabled subscriptions matching event.type
        │   ├─ Apply filters (source, subject, condition_jsonlogic)
        │   ├─ Load graph (nodes + edges)
        │   └─ For each matching subscription:
        │       └─ WorkflowExecutor.execute()
        └─ WebhookDispatcher.dispatch()
```

### Execution Steps (WorkflowExecutor)

1. **Build adjacency structures** from edges (in-edges, out-edges, in-degree).
2. **Topological sort** using Kahn's algorithm. Raises `ValueError` if the
   graph contains a cycle.
3. **Create DB records** — one `WorkflowRun` (status: `running`) and one
   `WorkflowRunNode` per node (status: `pending`). Skipped in simulation mode.
4. **Traverse nodes** in topological order:
   - Evaluate incoming edge conditions via JSONLogic.
   - If ALL incoming edges fail → mark node `skipped`, continue.
   - Otherwise → mark node `running`, dispatch by type.
   - Store output in `WorkflowContext` for downstream nodes.
   - On success → mark `completed` with input/output data.
   - On failure → mark `failed` with error; if `continue_on_error` is
     `false`, fail the entire run.
   - On `END` node → stop traversal.
5. **Finalise run** — mark `WorkflowRun` as `completed` or `failed`.

### Edge Condition Evaluation

- An edge with **no** `condition_jsonlogic` always passes (unconditional).
- An edge with a condition passes only if the JSONLogic evaluates to truthy.
- A node is **skipped** only when ALL incoming edges have conditions AND all
  of them fail.
- Source nodes (no incoming edges) are always reachable.

### Error Handling

| Node Setting                         | Behaviour on Failure                      |
| ------------------------------------ | ----------------------------------------- |
| `continue_on_error: false` (default) | Node fails → entire run fails immediately |
| `continue_on_error: true`            | Node fails → logged, workflow continues   |

Subscription-level failures are isolated — one subscription failing does
not block others from executing for the same event.

---

## 25. JSONLogic Context

All JSONLogic expressions (edge conditions, compute logic, input mappings,
subscription conditions) are evaluated against a context object with two
namespaces:

```json
{
  "event": {
    "id": "evt-001",
    "source": "medipal/vitals",
    "type": "medipal.vital.heart_rate.high",
    "subject": "patient/123",
    "time": "2026-02-28T10:00:00Z",
    "data": {
      "heart_rate": 135,
      "patient_id": "patient-123"
    }
  },
  "nodes": {
    "compute_band": {
      "output": { "result": "HIGH" }
    },
    "send_alert": {
      "output": { "email_id": "msg-xyz" }
    }
  }
}
```

### Referencing Event Data

```json
{ "var": "event.data.heart_rate" }
{ "var": "event.type" }
{ "var": "event.subject" }
```

### Referencing Prior Node Outputs

```json
{ "var": "nodes.compute_band.output.result" }
{ "var": "nodes.send_alert.output.email_id" }
```

### Condition Examples

```json
// Edge condition: only take this path if heart rate > 120
{ ">": [{ "var": "event.data.heart_rate" }, 120] }

// Edge condition: only take this path if compute node returned "HIGH"
{ "==": [{ "var": "nodes.compute_band.output.result" }, "HIGH"] }

// Subscription condition: only trigger for specific source
{ "==": [{ "var": "event.source" }, "medipal/vitals"] }

// Compute node logic: categorise into bands
{
  "if": [
    { ">": [{ "var": "event.data.score" }, 80] }, "HIGH",
    { ">": [{ "var": "event.data.score" }, 50] }, "MEDIUM",
    "LOW"
  ]
}
```

### Questionnaire Submission Enrichment

When a `medipal.submission.created` or `medipal.submission.anonymous_created`
event is published, the `answers` payload is automatically enriched with
name-keyed lookups for scoring data. This makes it possible to reference
scoring variables and functions by human-readable name in JSONLogic
expressions, instead of by UUID.

The enrichment adds two fields inside `event.data.answers.scoring`:

| Field               | Source                                           | Description                                    |
| ------------------- | ------------------------------------------------ | ---------------------------------------------- |
| `variables_by_name` | Re-indexed from `scoring.variables` (UUID-keyed) | Dict keyed by variable `name` instead of UUID  |
| `functions_by_name` | Re-indexed from `scoring.functions` (list)       | Dict keyed by function `name` instead of index |

The original UUID-keyed `variables` and index-based `functions` are
preserved unchanged. Events without a `scoring` block in their answers
are not affected — the enrichment is a no-op for non-submission events.

#### Example: Accessing a Scoring Variable by Name

Given a submission where the scoring engine computed a `bmi` variable
(stored internally as `variables["uuid-abc-123"]`), the enriched event
data looks like:

```json
{
  "event": {
    "data": {
      "answers": {
        "scoring": {
          "variables": {
            "uuid-abc-123": {
              "id": "uuid-abc-123",
              "name": "bmi",
              "value": 22.5
            }
          },
          "variables_by_name": {
            "bmi": { "id": "uuid-abc-123", "name": "bmi", "value": 22.5 }
          }
        }
      }
    }
  }
}
```

To access the BMI value in a JSONLogic expression:

```json
{ "var": "event.data.answers.scoring.variables_by_name.bmi.value" }
```

To use it in a condition (e.g., route to a different path if BMI > 30):

```json
{
  ">": [{ "var": "event.data.answers.scoring.variables_by_name.bmi.value" }, 30]
}
```

To access a scoring function by name:

```json
{ "var": "event.data.answers.scoring.functions_by_name.calc_bmi.formula" }
```

> **Important:** The `var` operator uses dot notation only. Bracket notation
> like `variables["uuid-abc-123"]` is **not supported** by JSONLogic and will
> silently return `null`. Always use `variables_by_name.<name>` to access
> scoring variables in workflow expressions.

### Discovering Available Paths

If you are unsure which paths are available at a given node, use one of these
approaches:

1. **Simulation** — Call `POST /api/v1/event_subscription/{id}/test` with a
   sample event. Each node in the response includes `available_paths`.

2. **Context reconstruction** — For a past run, call
   `POST /api/v1/workflow_run/{id}/context` with `{ "node_key": "..." }` to
   see the exact context and paths that were available.

3. **Expression sandbox** — Use `POST /api/v1/workflow/evaluate` to test an
   expression against custom data or a past run's context.

---

## 26. Event Processing Pipeline

### End-to-End Flow

```
Application Code
  │
  ▼
EventBus.publish(CloudEvent)
  │
  ├─ 1. (Optional) Validate event type is registered
  ├─ 2. Enqueue to outbox (target: "local-handlers")
  └─ 3. (Optional) Fire local handlers immediately (best-effort)
         │
         ▼
OutboxWorker.drain() ◄── Scheduler / Background loop
  │
  ├─ Lock batch of pending messages (row-level locks)
  ├─ For each message:
  │   ├─ Parse CloudEvent
  │   ├─ Deliver to local-handlers
  │   ├─ Route to SubscriptionRouter ──────────┐
  │   ├─ Dispatch to WebhookDispatcher          │
  │   └─ Mark DONE (or FAILED for retry)        │
  │                                              │
  │         ┌────────────────────────────────────┘
  │         ▼
  │   SubscriptionRouter.route(event)
  │     ├─ Query subscriptions by event_type
  │     ├─ Filter: enabled, source_filter, subject_filter, condition_jsonlogic
  │     ├─ Load nodes + edges for each match
  │     └─ For each match:
  │         └─ WorkflowExecutor.execute()
  │             ├─ Topological sort
  │             ├─ Create WorkflowRun + RunNodes
  │             ├─ Traverse DAG
  │             │   ├─ ACTION → PluginService.invoke_instance()
  │             │   ├─ COMPUTE → jsonLogic()
  │             │   ├─ DELAY → sleep
  │             │   ├─ SWITCH → noop (edges handle routing)
  │             │   ├─ JOIN → verify predecessors
  │             │   └─ END → stop
  │             └─ Mark run completed/failed
  │
  └─ Return processed count
```

### Delivery Guarantees

| Component            | Guarantee                                        |
| -------------------- | ------------------------------------------------ |
| Outbox               | At-least-once (handlers must be idempotent)      |
| Subscription routing | Best-effort (failures isolated per subscription) |
| Webhook dispatch     | Best-effort (failures isolated per webhook)      |
| Plugin invocation    | At-most-once per node execution                  |

---

## 27. Important UI Considerations

### Pagination

All list endpoints share the same pagination contract:

```
?limit=25&offset=0
```

Use `has_next` / `has_previous` booleans to enable/disable pagination
controls. `total` gives the full count for "showing X of Y" labels.

### Workflow Run Status Badges

| Status      | Colour |
| ----------- | ------ |
| `pending`   | grey   |
| `running`   | blue   |
| `completed` | green  |
| `failed`    | red    |

### Run Node Status Badges

| Status      | Colour |
| ----------- | ------ |
| `pending`   | grey   |
| `running`   | blue   |
| `completed` | green  |
| `failed`    | red    |
| `skipped`   | yellow |

### Node Type Icons

Suggested icon mapping for the graph editor:

| Type      | Icon Suggestion                |
| --------- | ------------------------------ |
| `ACTION`  | Lightning bolt / plug          |
| `COMPUTE` | Calculator / code brackets     |
| `SWITCH`  | Git branch / fork              |
| `JOIN`    | Merge arrows / funnel          |
| `DELAY`   | Clock / hourglass              |
| `END`     | Stop sign / circle with border |

### Graph Editor

When building the visual graph editor:

1. **Node creation** — Present the 6 node types as a palette. When a user
   selects a type, show the appropriate config form based on the type.
2. **Edge creation** — Allow drawing connections between nodes. Offer an
   optional JSONLogic condition editor (or a simplified rule builder that
   generates JSONLogic).
3. **Save** — Collect all nodes and edges, assign temporary client IDs, and
   call `PUT /api/v1/event_subscription/{id}/graph`. The server returns the
   same graph with real IDs.
4. **Simulate** — After saving, offer a "Test" button that opens a panel
   where the user can paste a sample CloudEvent JSON and see which nodes
   would execute and what outputs they would produce.

### Plugin Instance Picker

For `ACTION` node configuration:

1. Fetch available plugin instances from `GET /api/v1/plugin_instance`.
2. Once a user selects a plugin instance, load its parent definition from
   `GET /api/v1/plugin_definition` to show available actions.
3. When the user selects an action, display the `input_schema` to help
   them build the `input_mapping`.

### Event Type Picker

For subscription creation:

1. Fetch registered event types from `GET /api/v1/event_definition`.
2. Present as a searchable dropdown.
3. Show `description` and `data_schema` (if available) to help users
   understand what data the event carries.

### Enable / Disable Toggle

Use `PATCH /api/v1/event_subscription/{id}` with `{ "enabled": true|false }`
to toggle a subscription without deleting it.

Use `PATCH /api/v1/plugin_instance/{id}` with `{ "enabled": true|false }`
to toggle a plugin instance.

### Timestamps

All timestamps are ISO-8601 UTC. Convert to the user's local timezone for
display.
