# Background Job Processing Service

A minimal, production-ready asynchronous job execution system built with Node.js, Express, and MySQL (TiDB Cloud Serverless with TLS/SSL), and deployed on Render.

🌐 **Live Demo:** [https://final-project-5nyu.onrender.com](https://final-project-5nyu.onrender.com)  
📂 **Repository:** [https://github.com/roh155/final_project](https://github.com/roh155/final_project)
 
---

## Project Overview

I built an asynchronous Background Job Processing Service using Node.js, Express, MySQL (TiDB Cloud Serverless with TLS/SSL), and deployed it to Render.

The architecture consists of:
1. **REST API Server:** Accepts job requests, validates authentication, enforces user scoping, and guarantees idempotency.
2. **Background Worker:** Polls pending tasks from the database, executes the job asynchronously, tracks attempt limits, and updates the status upon completion.
3. **Persistent Database:** Managed TiDB Cloud database storing jobs, idempotency keys, execution statuses, and timestamps.

---

## Features & Robustness

* **Asynchronous Execution:** Immediate `202 Accepted` response while long-running jobs process in the background.
* **Idempotency Safeguard:** Enforced via compound unique constraint `(user_id, idempotency_key)` to guarantee safe retries and avoid duplicate side effects.
* **Multi-Tenant Security:** Strict row-level ownership checking (`user_id`). Unauthorized access attempts are safely blocked.
* **Worker Crash Handling / Stale Lock Recovery:** 
  * *State Tracking:* Claims tasks by setting `status = 'processing'` and updating timestamps.
  * *Stale Lock Recovery:* Recovers orphaned tasks using a timeout check (`locked_at < NOW() - INTERVAL 5 MINUTE`) if a worker crashes mid-task.
  * *Poison-Pill Protection:* Increments attempt counters and moves persistently failing jobs to `status = 'failed'` to prevent infinite loops.

---

## Database Schema & Scalability

### Table Structure: `jobs`
* `id` (BIGINT, Primary Key, Auto-increment): Unique identifier for each job.
* `user_id` (VARCHAR, Index): Tenant isolation identifier.
* `idempotency_key` (VARCHAR, Unique Compound Index): Combined with `user_id` for duplicate prevention.
* `status` (ENUM): Tracks lifecycle state (`pending`, `processing`, `completed`, `failed`).
* `payload` (JSON): Stores task parameters.
* `attempts` / `max_attempts` (INT): Retry tracking counters.
* `locked_at` (TIMESTAMP): Concurrency control lock timestamp.

### 10x Scale Consideration & Mitigation
* **Bottleneck:** At 10x traffic, high-frequency table polling on `status` and `created_at` sorting can create row-lock contention in MySQL.
* **Mitigation Strategy:** Transitioning high-throughput event notification queues to an in-memory message broker (such as Redis Pub/Sub or Redis Streams) while retaining TiDB Cloud for persistent state and audit logs.

--- 

## Local Setup & Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/rohi55/final_project.git](https://github.com/rohi55/final_project.git)
   cd final_project
