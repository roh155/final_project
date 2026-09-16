# Background Job Processing Service

A minimal, production-ready asynchronous job execution system built with Node.js, Express, and MySQL.

## Features
- **Asynchronous Execution:** Immediate `202 Accepted` response while long-running jobs process in the background.
- **Idempotency:** Enforced via compound unique constraint `(user_id, idempotency_key)` to guarantee safe retries.
- **Multi-Tenant Security:** Strict row-level ownership checking (`user_id`). Requests from unauthorized users return `404 Not Found`.
- **Authentication:** Bearer token authentication returning `401 Unauthorized` on missing or invalid credentials.

## What Happens When a Worker Dies Mid-Job?

1. **State Tracking:** When a worker claims a task, it sets `status = 'processing'` and logs the execution timestamp in `locked_at`.
2. **Stale Lock Recovery:** If the worker crashes mid-task, the job remains in `processing`. The polling loop identifies orphaned tasks using a timeout check (`locked_at < NOW() - INTERVAL 5 MINUTE`) and safely re-claims them.
3. **Poison-Pill & Crash Limits:** Every processing attempt increments `attempts`. If an unhandled crash or fatal error triggers repeatedly and exceeds `max_attempts` (3), the task permanently transitions to `status = 'failed'` rather than looping indefinitely.
4. **Idempotency Safeguard:** Rerunning jobs produces the exact same outcome without duplicate side effects.
