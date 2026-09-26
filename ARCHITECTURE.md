# GitForge — System Architecture & Technical Specifications

This document outlines the internal architectural design, state machines, worker concurrency algorithms, and database synchronization workflows of **GitForge (Multi-Account Cloudflare Pages Fleet Orchestrator)**.

---

## 1. High-Level System Layers

```
+-----------------------------------------------------------------------------------+
|                              1. CLIENT LAYER (SPA)                                |
|                                                                                   |
|  - React 19 + TypeScript + Tailwind CSS v4                                        |
|  - State Management: React Hooks, Polling Engine (1200ms building interval)       |
|  - Dual Portal Interface: User Workspace (/) & vCon Forensic Console (/vcon)      |
+-----------------------------------------+-----------------------------------------+
                                          | JSON over HTTPS (Bearer Token Auth)
                                          v
+-----------------------------------------------------------------------------------+
|                             2. BACKEND LAYER (EXPRESS)                            |
|                                                                                   |
|  - RESTful Endpoints: Projects, Accounts, Deployments, Admin Vitals, Webhooks    |
|  - Middleware: requireAuth, validateSession, rate limiting, error normalization   |
|  - Forensic Audit Interceptor: Automatic persistence to app_audit_logs            |
+-----------------------------------------+-----------------------------------------+
                                          |
                     +--------------------+--------------------+
                     |                                         |
                     v                                         v
+------------------------------------------+ +--------------------------------------+
|        3. CONCURRENCY ENGINE             | |          4. PERSISTENCE LAYER        |
|                                          | |                                      |
|  - Async Worker Throttler (Pool: 1-10)   | |  - Neon Serverless PostgreSQL Pool   |
|  - Wrangler CLI Child Process Spawn      | |  - 7 Relational Schemas (cf_*,app_*) |
|  - Watchdog Timeout Guardian (600s max)  | |  - PBKDF2/SHA-512 Auth Credentials   |
|  - Output Stream Log Buffers & DB Sync   | |  - SSL Require Mode with Connection  |
+--------------------+---------------------+ +--------------------------------------+
                     |
                     v
+-----------------------------------------------------------------------------------+
|                              5. EXTERNAL INTEGRATIONS                             |
|                                                                                   |
|  - GitHub REST API: Remote commit hashes, author info, branch trees               |
|  - Cloudflare REST API v4: Token verify, DNS CNAME bindings, Pages project setup  |
|  - Webhook Dispatcher: Discord / Slack / Custom HTTP Alert Dispatches             |
+-----------------------------------------------------------------------------------+
```

---

## 2. Deployment State Machine Lifecycle

Each deployment record in `cf_deployments` advances through a deterministic finite-state machine:

```
                  +-----------------------------------+
                  |           [idle]                  |
                  |     (Initial creation state)      |
                  +-----------------+-----------------+
                                    |
                       User triggers Bulk Build
                                    |
                                    v
                  +-----------------------------------+
                  |          [queued] (0%)            |
                  |   (Enqueued in Concurrency Pool)  |
                  +-----------------+-----------------+
                                    |
                         Worker slot available
                                    |
                                    v
                  +-----------------------------------+
                  |         [building] (25%)          |
                  |   Cloning repo & git sync SHA     |
                  +-----------------+-----------------+
                                    |
                         Git clone success
                                    |
                                    v
                  +-----------------------------------+
                  |         [building] (50%)          |
                  |    Compiling npm assets (build)   |
                  +-----------------+-----------------+
                                    |
                         Compilation success
                                    |
                                    v
                  +-----------------------------------+
                  |         [building] (75%)          |
                  |  Wrangler pages deploy -> CF API  |
                  +-----------------+-----------------+
                                    |
                    +---------------+---------------+
                    |                               |
              Deploy Succeeded                Deploy Errored / Timeout
                    |                               |
                    v                               v
    +-------------------------------+   +-------------------------------+
    |        [success] (100%)       |   |            [failed]           |
    |  - pages.dev URL verified     |   |  - Full stderr output logged  |
    |  - DNS CNAME target mapped    |   |  - Webhook alert dispatched   |
    |  - deployed_at timestamp set  |   |  - Error badge in table       |
    +-------------------------------+   +-------------------------------+
```

---

## 3. Concurrency Worker Queue Algorithm

To prevent resource exhaustion on host servers, deployments are processed using an asynchronous throttle queue:

```typescript
// Conceptual throttle implementation
async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<void> {
  let index = 0;
  const executing: Promise<void>[] = [];

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task()).then(() => {});
    executing.push(p);

    if (limit <= tasks.length) {
      const e: Promise<any> = p.then(() => executing.splice(executing.indexOf(e), 1));
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  await Promise.all(executing);
}
```

---

## 4. Database Resilience & Self-Healing

1. **Interrupted Build Normalization**:
   If the Node.js server restarts while builds are in `building` or `queued` state, `initDb()` automatically runs:
   ```sql
   UPDATE cf_deployments 
   SET build_status = 'failed', 
       current_step = 'Build interrupted by server restart',
       error_message = 'Build process was interrupted by server restart.'
   WHERE build_status IN ('building', 'queued');
   ```
2. **Cascading Project Purging**:
   Foreign key constraints (`ON DELETE CASCADE`) ensure that deleting a project instantly removes all linked `cf_accounts` and `cf_deployments` without leaving orphaned database rows.
