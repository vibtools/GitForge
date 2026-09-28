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

---

## 5. Cloudflare OAuth 2.0 Auth App Architecture

```
User Browser (Workspace)         GitForge Backend (/api/auth/cloudflare)         Cloudflare Dashboard
        |                                       |                                         |
        | 1. Click "1-Click OAuth"              |                                         |
        |-------------------------------------->|                                         |
        |                                       | 2. Generate signed state & auth URL     |
        | 3. Open Popup Window                  |<----------------------------------------|
        |-------------------------------------------------------------------------------->|
        |                                       |                                         | 4. User grants access
        | 5. Callback with auth code & state    |                                         |
        |-------------------------------------->|                                         |
        |                                       | 6. Verify HMAC signature & TTL          |
        |                                       | 7. POST /oauth2/token (basic auth)      |
        |                                       |---------------------------------------->|
        |                                       | 8. Returns Bearer access_token          |
        |                                       |<----------------------------------------|
        |                                       | 9. Fetch accounts via v4 REST API       |
        |                                       | 10. Upsert cf_accounts & cf_deployments |
        | 11. postMessage(CF_OAUTH_SUCCESS)     |                                         |
        |<--------------------------------------|                                         |
        | 12. Auto-close popup & refresh fleet  |                                         |
```

### Architectural Guarantees:
- **Zero Token Copy-Paste:** Users connect entire fleets of Cloudflare accounts directly through Cloudflare's official OAuth consent screen.
- **HMAC State Verification:** Prevents CSRF and tampering attacks by signing state with SHA-256 HMAC and enforcing a 15-minute validity window.
- **Self-Healing Deployment Provisioning:** On successful account connection, GitForge automatically syncs Pages project records and CNAME targets into `cf_deployments`.
- **Live Credential Verification:** The vCon administrative console directly validates Client ID and Secret credentials against Cloudflare's OAuth token endpoint.
- **Reactive Configuration Handshake:** The User Workplace dynamically listens to `/api/auth/cloudflare/config-status`. When admin credentials are saved in `/vcon`, both the Workplace Domain Page (Tab 4) and Cloudflare Page (Tab 5) activate live 1-Click Connect buttons with glowing status indicators.
- **Instant Zone Fleet Population:** When an account is connected via 1-Click OAuth popup, the workspace immediately triggers `fetchCloudflareZones()`, populating all newly authorized domains in the zone dropdown without manual reload.

---

## 6. Cloudflare Domain & Automated DNS Provisioning Architecture

```
User Workspace (Domain Tab)             GitForge Backend (/api/auth/cloudflare)            Cloudflare v4 REST API
           |                                             |                                          |
           | 1. Select Zone / Connect CF                 |                                          |
           |-------------------------------------------->|                                          |
           |                                             | 2. GET /client/v4/zones?status=active    |
           |                                             |----------------------------------------->|
           |                                             | 3. Returns zones list & account scopes   |
           | 4. Display Zone Selector Dropdown           |<-----------------------------------------|
           |<--------------------------------------------|                                          |
           |                                             |                                          |
           | 5. Click "Auto-Provision DNS"               |                                          |
           |-------------------------------------------->|                                          |
           |                                             | 6. Check existing Wildcard & Apex CNAME  |
           |                                             |----------------------------------------->|
           |                                             | 7. POST /zones/:id/dns_records (*.domain)|
           |                                             |    (Auto plan fallback: Proxied/DNS Only)|
           |                                             |----------------------------------------->|
           |                                             | 8. Loop fleet accounts:                  |
           |                                             |    - Sync Subdomain CNAME record         |
           |                                             |    - POST /pages/projects/:name/domains  |
           |                                             |----------------------------------------->|
           |                                             | 9. Upsert cf_deployments & cf_projects   |
           |                                             | 10. Audit log: CLOUDFLARE_DNS_PROVISIONED|
           | 11. Return Live Provisioning Summary HUD    |                                          |
           |<--------------------------------------------|                                          |
           |                                             |                                          |
           | 12. Click "Verify DNS" (Real-time Audit)    |                                          |
           |-------------------------------------------->| 13. Query live DNS records & SSL status  |
           | 14. Real-time Green Verified Status Pill    |<-----------------------------------------|
```

### Architectural Guarantees & Edge-Case Protection:
- **Plan-Aware Wildcard Handling:** Cloudflare Free and Pro plans reject proxying on wildcard records (`*.domain.com`). GitForge dynamically detects plan constraints and gracefully provisions wildcard routing via DNS Only mode while keeping individual fleet subdomains fully proxied (`proxied: true`).
- **Pages Custom Domain Auto-Binding:** In parallel with DNS creation, the backend registers the custom subdomain directly on the corresponding Cloudflare Pages project via `/accounts/:id/pages/projects/:project_name/domains`.
- **Zero Orphaned Deployments:** If an account was previously imported without a deployment record, the provisioner performs an idempotent upsert into `cf_deployments` with `dns_status = 'verified'`.
- **Live DNS & SSL Auditing:** Users can trigger instant live propagation audits (`/api/auth/cloudflare/dns/verify-status`) without leaving the domain workplace.

---

## 7. Containerization & Quick Deploy Architecture (Docker & Coolify)

```
Coolify / Docker Host             GitForge Container (node:20-alpine)          Neon / PostgreSQL DB
         |                                           |                                  |
         | 1. git clone / docker compose up         |                                  |
         |------------------------------------------>|                                  |
         |                                           | 2. npm run build (Vite SPA)      |
         |                                           | 3. tsx server.ts (Express + DB)  |
         |                                           | 4. Test Pooler Connection        |
         |                                           |--------------------------------->|
         |                                           | 5. Return Alive & Latency        |
         |                                           |<---------------------------------|
         | 6. Health Probe: GET /api/health          |                                  |
         |------------------------------------------>|                                  |
         | 7. HTTP 200 { status: "healthy" }         |                                  |
         |<------------------------------------------|                                  |
         | 8. Traefik Auto-SSL & Ingress Routing     |                                  |
```

### Architectural Guarantees & Production Guardrails:
- **Alpine Multi-Tooling:** Base image `node:20-alpine` includes `git`, `ca-certificates`, and `wget` to support on-the-fly repository cloning and deep scanning.
- **Deep Health Probing:** The `/api/health` endpoint verifies both Express event loop availability and live PostgreSQL query execution (`SELECT 1 as alive`), returning detailed latency and status.
- **Coolify Zero-Config Ingress:** Exposes port `3000` by default; Coolify auto-detects `Dockerfile` or `docker-compose.yml`, provisioning SSL certificates via Traefik.
- **Dual Deployment Options:**
  1. `docker-compose.yml`: Micro-footprint container connecting to remote serverless PostgreSQL (Neon, Supabase).
  2. `docker-compose.selfhosted.yml`: Completely self-contained stack containing both GitForge App and local PostgreSQL 16 Alpine container with auto-healing healthchecks.

