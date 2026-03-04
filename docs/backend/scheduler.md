# Scheduler — Background Jobs

The server runs periodic background jobs via
[APScheduler](https://apscheduler.readthedocs.io/) 3.x. The scheduler starts
automatically during FastAPI's lifespan hook and shares the uvicorn event loop.

---

## Architecture

```
uvicorn (asyncio event loop)
  │
  └── AsyncIOScheduler
        ├── "asyncio" executor  (AsyncIOExecutor)
        │     Coroutine jobs run directly on the event loop.
        │
        └── "default" executor  (ThreadPoolExecutor, 5 threads)
              Sync jobs run in a thread so they never block the loop.
```

### Why two executors?

APScheduler 3.x does **not** auto-detect coroutine functions. Every job is
dispatched to whatever executor it is assigned to. If a coroutine is sent to
the `ThreadPoolExecutor`, it is called as a regular function — the returned
coroutine object is never awaited and silently discarded.

To avoid this, async jobs must explicitly specify `executor="asyncio"` at
registration time. Sync jobs omit the parameter and fall through to the
`default` thread pool.

---

## Key Files

| File                                              | Purpose                                                                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `src/mp_server/scheduler/scheduler_entrypoint.py` | Creates the scheduler, defines thin wrapper functions, registers all jobs, and exposes `start_scheduler()`.         |
| `src/mp_server/scheduler/task_processor.py`       | Contains the actual job logic — async functions for I/O-bound work, sync functions for blocking DB/subprocess work. |
| `src/mp_server/api/api_entrypoint.py`             | Calls `start_scheduler()` inside the FastAPI lifespan context manager.                                              |

---

## Registered Jobs

| Job ID                           | Interval | Executor         | Description                                                                                                            |
| -------------------------------- | -------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `heartbeat_job`                  | 30 min   | default (thread) | Runs `mp-server tracker ping` via subprocess.                                                                          |
| `action_processor_job`           | 30 min   | default (thread) | Marks expired enrollments as COMPLETED.                                                                                |
| `event_outbox_drain_job`         | 30 sec   | asyncio          | Drains pending CloudEvents from the DB outbox and dispatches to handlers, subscription router, and webhook dispatcher. |
| `webhook_retry_job`              | 30 sec   | asyncio          | Retries PENDING webhook deliveries whose backoff delay has elapsed.                                                    |
| `soft_delete_expired_tokens_job` | 24 hours | default (thread) | Soft-deletes refresh tokens that have expired but were never explicitly removed.                                       |
| `plugin_registration_job`        | 1 hour   | default (thread) | Re-discovers installed plugins via Python entry points and upserts their definitions.                                  |

---

## Adding a New Job

### Sync job (blocking I/O, DB queries, subprocess)

1. Add the function to `task_processor.py` as a regular `def`:

```python
def my_new_task():
  """Does something that blocks."""
  try:
    logger.info("Running my new task...")
    result = some_service.do_work()
    logger.info(f"Done: {result}")
  except Exception as e:
    logger.error(f"Error in my new task: {e}")
```

2. Import it in `scheduler_entrypoint.py`, add a thin wrapper, and register:

```python
def run_my_new_task():
  """Job wrapper for my_new_task."""
  my_new_task()

# Inside start_scheduler():
_scheduler.add_job(
  run_my_new_task,
  trigger=IntervalTrigger(minutes=15),
  id="my_new_task_job",
  name="My New Task",
  replace_existing=True,
)
```

No `executor=` parameter needed — it defaults to the thread pool.

### Async job (non-blocking, uses `await`)

1. Add the function to `task_processor.py` as an `async def`:

```python
async def my_async_task():
  """Does something async."""
  try:
    logger.info("Running my async task...")
    result = await some_async_client.fetch()
    logger.info(f"Done: {result}")
  except Exception as e:
    logger.error(f"Error in my async task: {e}")
```

2. Import it in `scheduler_entrypoint.py`, add an `async` wrapper, and register
   with `executor="asyncio"`:

```python
async def run_my_async_task():
  """Job wrapper for my_async_task."""
  await my_async_task()

# Inside start_scheduler():
_scheduler.add_job(
  run_my_async_task,
  trigger=IntervalTrigger(seconds=30),
  id="my_async_task_job",
  name="My Async Task",
  replace_existing=True,
  executor="asyncio",  # required for coroutine jobs
)
```

**Forgetting `executor="asyncio"` on a coroutine job will cause it to silently
never run.** The test suite guards against this — see the `TestJobSignatures`
and `TestStartScheduler.test_async_jobs_use_asyncio_executor` tests.

---

## Job Defaults

| Setting         | Value   | Effect                                                                                                      |
| --------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `coalesce`      | `False` | If a job misfires (scheduler was busy), each missed run fires individually rather than collapsing into one. |
| `max_instances` | `1`     | At most one instance of each job runs at a time. A slow run prevents overlap rather than stacking up.       |
| `timezone`      | `UTC`   | All trigger times are evaluated in UTC.                                                                     |

---

## Job Store

Jobs use an in-memory store (`MemoryJobStore`). Since all jobs are
interval-triggered and re-registered on every startup, persistence is not
needed — if the process restarts, jobs simply re-register and fire on their
next interval.

---

## Error Handling

Every wrapper function catches `Exception` and logs it. Errors never propagate
to APScheduler, which would mark the job as failed and potentially stop
rescheduling it. This means:

- A single failed run does not affect future runs.
- Errors are visible in the application logs under the `scheduler.*` logger
  namespace.
- No alerting is built in — monitor the logs for `Error` level messages from
  `scheduler.task_processor` or `scheduler.entrypoint`.

---

## Testing

The scheduler layer has full test coverage across two files:

- `tests/test_task_processor.py` — tests each job function in isolation
  (delegation to services, exception handling).
- `tests/test_scheduler_entrypoint.py` — tests job registration (IDs,
  intervals, executor assignments), scheduler lifecycle (skip-if-running),
  wrapper delegation, and a signature guard that verifies async jobs are
  `async def` and sync jobs are regular `def`.
