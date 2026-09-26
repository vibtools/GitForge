# vCon - Central Administrative Command & Control System

vCon (`/vcon`) is the dedicated, isolated administrative command center for Cloudflare Bulk Pages Builder.

## Capabilities & Control Systems
1. **System Vitals & Dashboard (`/vcon` Overview)**:
   - Live CPU, RAM, and Node.js process runtime telemetry.
   - Neon Serverless PostgreSQL connection pool status and ping latency.
   - Real-time build concurrency monitor and active worker counters.
   - Emergency Global Kill Switch to instantly halt running workers across all projects.
   - Global System Maintenance Mode toggle.

2. **Projects Control System**:
   - Centralized project catalog across all accounts.
   - Direct Git repository sync and commit SHA updater.
   - Dynamic build command and output directory configuration.
   - Bulk project rebuild trigger and single-project abort.
   - Permanent project deletion and cascading database cleanup.

3. **Cloudflare Accounts & Quotas Vault**:
   - Secure encrypted vault for Cloudflare Account IDs and API tokens.
   - Live Cloudflare REST API v4 token verification tester (`/client/v4/user/tokens/verify` & `/client/v4/accounts/{account_id}`).
   - Subdomain and custom domain binding controls.
   - Token masking and unmasking toggles for security audits.

4. **Deployments & Queue Control**:
   - Real-time deployment queue monitor across all projects.
   - Interactive terminal build log inspection with instant copy to clipboard.
   - Single deployment retry and force cancellation of stuck build steps.
   - Live custom domain and pages.dev HTTP connectivity checks.

5. **User & Access Control**:
   - Management of administrators and operators (`app_users`).
   - Secure PBKDF2 with SHA-512 password hashing and salt generation.
   - Session manager with active token revocation (`app_sessions`).
   - Role-based policy enforcement.

6. **System Settings & Policy Engine**:
   - Dynamic worker concurrency pool limiter (1 to 10 workers).
   - Maximum build timeout limiter (seconds).
   - External Webhook dispatch for Discord/Slack/Custom automations.
   - Auto DNS verification flag and failure alerts.

7. **Neon Database Diagnostics**:
   - Exact row counts for all database tables.
   - PostgreSQL table statistics from `pg_stat_user_tables`.
   - Routine cleanup executor (purges expired sessions and normalizes orphaned states).
   - Complete system state backup JSON export.

8. **Forensic Audit Trail**:
   - Immutable audit log of all administrative actions with IP addresses and JSON payloads.
