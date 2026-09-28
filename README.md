# GitForge — Multi-Account Cloudflare Pages Fleet Orchestrator

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB.svg?style=flat-square&logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38B2AC.svg?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![Express](https://img.shields.io/badge/Express-4.x-000000.svg?style=flat-square&logo=express)](https://expressjs.com/)
[![Neon PostgreSQL](https://img.shields.io/badge/Neon-PostgreSQL-00E599.svg?style=flat-square&logo=postgresql)](https://neon.tech/)
[![Cloudflare Wrangler](https://img.shields.io/badge/Wrangler-v4-F38020.svg?style=flat-square&logo=cloudflare)](https://developers.cloudflare.com/pages/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**GitForge** is an enterprise-grade, high-performance orchestration platform designed to deploy a single Git repository to **dozens or hundreds of independent Cloudflare accounts** simultaneously in parallel. Features automated subdomain provisioning, DNS CNAME mapping, live token verification, PBKDF2/SHA-512 authentication, and a forensic administrative command console (**vCon**).

---

## Table of Contents

- [1. Overview & Architecture](#1-overview--architecture)
- [2. Complete Feature Matrix (A to Z)](#2-complete-feature-matrix-a-to-z)
- [3. vCon Forensic Administrative Command Console (`/vcon`)](#3-vcon-forensic-administrative-command-console-vcon)
- [4. Security Architecture & Authentication Model](#4-security-architecture--authentication-model)
- [5. Database Schema & Data Models](#5-database-schema--data-models)
- [6. API Endpoints Specification](#6-api-endpoints-specification)
- [7. Bulk Import File Format Specs](#7-bulk-import-file-format-specs)
- [8. Cloudflare Token Permissions Guide](#8-cloudflare-token-permissions-guide)
- [9. Quickstart & Local Installation](#9-quickstart--local-installation)
- [10. Environment Variables Configuration](#10-environment-variables-configuration)
- [11. Production Deployment Guide](#11-production-deployment-guide)
- [12. Troubleshooting & Diagnostic Matrix](#12-troubleshooting--diagnostic-matrix)

---

## 1. Overview & Architecture

Deploying static websites and Jamstack applications to hundreds of Cloudflare accounts manually is time-consuming and error-prone. **GitForge** automates the entire lifecycle:

```
                                  +---------------------------------------+
                                  |         GitHub REST API / Git         |
                                  |     (Source Repo, Commit Sync)        |
                                  +-------------------+-------------------+
                                                      |
                                                      v
+---------------------------------------------------------------------------------------------------------+
|                                    Express + Node.js Backend Engine                                     |
|                                                                                                         |
|  +---------------------------+   +-------------------------------+   +-------------------------------+  |
|  |   Worker Queue Throttler  |   |   PBKDF2/SHA-512 Auth Vault   |   |   Forensic Audit Trail Logger |  |
|  |   (1 - 10 Parallel Pool)  |   |   & Active Session Manager    |   |   (IP, User, Action, JSON)    |  |
|  +-------------+-------------+   +---------------+---------------+   +---------------+---------------+  |
|                |                                 |                                   |                  |
+----------------|---------------------------------|-----------------------------------|------------------+
                 |                                 |                                   |
                 v                                 v                                   v
+--------------------------------+ +-------------------------------+ +------------------------------------+
|  Wrangler CLI Child Processes  | |   Neon Serverless PostgreSQL  | |   Cloudflare REST API v4           |
|  (Project Build & Assets Push) | |   (Real-time State & Schema)  | |   (Token Verification & Domains)   |
+---------------+----------------+ +-------------------------------+ +-----------------+------------------+
                |                                                                      |
                +----------------------------------+-----------------------------------+
                                                   |
                                                   v
                         +---------------------------------------------------+
                         | 10+ Independent Cloudflare Accounts & Subdomains  |
                         | (account-1.domain.com, account-2.domain.com, ...) |
                         +---------------------------------------------------+
```

---

## 2. Complete Feature Matrix (A to Z)

| Feature | Category | Description |
| :--- | :--- | :--- |
| **Account Quota Auditor** | Cloudflare | Verifies Cloudflare account ID validity and token scopes live before dispatching jobs. |
| **Active Session Revocation** | Security | Terminate and revoke active login tokens from the database immediately. |
| **Audit Trail (Forensic)** | Security | Immutable log of administrative actions with IP addresses, timestamps, and JSON payloads. |
| **Auto DNS Verification** | Networking | Automated verification of CNAME target propagation (`*.pages.dev`) for subdomains. |
| **Automated CNAME Generation** | Networking | Generates formatted DNS records (e.g. `sub-01 -> project.pages.dev`) for one-click DNS record creation. |
| **Batch Cloudflare Importer** | Management | Supports JSON array and TSV tab-delimited bulk import of Account IDs and API tokens. |
| **Branch & Commit Sync** | Git Integration | Fetches the latest Git SHA, commit author, and message directly from GitHub REST API. |
| **Build Concurrency Pool** | Engine | Dynamic pool slider (1 to 10 workers) preventing memory overload during massive batch runs. |
| **Build Timeout Guard** | Stability | Automated watchdog timer that terminates frozen child processes after a defined threshold. |
| **Cloudflare OAuth 2.0 Auth App** | Integration | 1-Click popup authorization code flow for zero-paste fleet account connection & auto-provisioning. |
| **Custom Domain Provisioning** | Networking | Auto-binds wildcard or index-based subdomains (`sub-{index}.domain.com`) to Cloudflare Pages. |
| **Emergency Global Kill Switch**| Reliability | Immediate emergency termination of all active build processes across every project. |
| **Encrypted Token Vault** | Security | Token masking and unmasking toggles with secure database storage. |
| **First-Time Master Setup** | Security | Bootstrap wizard for provisioning the initial root master administrator account. |
| **GitHub Monorepo Support** | Git Integration | Configurable output directories (`dist`, `build`, `out`) and custom build commands. |
| **Interactive Terminal Logs** | Diagnostics | Real-time terminal log viewer modal with one-click copy to clipboard. |
| **Maintenance Mode Switch** | Operations | Global switch to temporarily pause user deployments during infrastructure maintenance. |
| **Multi-Project Workspaces** | Management | Switch seamlessly between independent project catalogs with isolated account pools. |
| **Neon PostgreSQL Integration** | Database | Serverless PostgreSQL pooler integration with automated connection testing and migration. |
| **PBKDF2 Password Hashing** | Security | 100,000 iterations of SHA-512 key derivation with cryptographically random 16-byte salts. |
| **Progress Percent Gauges** | UX | Step-by-step progress tracking (0% -> 25% -> 50% -> 75% -> 100%) with live state badges. |
| **Real-time System Vitals** | Telemetry | Live Node.js memory gauges, CPU core telemetry, process uptime, and database latency. |
| **Single Deployment Retry** | Operations | One-click rebuild trigger for individual accounts without restarting the whole batch. |
| **System Backup JSON Export** | Disaster Recovery| Full database state backup export containing all projects, accounts, and deployments. |
| **Webhook Notifications** | Alerts | Outbound HTTP webhook dispatches (Discord/Slack/Custom) for build failures and status alerts. |
| **Zero-Noise Compact UI** | UI/UX | High-density console design adhering strictly to the `AGENTS.md` micro-typography standard. |

---

## 3. vCon Forensic Administrative Command Console (`/vcon`)

The `/vcon` portal is an isolated, cyber-secure administrative cockpit designed for platform operators:

```
+----------------------------------------------------------------------------------------------------+
|  vCon ADMIN [ADMIN CONSOLE]         DB: 2ms   RAM: 84M / 1024M   0 Active Builds    [Stop All] [Exit]  |
+----------------------------------------------------------------------------------------------------+
| [Dashboard]    |  SYSTEM STATUS: ALL SYSTEMS OPERATIONAL                     [Refresh] [Backup JSON]|
| [Projects]     |  +-------------+  +-------------+  +-------------+  +-------------+  +-------------+  |
| [CF Accounts]  |  | Projects: 8 |  | Accounts: 60|  | Live: 58    |  | Active: 0   |  | DB: 2ms     |  |
| [Deployments]  |  +-------------+  +-------------+  +-------------+  +-------------+  +-------------+  |
| [Users]        |                                                                                    |
| [Settings]     |  [CONTROLS]                  [SERVER TELEMETRY]             [RECENT AUDIT TRAIL]   |
| [Database]     |  * Maintenance Mode: OFF     * RAM Allocation: [|||||   ]   * SETTINGS_SAVED       |
| [Audit Log]    |  * [Emergency Abort All]     * 8 vCPUs / Linux x64          * MASTER_ADMIN_INIT    |
+----------------+------------------------------------------------------------------------------------+
```

### Module Capabilities

1. **Dashboard & Vitals**:
   - Real-time CPU, RAM, Node.js uptime, and Neon PostgreSQL latency gauges.
   - Emergency Global Abort trigger that resets all running Wrangler processes.
   - System Maintenance Mode toggle.

2. **Projects Control**:
   - Central overview of all projects across all users.
   - Remote GitHub commit sync and repository branch inspection.
   - Build configuration editing and project deletion with cascading cleanup.

3. **Cloudflare Accounts Vault**:
   - Central vault of all stored Cloudflare Account IDs and API tokens.
   - **Live Token Tester**: Dispatches `/client/v4/user/tokens/verify` to Cloudflare REST API to validate token health.
   - Token masking and unmasking for forensic audits.

4. **Deployments Queue**:
   - Multi-status filter (`All`, `Building`, `Live`, `Failed`).
   - Integrated dark terminal console with full raw build output logs.
   - Force-cancel stuck worker child processes.

5. **Users & Session Control**:
   - Manage administrators and operators.
   - Active session manager with immediate token revocation.
   - Cryptographic PBKDF2/SHA-512 password reset facility.

6. **System Policy Engine**:
   - Dynamic Worker Concurrency Limiter (1 to 10 workers).
   - Maximum Execution Timeout Limiter (seconds).
   - Discord/Slack Webhook notification dispatcher with test ping utility.

7. **Neon Database Diagnostics**:
   - Exact live row counts for `cf_projects`, `cf_accounts`, `cf_deployments`, `app_users`, `app_sessions`, `app_audit_logs`.
   - Routine cleanup trigger to purge expired sessions.
   - One-click full system JSON backup export.

8. **Forensic Audit Log**:
   - Filterable, searchable chronological audit log recording every admin action with IP address and JSON parameters.

---

## 4. Security Architecture & Authentication Model

```
User Password ---> PBKDF2 (100,000 Iterations, SHA-512) + 16-Byte Cryptographic Salt ---> 64-Byte Hex Hash
                                                                                                |
                                                                                                v
                                                                                   app_users (Neon DB)
```

1. **Password Hashing**:
   - Implemented via Node.js native `crypto.pbkdf2Sync` with SHA-512 and 100,000 iterations.
   - Individual 16-byte random cryptographic salts generated per user.
   - Timing-safe comparisons (`crypto.timingSafeEqual`) to prevent side-channel timing attacks.

2. **Session Lifecycle**:
   - 32-byte cryptographically random hex tokens stored in `app_sessions`.
   - 7-day sliding expiration policy with automated database cleanup.
   - Bearer authorization header validation on all protected endpoints (`/api/*`).

3. **Admin Privilege Isolation**:
   - Initial setup flow checks for the existence of an `admin` role user.
   - Dedicated lock screen on `/vcon` requiring verified administrator credentials.
   - Every administrative mutation dispatches an entry to `app_audit_logs`.

---

## 5. Database Schema & Data Models

The application provisions its schema automatically upon server startup on Neon PostgreSQL:

```sql
-- 1. Projects
CREATE TABLE IF NOT EXISTS cf_projects (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  github_repo VARCHAR(255) NOT NULL,
  github_branch VARCHAR(64) DEFAULT 'main',
  github_token TEXT,
  build_command VARCHAR(255) DEFAULT 'npm run build',
  output_dir VARCHAR(128) DEFAULT 'dist',
  root_domain VARCHAR(255) NOT NULL,
  subdomain_pattern VARCHAR(64) DEFAULT 'sub-{index}',
  latest_commit_sha VARCHAR(64),
  latest_commit_message TEXT,
  status VARCHAR(32) DEFAULT 'created',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Cloudflare Accounts
CREATE TABLE IF NOT EXISTS cf_accounts (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES cf_projects(id) ON DELETE CASCADE,
  alias VARCHAR(128) NOT NULL,
  account_id VARCHAR(128) NOT NULL,
  api_token TEXT NOT NULL,
  email VARCHAR(255),
  subdomain VARCHAR(128) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Deployments & Queue
CREATE TABLE IF NOT EXISTS cf_deployments (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES cf_projects(id) ON DELETE CASCADE,
  account_id VARCHAR(64) NOT NULL REFERENCES cf_accounts(id) ON DELETE CASCADE,
  cf_pages_project_name VARCHAR(128) NOT NULL,
  pages_dev_domain VARCHAR(255),
  custom_domain VARCHAR(255),
  cname_host VARCHAR(128),
  cname_target VARCHAR(255),
  dns_status VARCHAR(32) DEFAULT 'pending',
  build_status VARCHAR(32) DEFAULT 'idle',
  progress_percent INTEGER DEFAULT 0,
  current_step VARCHAR(255) DEFAULT 'Ready to build',
  logs TEXT DEFAULT '',
  commit_hash VARCHAR(64),
  commit_message TEXT,
  error_message TEXT,
  deployed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Users & Access
CREATE TABLE IF NOT EXISTS app_users (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  role VARCHAR(32) DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Sessions
CREATE TABLE IF NOT EXISTS app_sessions (
  token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. System Settings
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(64) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. Audit Trail
CREATE TABLE IF NOT EXISTS app_audit_logs (
  id VARCHAR(64) PRIMARY KEY,
  user_email VARCHAR(255) NOT NULL,
  action VARCHAR(128) NOT NULL,
  details JSONB,
  ip_address VARCHAR(64),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. API Endpoints Specification

### Authentication Endpoints

- `GET /api/auth/me` — Check current user session & system user count.
- `POST /api/auth/register` — Register a standard user or initial administrator.
- `POST /api/auth/login` — Authenticate user and issue 32-byte session token.
- `POST /api/auth/logout` — Terminate and delete session token.
- `GET /api/auth/cloudflare/config-status` — Public verification check if Cloudflare OAuth App is configured.
- `GET /api/auth/cloudflare/url` — Generates cryptographically signed Cloudflare OAuth 2.0 authorization URL.
- `GET /api/auth/cloudflare/callback` — OAuth 2.0 callback handler, exchanges code, retrieves accounts, and syncs fleet.
- `GET /api/auth/cloudflare/zones` — Query live Cloudflare Zones for connected accounts with plan metadata.
- `POST /api/auth/cloudflare/dns/auto-provision` — 1-Click automated DNS CNAME creation, wildcard & subdomains routing, and Cloudflare Pages custom domain binding.
- `GET /api/auth/cloudflare/dns/verify-status` — Live DNS propagation query and Cloudflare SSL edge verification.

### Projects & Deployments Endpoints

- `GET /api/projects` — Retrieve all user projects.
- `POST /api/projects` — Create a new deployment project.
- `GET /api/projects/:id` — Retrieve full project details, accounts, and deployments.
- `DELETE /api/projects/:id` — Delete a project and cascading records.
- `POST /api/projects/:id/bulk-accounts` — Bulk import Cloudflare accounts.
- `POST /api/projects/:id/build` — Trigger parallel bulk deployment across all accounts.
- `POST /api/projects/:id/stop` — Cancel running builds for a project.
- `GET /api/projects/:id/status` — Poll deployment progress percentages and statuses.

### vCon Administrative Control Endpoints (`/api/admin/*`)

- `GET /api/admin/auth/status` — Check master administrator initialization status.
- `POST /api/admin/auth/setup` — First-time setup: Provision master administrator.
- `POST /api/admin/auth/login` — High-security administrator login.
- `GET /api/admin/overview` — Real-time telemetry, RAM, CPU, latency, and KPI metrics.
- `POST /api/admin/emergency-abort` — Immediately kill all running child processes.
- `GET /api/admin/projects` — Retrieve all projects system-wide.
- `PUT /api/admin/projects/:id` — Update project build configuration.
- `POST /api/admin/projects/:id/sync-commit` — Force re-sync latest GitHub commit.
- `POST /api/admin/projects/:id/build` — Force trigger project rebuild.
- `POST /api/admin/projects/:id/cancel` — Force cancel project build.
- `GET /api/admin/accounts` — Retrieve all stored Cloudflare accounts.
- `POST /api/admin/accounts/verify-token` — Live verification test with Cloudflare API v4.
- `PUT /api/admin/accounts/:id` — Update account credentials and subdomain.
- `DELETE /api/admin/accounts/:id` — Remove an account from the vault.
- `GET /api/admin/deployments` — Search and filter deployments queue.
- `POST /api/admin/deployments/:id/retry` — Retry a single failed deployment.
- `POST /api/admin/deployments/:id/force-cancel` — Force cancel a stuck deployment step.
- `GET /api/admin/users` — List system administrators and operators.
- `POST /api/admin/users` — Create new administrative user.
- `PUT /api/admin/users/:id` — Update user details or reset password.
- `DELETE /api/admin/users/:id` — Delete user account.
- `GET /api/admin/sessions` — List all active login sessions.
- `DELETE /api/admin/sessions/:token` — Revoke a specific login session.
- `GET /api/admin/settings` — Retrieve system configuration settings.
- `POST /api/admin/settings` — Update concurrency limits, timeouts, and webhooks.
- `POST /api/admin/settings/test-webhook` — Dispatch a test ping to configured Webhook URL.
- `POST /api/admin/cloudflare/oauth/test` — Live verification of Cloudflare OAuth App Client ID & Secret credentials.
- `GET /api/admin/db-stats` — Exact row counts and connection pool metrics.
- `POST /api/admin/db-cleanup` — Execute database cleanup and normalize orphaned states.
- `GET /api/admin/export-system` — Download full system JSON backup file.
- `GET /api/admin/audit-logs` — Retrieve filterable forensic audit log.

---

## 7. Bulk Import File Format Specs

### JSON Format
```json
[
  {
    "alias": "Production US Account",
    "account_id": "0123456789abcdef0123456789abcdef",
    "api_token": "AbCdEfGhIjKlMnOpQrStUvWxYz0123456789",
    "subdomain": "us-west"
  },
  {
    "alias": "Production EU Account",
    "account_id": "fedcba9876543210fedcba9876543210",
    "api_token": "ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210",
    "subdomain": "eu-central"
  }
]
```

### TSV / Tab-Separated Format
```tsv
Alias	Account ID	API Token	Subdomain
Production US	0123456789abcdef0123456789abcdef	AbCdEfGhIjKlMnOpQrStUvWxYz0123456789	us-west
Production EU	fedcba9876543210fedcba9876543210	ZyXwVuTsRqPoNmLkJiHgFeDcBa9876543210	eu-central
```

---

## 8. Cloudflare Token Permissions Guide

To create API tokens with sufficient permissions for Cloudflare Pages:

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens).
2. Go to **My Profile > API Tokens > Create Token**.
3. Choose **Create Custom Token** with the following permissions:
   - `Account` > `Cloudflare Pages` > **Edit**
   - `Account` > `Account Settings` > **Read**
   - `Zone` > `DNS` > **Edit** (if managing DNS records automatically)
4. Under **Account Resources**, select `All accounts` (or include your specific target account).
5. Copy the generated API Token and use the **vCon Live Token Tester** to verify permissions before deploying.

---

## 9. Quickstart & Local Installation

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** / **bun** / **yarn**
- **Git**
- **Neon PostgreSQL Database** (or any standard PostgreSQL instance)

### Installation Steps

```bash
# 1. Clone the repository
git clone https://github.com/your-username/gitforge.git
cd gitforge

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env

# Edit .env with your Neon PostgreSQL connection string:
# DATABASE_URL="postgresql://username:password@ep-example.neon.tech/neondb?sslmode=require"

# 4. Start development server (includes Express backend and Vite frontend on port 3000)
npm run dev

# 5. Open in browser
# User Portal:   http://localhost:3000
# Admin Console: http://localhost:3000/vcon
```

---

## 10. Environment Variables Configuration

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | — | PostgreSQL connection string (supports Neon pooler with `?sslmode=require`, local PostgreSQL, Supabase, or Cloud SQL). |
| `PORT` | No | `3000` | Port for the Express server and Vite static file server. |
| `NODE_ENV` | No | `production` | Environment mode (`production` for live Docker/Coolify deployments). |
| `APP_URL` | **Recommended**| `http://localhost:3000` | Public base domain/URL of the deployment (e.g. `https://gitforge.yourdomain.com`). |
| `CLOUDFLARE_OAUTH_CLIENT_ID` | No | — | Cloudflare OAuth 2.0 Client ID for 1-Click account authorization. |
| `CLOUDFLARE_OAUTH_CLIENT_SECRET` | No | — | Cloudflare OAuth 2.0 Client Secret. |
| `CLOUDFLARE_OAUTH_SCOPES` | No | `account:read pages:edit dns:edit` | OAuth permission scopes for fleet provisioning. |
| `S3_ENDPOINT` | No | — | S3-compatible storage endpoint (Backblaze B2, AWS S3, Cloudflare R2, MinIO). |
| `S3_REGION` | No | — | S3 bucket region (e.g. `us-east-005` or `auto`). |
| `S3_BUCKET_NAME` | No | — | S3 bucket name for backups and storage. |
| `S3_ACCESS_KEY_ID` | No | — | S3 key ID with read/write permissions. |
| `S3_SECRET_ACCESS_KEY` | No | — | S3 application secret key. |

---

## 11. Production Deployment Guide

### Option 1: Coolify Step-by-Step Complete Deployment Guide (Self-Hosted PaaS)

Coolify is an open-source, self-hosted Heroku/Netlify/Vercel alternative. GitForge is 100% pre-configured for instant zero-downtime deployment on Coolify.

#### 📋 Prerequisites:
1. A running **Coolify Instance** (v4.x+).
2. A **PostgreSQL Database** (either created directly inside Coolify via *Databases > PostgreSQL*, or serverless like Neon, Supabase, Cloud SQL).
3. A **Custom Domain or Subdomain** (e.g. `gitforge.yourdomain.com`) with DNS `A` record pointed to your Coolify server IP.

---

#### 🚀 Method A: Deploy via GitHub / Git Repository (Recommended)

1. **Create New Resource in Coolify:**
   - Log into your Coolify dashboard.
   - Select your **Project** and **Environment** (e.g., `Production`).
   - Click **+ New Resource** > Select **Application**.

2. **Connect Git Repository:**
   - Choose **Public Repository** (or **Private Repository / GitHub App**).
   - Paste the Git repository URL of GitForge: `https://github.com/your-username/gitforge.git`
   - Set the branch to deploy: `main`.

3. **Configure Build Pack:**
   - Coolify will automatically detect the `Dockerfile` and `docker-compose.yml` in the root.
   - Select **Dockerfile** (or **Docker Compose**).
   - Set **Exposed Port**: `3000` (or `${PORT}`).

4. **Set Custom Domain & Automatic SSL:**
   - In the **Domains** field, input your domain with HTTPS:
     ```
     https://gitforge.yourdomain.com
     ```
   - Coolify's built-in Traefik reverse proxy will automatically generate and renew Let's Encrypt SSL certificates.

5. **Configure Environment Variables:**
   - Navigate to the **Environment Variables** tab in Coolify.
   - Add the following key-value pairs (toggle *Build Variable* off, *Runtime Variable* on):
     ```env
     PORT=3000
     NODE_ENV=production
     APP_URL=https://gitforge.yourdomain.com
     DATABASE_URL=postgresql://username:password@ep-example.neon.tech/neondb?sslmode=require
     ```
   - *(Optional Cloudflare OAuth & S3)*:
     ```env
     CLOUDFLARE_OAUTH_CLIENT_ID=your_cf_client_id
     CLOUDFLARE_OAUTH_CLIENT_SECRET=your_cf_client_secret
     CLOUDFLARE_OAUTH_SCOPES=account:read pages:edit dns:edit
     ```

6. **Healthcheck Configuration:**
   - Healthcheck is auto-configured via the root `Dockerfile` (`GET /api/health`).
   - Coolify will mark the application as **Healthy** as soon as the Express server connects to PostgreSQL.

7. **Deploy:**
   - Click the **Deploy** button at the top right.
   - Monitor the real-time deployment logs. Once the Vite SPA build completes, the server will start on port 3000.

---

#### 📦 Method B: Deploy via Coolify Docker Compose (All-in-One with Local PostgreSQL)

If you want Coolify to spin up both GitForge and a dedicated local PostgreSQL database together:

1. In Coolify, click **+ New Resource** > Select **Docker Compose**.
2. Copy and paste the entire contents of [`docker-compose.selfhosted.yml`](docker-compose.selfhosted.yml) into the compose editor.
3. In the environment variables section, specify:
   ```env
   APP_URL=https://gitforge.yourdomain.com
   POSTGRES_USER=gitforge
   POSTGRES_PASSWORD=your_strong_random_password
   POSTGRES_DB=gitforge_db
   ```
4. Set the domains to `https://gitforge.yourdomain.com` routing to `gitforge:3000`.
5. Click **Deploy**. Both PostgreSQL and GitForge containers will be built, interconnected, and started automatically.

---

#### ✅ Post-Deployment Verification:
1. **Access User Portal:** Visit `https://gitforge.yourdomain.com` — the GitForge project manager and fleet orchestrator will load.
2. **Setup Admin Console (`/vcon`):** Visit `https://gitforge.yourdomain.com/vcon` — if no admin user exists, you will be prompted with the **First-Time Master Admin Setup** wizard to create the root administrator credentials.
3. **Verify Health Endpoint:** Visit `https://gitforge.yourdomain.com/api/health` — it will return:
   ```json
   {
     "status": "healthy",
     "service": "gitforge",
     "uptime": 120,
     "database": {
       "status": "connected",
       "latency_ms": 2
     },
     "version": "1.0.0"
   }
   ```

---

### Option 2: Docker Compose (Local VPS / Standalone Host)

**Standard Deployment (with External Neon PostgreSQL):**
```bash
# 1. Clone repository
git clone https://github.com/your-username/gitforge.git
cd gitforge

# 2. Setup environment variables
cp .env.example .env
# Edit .env and insert your DATABASE_URL and APP_URL

# 3. Build & start container
docker compose up -d --build

# 4. Check status & logs
docker compose logs -f
```

**Full Standalone Deployment (with Built-in PostgreSQL 16 container):**
```bash
# Start both GitForge app and Postgres database container
docker compose -f docker-compose.selfhosted.yml up -d --build
```

---

### Option 3: Standard Cloud Platforms (Cloud Run, Railway, Render, VPS)

1. Set `DATABASE_URL`, `APP_URL`, `NODE_ENV=production`, and `PORT=3000` in your platform's environment settings.
2. Build command: `npm run build`
3. Start command: `npm start`
4. Expose Port: `3000`


---

## 12. Troubleshooting & Diagnostic Matrix

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| `DB: Offline` in top navigation | Invalid `DATABASE_URL` or network connectivity timeout | Check Neon connection string; ensure `?sslmode=require` is appended. |
| Cloudflare token test shows `ERR` | Invalid token permissions or Account ID mismatch | Verify token has `Cloudflare Pages: Edit` and `Account Settings: Read` permissions. |
| Build gets stuck at 25% | Git repository requires authentication | Provide a personal GitHub token in the project configuration drawer. |
| Wrangler error: `Authentication error (10001)` | Cloudflare API token expired or revoked | Re-generate token in Cloudflare Dashboard and update in Cloudflare Accounts Vault. |
| `Session expired or unauthorized` | Session token timed out or revoked | Re-authenticate at the Login modal or `/vcon` lock screen. |
| High RAM usage during builds | Too many parallel Wrangler child processes | Lower the **Concurrency Limit** slider to `2` or `3` in `/vcon` System Settings. |

---

## License

This project is licensed under the [MIT License](LICENSE).
