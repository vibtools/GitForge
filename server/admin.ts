import { Router, Request, Response } from 'express';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { pool, logAudit } from './db.js';
import { requireAuth, hashPassword, verifyPassword, createSession, validateSession, invalidateSessionCache } from './auth.js';
import {
  cancelAllBuilds,
  getActiveBuildsCount,
  cancelProjectBuild,
  isProjectBuilding,
  runBulkBuild,
  verifyCloudflareCredentials,
  fetchGitHubRepoDetails,
} from './builder.js';
import { resolveRedirectUri } from './cf-oauth.js';
import {
  getS3Credentials,
  checkS3Connection,
  getStorageReport,
  generatePresignedUrl,
  uploadFileToS3,
  deleteS3Object,
} from './s3-utils.js';

export const adminRouter = Router();

/**
 * GET /api/admin/auth/status
 * Check if initial setup is required or if caller is authenticated admin
 */
adminRouter.get('/auth/status', async (req: Request, res: Response) => {
  try {
    const adminCountRes = await pool.query(
      `SELECT COUNT(*) FROM app_users WHERE role = 'admin'`
    );
    const totalAdmins = parseInt(adminCountRes.rows[0]?.count || '0', 10);

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-session-token'] as string);

    if (!token) {
      return res.json({ has_admin: totalAdmins > 0, is_admin: false, user: null });
    }

    const user = await validateSession(token);
    if (!user) {
      return res.json({ has_admin: totalAdmins > 0, is_admin: false, user: null });
    }

    let isAdmin = user.role === 'admin';
    // If no admin exists in the system yet, promote currently authenticated user to admin
    if (!isAdmin && totalAdmins === 0) {
      await pool.query(`UPDATE app_users SET role = 'admin' WHERE id = $1`, [user.id]);
      user.role = 'admin';
      isAdmin = true;
      invalidateSessionCache(token);
    }

    res.json({
      has_admin: totalAdmins > 0 || isAdmin,
      is_admin: isAdmin,
      user: isAdmin ? user : null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/auth/setup
 * First-time setup: Provision master administrator
 */
adminRouter.post('/auth/setup', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Check if any admin already exists
    const adminCountRes = await pool.query(
      `SELECT COUNT(*) FROM app_users WHERE role = 'admin'`
    );
    const totalAdmins = parseInt(adminCountRes.rows[0]?.count || '0', 10);
    if (totalAdmins > 0) {
      return res.status(403).json({ error: 'Administrator already configured. Please log in.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { hash, salt } = hashPassword(password);
    const userId = 'usr_master_' + crypto.randomBytes(6).toString('hex');
    const adminName = (name || 'Master Admin').trim();

    await pool.query(
      `INSERT INTO app_users (id, email, password_hash, salt, name, role)
       VALUES ($1, $2, $3, $4, $5, 'admin')
       ON CONFLICT (email) DO UPDATE SET role = 'admin', password_hash = EXCLUDED.password_hash, salt = EXCLUDED.salt`,
      [userId, normalizedEmail, hash, salt, adminName]
    );

    const token = await createSession(userId);
    invalidateSessionCache();
    await logAudit(normalizedEmail, 'MASTER_ADMIN_INITIALIZED', { email: normalizedEmail, name: adminName }, req.ip);

    res.status(201).json({
      success: true,
      token,
      user: { id: userId, email: normalizedEmail, name: adminName, role: 'admin' },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/auth/login
 * Secure Administrator Login
 */
adminRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query('SELECT * FROM app_users WHERE LOWER(TRIM(email)) = $1', [normalizedEmail]);
    if (result.rows.length === 0) {
      await logAudit(normalizedEmail, 'ADMIN_LOGIN_FAILED', { reason: 'User not found' }, req.ip);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];
    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      await logAudit(normalizedEmail, 'ADMIN_LOGIN_FAILED', { reason: 'Password mismatch' }, req.ip);
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const adminCountRes = await pool.query(`SELECT COUNT(*) FROM app_users WHERE role = 'admin'`);
    const totalAdmins = parseInt(adminCountRes.rows[0]?.count || '0', 10);

    // If no admin is configured in system yet, promote this user
    if (user.role !== 'admin' && totalAdmins === 0) {
      await pool.query(`UPDATE app_users SET role = 'admin' WHERE id = $1`, [user.id]);
      user.role = 'admin';
    }

    if (user.role !== 'admin') {
      await logAudit(normalizedEmail, 'ADMIN_LOGIN_DENIED', { reason: 'Insufficient privileges' }, req.ip);
      return res.status(403).json({ error: 'Access denied: Account does not have administrator privileges.' });
    }

    const token = await createSession(user.id);
    invalidateSessionCache();
    await logAudit(normalizedEmail, 'ADMIN_LOGIN_SUCCESS', { user_id: user.id }, req.ip);

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Middleware: all subsequent admin routes require authenticated administrator session
const requireAdminAuth = async (req: Request, res: Response, next: () => void) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-session-token'] as string);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Administrator session required.' });
  }

  const user = await validateSession(token);
  if (!user) {
    return res.status(401).json({ error: 'Session expired or invalid. Please re-login.' });
  }

  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
  }

  (req as any).user = user;
  next();
};

adminRouter.use(requireAdminAuth);

/**
 * GET /api/admin/overview
 * Real-time system vitals, project/account counters, build queues, memory/CPU
 */
adminRouter.get('/overview', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();

    // Parallelize all diagnostic & counter queries concurrently for maximum speed
    const [dbPing, countsRes, settingsRes, auditRes] = await Promise.all([
      pool.query('SELECT NOW() as now'),
      pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM cf_projects)::int as total_projects,
          (SELECT COUNT(*) FROM cf_accounts)::int as total_accounts,
          (SELECT COUNT(*) FROM cf_deployments)::int as total_deployments,
          (SELECT COUNT(*) FROM cf_deployments WHERE build_status = 'success')::int as success_deployments,
          (SELECT COUNT(*) FROM cf_deployments WHERE build_status = 'failed')::int as failed_deployments,
          (SELECT COUNT(*) FROM cf_deployments WHERE build_status IN ('building', 'queued'))::int as building_deployments,
          (SELECT COUNT(*) FROM app_users)::int as total_users,
          (SELECT COUNT(*) FROM app_sessions WHERE expires_at > NOW())::int as active_sessions
      `),
      pool.query('SELECT key, value FROM app_settings'),
      pool.query(`
        SELECT * FROM app_audit_logs 
        ORDER BY created_at DESC 
        LIMIT 8
      `),
    ]);

    const dbLatencyMs = Date.now() - startTime;

    const settingsMap: Record<string, string> = {};
    for (const row of settingsRes.rows) {
      settingsMap[row.key] = row.value;
    }

    const freemem = os.freemem();
    const totalmem = os.totalmem();
    const usedMemMb = Math.round((totalmem - freemem) / (1024 * 1024));
    const totalMemMb = Math.round(totalmem / (1024 * 1024));

    res.json({
      counters: countsRes.rows[0],
      active_builds: getActiveBuildsCount(),
      system: {
        uptime_sec: Math.floor(os.uptime()),
        platform: os.platform(),
        cpus: os.cpus().length,
        memory_used_mb: usedMemMb,
        memory_total_mb: totalMemMb,
        memory_percent: Math.round((usedMemMb / totalMemMb) * 100),
        node_version: process.version,
        process_uptime_sec: Math.floor(process.uptime()),
      },
      db: {
        status: 'connected',
        latency_ms: dbLatencyMs,
        neon_time: dbPing.rows[0]?.now,
      },
      maintenance_mode: settingsMap['maintenance_mode'] === 'true',
      concurrency_limit: parseInt(settingsMap['concurrency_limit'] || '3', 10),
      recent_audit_logs: auditRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/emergency-abort
 * Global Kill Switch: cancels all builds across every project
 */
adminRouter.post('/emergency-abort', async (req: Request, res: Response) => {
  const user = (req as any).user;
  try {
    const canceledWorkers = cancelAllBuilds();

    // Mark any running deployments as canceled in DB
    const updateRes = await pool.query(`
      UPDATE cf_deployments 
      SET build_status = 'failed',
          current_step = 'Build aborted by Administrator via Global Kill Switch',
          error_message = 'Emergency Stop triggered by administrator.'
      WHERE build_status IN ('building', 'queued')
      RETURNING id, project_id
    `);

    // Update active projects status
    await pool.query(`
      UPDATE cf_projects 
      SET status = 'partial_error' 
      WHERE status = 'building'
    `);

    await logAudit(
      user.email,
      'EMERGENCY_GLOBAL_ABORT',
      { canceled_workers: canceledWorkers, affected_deployments: updateRes.rowCount },
      req.ip
    );

    res.json({
      success: true,
      message: `Global emergency abort completed. Aborted ${canceledWorkers} worker pools and ${updateRes.rowCount} in-progress deployment tasks.`,
      canceled_workers: canceledWorkers,
      affected_deployments: updateRes.rowCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/settings
 * Fetch all system settings
 */
adminRouter.get('/settings', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM app_settings ORDER BY key ASC');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/settings
 * Update system settings (concurrency, timeout, maintenance mode, webhooks)
 */
adminRouter.post('/settings', async (req: Request, res: Response) => {
  const user = (req as any).user;
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: 'Settings object is required' });
    }

    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        `INSERT INTO app_settings (key, value, updated_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, String(value)]
      );
    }

    await logAudit(user.email, 'SETTINGS_UPDATED', { updated_keys: Object.keys(settings) }, req.ip);

    const updated = await pool.query('SELECT * FROM app_settings ORDER BY key ASC');
    res.json({ success: true, settings: updated.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/site-settings
 * Fetch comprehensive site branding, SEO, assets, and public portal settings
 */
adminRouter.get('/site-settings', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT key, value FROM app_settings');
    const map: Record<string, string> = {};
    for (const row of result.rows) {
      map[row.key] = row.value;
    }
    res.json({
      site_name: map['site_name'] || 'GitForge',
      site_tagline: map['site_tagline'] || 'Multi-Account Cloudflare Pages Fleet Orchestrator',
      site_description: map['site_description'] || 'High-Performance Git Repository Multi-Account Cloudflare Pages Deployment Orchestrator & vCon Forensic Command Console',
      site_logo_url: map['site_logo_url'] || '',
      site_favicon_url: map['site_favicon_url'] || '',
      site_primary_color: map['site_primary_color'] || '#ea580c',
      site_footer_text: map['site_footer_text'] || 'GitForge — Multi-Account Cloudflare Pages Fleet Orchestrator',
      site_support_email: map['site_support_email'] || 'support@gitforge.dev',
      site_support_url: map['site_support_url'] || '',
      allow_public_registration: map['allow_public_registration'] !== 'false',
      maintenance_mode: map['maintenance_mode'] === 'true',
      maintenance_banner: map['maintenance_banner'] || '',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/site-settings
 * Update site branding, logos, favicons, taglines, and public policies
 */
adminRouter.post('/site-settings', async (req: Request, res: Response) => {
  const user = (req as any).user;
  try {
    const payload = req.body;
    if (!payload || typeof payload !== 'object') {
      return res.status(400).json({ error: 'Site settings payload is required' });
    }

    const allowedKeys: Record<string, (val: any) => string> = {
      site_name: (v) => String(v || '').trim() || 'GitForge',
      site_tagline: (v) => String(v || '').trim(),
      site_description: (v) => String(v || '').trim(),
      site_logo_url: (v) => String(v || '').trim(),
      site_favicon_url: (v) => String(v || '').trim(),
      site_primary_color: (v) => String(v || '#ea580c').trim(),
      site_footer_text: (v) => String(v || '').trim(),
      site_support_email: (v) => String(v || '').trim(),
      site_support_url: (v) => String(v || '').trim(),
      allow_public_registration: (v) => (v === false || v === 'false' ? 'false' : 'true'),
      maintenance_mode: (v) => (v === true || v === 'true' ? 'true' : 'false'),
      maintenance_banner: (v) => String(v || '').trim(),
    };

    const updatedKeys: string[] = [];

    for (const [key, sanitize] of Object.entries(allowedKeys)) {
      if (key in payload) {
        const strVal = sanitize(payload[key]);
        await pool.query(
          `INSERT INTO app_settings (key, value, updated_at) 
           VALUES ($1, $2, NOW()) 
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [key, strVal]
        );
        updatedKeys.push(key);
      }
    }

    await logAudit(
      user.email,
      'SITE_SETTINGS_UPDATED',
      { updated_keys: updatedKeys, site_name: payload.site_name },
      req.ip
    );

    // Return the fresh consolidated site settings
    const result = await pool.query('SELECT key, value FROM app_settings');
    const map: Record<string, string> = {};
    for (const row of result.rows) {
      map[row.key] = row.value;
    }

    const consolidated = {
      site_name: map['site_name'] || 'GitForge',
      site_tagline: map['site_tagline'] || 'Multi-Account Cloudflare Pages Fleet Orchestrator',
      site_description: map['site_description'] || 'High-Performance Git Repository Multi-Account Cloudflare Pages Deployment Orchestrator & vCon Forensic Command Console',
      site_logo_url: map['site_logo_url'] || '',
      site_favicon_url: map['site_favicon_url'] || '',
      site_primary_color: map['site_primary_color'] || '#ea580c',
      site_footer_text: map['site_footer_text'] || 'GitForge — Multi-Account Cloudflare Pages Fleet Orchestrator',
      site_support_email: map['site_support_email'] || 'support@gitforge.dev',
      site_support_url: map['site_support_url'] || '',
      allow_public_registration: map['allow_public_registration'] !== 'false',
      maintenance_mode: map['maintenance_mode'] === 'true',
      maintenance_banner: map['maintenance_banner'] || '',
    };

    res.json({
      success: true,
      message: 'Site settings updated successfully.',
      site_settings: consolidated,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/users
 * Manage app administrators & operators
 */
adminRouter.get('/users', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.email, u.name, COALESCE(u.role, 'admin') as role, u.created_at,
        (SELECT COUNT(*) FROM app_sessions s WHERE s.user_id = u.id AND s.expires_at > NOW())::int as active_sessions,
        (SELECT MAX(s.created_at) FROM app_sessions s WHERE s.user_id = u.id) as last_login
      FROM app_users u
      ORDER BY u.created_at ASC
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/users
 * Admin creates a new user/administrator
 */
adminRouter.post('/users', async (req: Request, res: Response) => {
  const admin = (req as any).user;
  try {
    const { email, password, name, role = 'admin' } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await pool.query('SELECT id FROM app_users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists with this email' });
    }

    const { hash, salt } = hashPassword(password);
    const userId = 'usr_' + crypto.randomBytes(8).toString('hex');

    await pool.query(
      `INSERT INTO app_users (id, email, password_hash, salt, name, role) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, normalizedEmail, hash, salt, name.trim(), role]
    );

    await logAudit(
      admin.email,
      'USER_CREATED',
      { created_user: normalizedEmail, role },
      req.ip
    );

    res.status(201).json({
      success: true,
      user: { id: userId, email: normalizedEmail, name: name.trim(), role },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/admin/users/:id
 * Update user details or reset password
 */
adminRouter.put('/users/:id', async (req: Request, res: Response) => {
  const admin = (req as any).user;
  try {
    const { id } = req.params;
    const { name, role, password } = req.body;

    const userRes = await pool.query('SELECT * FROM app_users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (name) {
      updates.push(`name = $${idx++}`);
      values.push(name.trim());
    }
    if (role) {
      updates.push(`role = $${idx++}`);
      values.push(role);
    }
    if (password && password.trim()) {
      const { hash, salt } = hashPassword(password.trim());
      updates.push(`password_hash = $${idx++}`);
      values.push(hash);
      updates.push(`salt = $${idx++}`);
      values.push(salt);
    }

    if (updates.length > 0) {
      values.push(id);
      await pool.query(
        `UPDATE app_users SET ${updates.join(', ')} WHERE id = $${idx}`,
        values
      );
    }

    await logAudit(
      admin.email,
      'USER_UPDATED',
      { target_user_id: id, password_reset: !!password, role_changed: !!role },
      req.ip
    );

    res.json({ success: true, message: 'User updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Remove user and revoke all sessions
 */
adminRouter.delete('/users/:id', async (req: Request, res: Response) => {
  const admin = (req as any).user;
  try {
    const { id } = req.params;

    // Check if user exists
    const userRes = await pool.query('SELECT email FROM app_users WHERE id = $1', [id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting the only remaining user
    const totalUsersRes = await pool.query('SELECT COUNT(*) FROM app_users');
    if (parseInt(totalUsersRes.rows[0].count, 10) <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only existing administrator.' });
    }

    await pool.query('DELETE FROM app_users WHERE id = $1', [id]);
    invalidateSessionCache();

    await logAudit(
      admin.email,
      'USER_DELETED',
      { deleted_user_email: userRes.rows[0].email, user_id: id },
      req.ip
    );

    res.json({ success: true, message: 'User and all active sessions removed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/sessions
 * List active user login sessions
 */
adminRouter.get('/sessions', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT s.token, s.expires_at, s.created_at, u.id as user_id, u.email, u.name, u.role
      FROM app_sessions s
      JOIN app_users u ON u.id = s.user_id
      WHERE s.expires_at > NOW()
      ORDER BY s.created_at DESC
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/admin/sessions/:token
 * Revoke specific session token
 */
adminRouter.delete('/sessions/:token', async (req: Request, res: Response) => {
  const admin = (req as any).user;
  try {
    const { token } = req.params;
    invalidateSessionCache(token);
    await pool.query('DELETE FROM app_sessions WHERE token = $1', [token]);

    await logAudit(admin.email, 'SESSION_REVOKED', { revoked_token_prefix: token.slice(0, 8) }, req.ip);
    res.json({ success: true, message: 'Session revoked' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/projects
 * List all projects with extended stats for admin control
 */
adminRouter.get('/projects', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM cf_accounts a WHERE a.project_id = p.id)::int as account_count,
        (SELECT COUNT(*) FROM cf_deployments d WHERE d.project_id = p.id AND d.build_status = 'success')::int as success_count,
        (SELECT COUNT(*) FROM cf_deployments d WHERE d.project_id = p.id AND d.build_status = 'failed')::int as failed_count,
        (SELECT COUNT(*) FROM cf_deployments d WHERE d.project_id = p.id AND d.build_status IN ('building', 'queued'))::int as building_count
      FROM cf_projects p
      ORDER BY p.updated_at DESC
    `);

    const projectsWithRunningState = result.rows.map((p: any) => ({
      ...p,
      is_building: isProjectBuilding(p.id),
    }));

    res.json(projectsWithRunningState);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/projects/:id/sync-repo
 * Re-fetch latest git commit from GitHub
 */
adminRouter.post('/projects/:id/sync-repo', async (req: Request, res: Response) => {
  const admin = (req as any).user;
  try {
    const { id } = req.params;
    const projRes = await pool.query('SELECT * FROM cf_projects WHERE id = $1', [id]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const proj = projRes.rows[0];
    const commit = await fetchGitHubRepoDetails(proj.github_repo, proj.github_branch, proj.github_token);

    const updated = await pool.query(
      `UPDATE cf_projects 
       SET latest_commit_sha = $1, latest_commit_message = $2, updated_at = NOW() 
       WHERE id = $3 
       RETURNING *`,
      [commit.sha, commit.message, id]
    );

    await logAudit(
      admin.email,
      'PROJECT_GIT_SYNCED',
      { project_id: id, sha: commit.sha, commit_message: commit.message },
      req.ip
    );

    res.json({ success: true, project: updated.rows[0], commit });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/accounts
 * Global list of all Cloudflare accounts across projects
 */
adminRouter.get('/accounts', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT a.*, 
             p.name as project_name, p.root_domain, p.github_repo,
             d.id as deployment_id, d.build_status, d.pages_dev_domain, d.custom_domain, d.error_message, d.dns_status
      FROM cf_accounts a
      JOIN cf_projects p ON p.id = a.project_id
      LEFT JOIN cf_deployments d ON d.account_id = a.id AND d.project_id = a.project_id
      ORDER BY a.created_at DESC
    `);

    // Mask api tokens for security in default payload (first 4 and last 4 shown)
    const accounts = result.rows.map((row: any) => {
      const rawToken = row.api_token || '';
      const masked = rawToken.length > 8
        ? rawToken.slice(0, 4) + '••••••••' + rawToken.slice(-4)
        : '••••••••';
      return {
        ...row,
        masked_token: masked,
      };
    });

    res.json(accounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/accounts/verify-token
 * Live verification test of a Cloudflare Account ID & API Token
 */
adminRouter.post('/accounts/verify-token', async (req: Request, res: Response) => {
  try {
    const { account_id, api_token } = req.body;
    if (!account_id || !api_token) {
      return res.status(400).json({ error: 'account_id and api_token are required' });
    }

    const result = await verifyCloudflareCredentials(account_id, api_token);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PUT /api/admin/accounts/:id
 * Edit account credentials or subdomain
 */
adminRouter.put('/accounts/:id', async (req: Request, res: Response) => {
  const admin = (req as any).user;
  try {
    const { id } = req.params;
    const { alias, account_id, api_token, subdomain, email } = req.body;

    const accRes = await pool.query('SELECT * FROM cf_accounts WHERE id = $1', [id]);
    if (accRes.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const updates: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (alias) {
      updates.push(`alias = $${idx++}`);
      values.push(alias.trim());
    }
    if (account_id) {
      updates.push(`account_id = $${idx++}`);
      values.push(account_id.trim());
    }
    if (api_token && api_token.trim()) {
      updates.push(`api_token = $${idx++}`);
      values.push(api_token.trim());
    }
    if (subdomain) {
      updates.push(`subdomain = $${idx++}`);
      values.push(subdomain.trim().toLowerCase());
    }
    if (email !== undefined) {
      updates.push(`email = $${idx++}`);
      values.push(email.trim());
    }

    if (updates.length > 0) {
      values.push(id);
      await pool.query(
        `UPDATE cf_accounts SET ${updates.join(', ')} WHERE id = $${idx}`,
        values
      );
    }

    await logAudit(
      admin.email,
      'ACCOUNT_UPDATED_BY_ADMIN',
      { account_id: id, alias, subdomain },
      req.ip
    );

    res.json({ success: true, message: 'Account updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/admin/accounts/:id
 * Remove account from project
 */
adminRouter.delete('/accounts/:id', async (req: Request, res: Response) => {
  const admin = (req as any).user;
  try {
    const { id } = req.params;
    const accRes = await pool.query('SELECT alias, project_id FROM cf_accounts WHERE id = $1', [id]);
    if (accRes.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    await pool.query('DELETE FROM cf_accounts WHERE id = $1', [id]);

    await logAudit(
      admin.email,
      'ACCOUNT_DELETED_BY_ADMIN',
      { account_id: id, alias: accRes.rows[0].alias },
      req.ip
    );

    res.json({ success: true, message: 'Account deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/deployments
 * Global deployments view with comprehensive filters
 */
adminRouter.get('/deployments', async (req: Request, res: Response) => {
  try {
    const { status, project_id, limit = '100' } = req.query;

    let query = `
      SELECT d.*, 
             p.name as project_name, p.root_domain, p.github_repo,
             a.alias as account_alias, a.account_id as cf_account_id, a.subdomain
      FROM cf_deployments d
      JOIN cf_projects p ON p.id = d.project_id
      JOIN cf_accounts a ON a.id = d.account_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let idx = 1;

    if (status && status !== 'all') {
      query += ` AND d.build_status = $${idx++}`;
      params.push(status);
    }

    if (project_id && project_id !== 'all') {
      query += ` AND d.project_id = $${idx++}`;
      params.push(project_id);
    }

    query += ` ORDER BY d.updated_at DESC LIMIT $${idx}`;
    params.push(Math.min(parseInt(limit as string, 10) || 100, 300));

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/deployments/:id/force-cancel
 * Admin marks a stuck deployment as canceled/failed
 */
adminRouter.post('/deployments/:id/force-cancel', async (req: Request, res: Response) => {
  const admin = (req as any).user;
  try {
    const { id } = req.params;
    await pool.query(
      `UPDATE cf_deployments 
       SET build_status = 'failed', 
           current_step = 'Build force-canceled by Administrator',
           error_message = 'Build terminated manually from vCon Admin Control.'
       WHERE id = $1`,
      [id]
    );

    await logAudit(admin.email, 'DEPLOYMENT_FORCE_CANCELED', { deployment_id: id }, req.ip);
    res.json({ success: true, message: 'Deployment status marked as canceled' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/admin/deployments/:id
 * Remove deployment record
 */
adminRouter.delete('/deployments/:id', async (req: Request, res: Response) => {
  const admin = (req as any).user;
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM cf_deployments WHERE id = $1', [id]);
    await logAudit(admin.email, 'DEPLOYMENT_DELETED', { deployment_id: id }, req.ip);
    res.json({ success: true, message: 'Deployment record deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/db-stats
 * Real-time Neon PostgreSQL table metrics and diagnostic health
 */
adminRouter.get('/db-stats', async (_req: Request, res: Response) => {
  try {
    const [tablesQuery, tableCounts] = await Promise.all([
      pool.query(`
        SELECT 
          relname AS table_name,
          n_live_tup AS row_estimate
        FROM pg_stat_user_tables
        ORDER BY n_live_tup DESC;
      `),
      pool.query(`
        SELECT
          (SELECT COUNT(*) FROM cf_projects)::int as cf_projects,
          (SELECT COUNT(*) FROM cf_accounts)::int as cf_accounts,
          (SELECT COUNT(*) FROM cf_deployments)::int as cf_deployments,
          (SELECT COUNT(*) FROM app_users)::int as app_users,
          (SELECT COUNT(*) FROM app_sessions)::int as app_sessions,
          (SELECT COUNT(*) FROM app_audit_logs)::int as app_audit_logs
      `),
    ]);

    const poolStats = {
      total_count: pool.totalCount,
      idle_count: pool.idleCount,
      waiting_count: pool.waitingCount,
    };

    res.json({
      status: 'healthy',
      provider: 'Neon Serverless PostgreSQL',
      exact_counts: tableCounts.rows[0],
      stat_tables: tablesQuery.rows,
      connection_pool: poolStats,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/db-cleanup
 * Clean up old logs, expired sessions, and reset orphaned build records
 */
adminRouter.post('/db-cleanup', async (req: Request, res: Response) => {
  const admin = (req as any).user;
  try {
    // 1. Delete expired sessions
    const expiredSessions = await pool.query('DELETE FROM app_sessions WHERE expires_at < NOW()');

    // 2. Trim old audit logs (keep last 500)
    await pool.query(`
      DELETE FROM app_audit_logs 
      WHERE id NOT IN (
        SELECT id FROM app_audit_logs ORDER BY created_at DESC LIMIT 500
      )
    `);

    // 3. Reset any orphaned builds
    const resetBuilds = await pool.query(`
      UPDATE cf_deployments 
      SET build_status = 'failed',
          current_step = 'Cleaned by DB maintenance routine'
      WHERE build_status IN ('building', 'queued')
    `);

    await logAudit(
      admin.email,
      'DB_CLEANUP_PERFORMED',
      {
        expired_sessions_cleared: expiredSessions.rowCount,
        orphaned_builds_reset: resetBuilds.rowCount,
      },
      req.ip
    );

    res.json({
      success: true,
      message: 'Database cleanup routine executed successfully.',
      expired_sessions_cleared: expiredSessions.rowCount,
      orphaned_builds_reset: resetBuilds.rowCount,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/audit-logs
 * Paginated Audit Logs with search & action filtering
 */
adminRouter.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    const { action, limit = '50' } = req.query;
    let query = 'SELECT * FROM app_audit_logs';
    const params: any[] = [];

    if (action && action !== 'all') {
      query += ' WHERE action = $1';
      params.push(action);
      query += ' ORDER BY created_at DESC LIMIT $2';
      params.push(parseInt(limit as string, 10) || 50);
    } else {
      query += ' ORDER BY created_at DESC LIMIT $1';
      params.push(parseInt(limit as string, 10) || 50);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/admin/export-system
 * Complete system state export for backup / disaster recovery
 */
adminRouter.get('/export-system', async (req: Request, res: Response) => {
  const admin = (req as any).user;
  try {
    const projects = await pool.query('SELECT * FROM cf_projects');
    const accounts = await pool.query('SELECT id, project_id, alias, account_id, subdomain, email, created_at FROM cf_accounts');
    const deployments = await pool.query('SELECT id, project_id, account_id, cf_pages_project_name, pages_dev_domain, custom_domain, cname_host, cname_target, dns_status, build_status, deployed_at FROM cf_deployments');
    const settings = await pool.query('SELECT * FROM app_settings');

    await logAudit(admin.email, 'SYSTEM_EXPORT_DOWNLOADED', {}, req.ip);

    const exportData = {
      exported_at: new Date().toISOString(),
      exported_by: admin.email,
      system_version: '1.0.0',
      projects: projects.rows,
      accounts: accounts.rows,
      deployments: deployments.rows,
      settings: settings.rows,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=vcon_system_backup_${Date.now()}.json`);
    res.json(exportData);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/test-webhook
 * Trigger test payload to configured webhook URL
 */
adminRouter.post('/test-webhook', async (req: Request, res: Response) => {
  const admin = (req as any).user;
  try {
    const { webhook_url } = req.body;
    if (!webhook_url) {
      return res.status(400).json({ error: 'Webhook URL is required' });
    }

    const payload = {
      event: 'vcon.admin.test_ping',
      timestamp: new Date().toISOString(),
      sender: admin.email,
      message: 'vCon Admin Control: Webhook connection verified successfully!',
    };

    const webhookRes = await fetch(webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    res.json({
      success: webhookRes.ok,
      status: webhookRes.status,
      statusText: webhookRes.statusText,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Webhook trigger failed: ${err.message}` });
  }
});

/**
 * POST /api/admin/cloudflare/oauth/test
 * Test and verify Cloudflare OAuth App credentials (Client ID and Secret)
 */
adminRouter.post('/cloudflare/oauth/test', async (req: Request, res: Response) => {
  try {
    const { client_id, client_secret } = req.body || {};
    if (!client_id || !client_secret) {
      return res.status(400).json({ valid: false, error: 'Both Client ID and Client Secret are required.' });
    }

    const trimmedId = String(client_id).trim();
    const trimmedSecret = String(client_secret).trim();

    if (trimmedId.length < 8) {
      return res.json({ valid: false, error: 'Client ID is invalid or too short.' });
    }

    // Query Cloudflare OAuth token endpoint with basic auth
    const basicAuth = Buffer.from(`${trimmedId}:${trimmedSecret}`).toString('base64');
    const redirectUri = resolveRedirectUri(req);

    const cfRes = await fetch('https://dash.cloudflare.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: 'probe_test_check',
        redirect_uri: redirectUri,
        client_id: trimmedId,
        client_secret: trimmedSecret,
      }).toString(),
    });

    const data = await cfRes.json().catch(() => ({}));

    // If Cloudflare explicitly returns invalid_client or 401, client credentials are rejected
    if (cfRes.status === 401 || data.error === 'invalid_client') {
      return res.json({
        valid: false,
        error: `Cloudflare rejected credentials (${data.error_description || data.error || 'invalid_client'}). Please check your Client ID and Client Secret in Cloudflare Dashboard.`,
      });
    }

    // If Cloudflare returns redirect_uri_mismatch, client is authenticated but callback URI must be configured
    if (data.error === 'redirect_uri_mismatch') {
      return res.json({
        valid: false,
        error: `Client credentials are valid, but redirect URI (${redirectUri}) must be added to your Cloudflare OAuth App in the Cloudflare Dashboard.`,
      });
    }

    // If response is invalid_grant or code-related 400, this confirms client_id & client_secret are authentic
    if (
      data.error === 'invalid_grant' ||
      data.error === 'invalid_request' ||
      cfRes.status === 400
    ) {
      return res.json({
        valid: true,
        message: 'Cloudflare OAuth App credentials verified successfully! Client ID & Secret are authentic.',
      });
    }

    return res.json({
      valid: true,
      message: 'Cloudflare OAuth connection test passed.',
    });
  } catch (err: any) {
    res.status(500).json({ valid: false, error: err.message || 'Connection test failed' });
  }
});

/**
 * GET /api/admin/storage/config
 * Retrieve current S3 / Backblaze B2 credentials (with masked secret key)
 */
adminRouter.get('/storage/config', async (_req: Request, res: Response) => {
  try {
    const creds = await getS3Credentials();
    const masked = creds.secretAccessKey
      ? creds.secretAccessKey.length > 8
        ? creds.secretAccessKey.slice(0, 4) + '••••••••' + creds.secretAccessKey.slice(-4)
        : '••••••••'
      : '';

    res.json({
      s3_access_key_id: creds.accessKeyId,
      s3_bucket_name: creds.bucketName,
      s3_endpoint: creds.endpoint,
      s3_region: creds.region,
      has_secret_key: Boolean(creds.secretAccessKey),
      masked_secret_key: masked,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/storage/config
 * Update S3 / Backblaze B2 credentials in database app_settings
 */
adminRouter.post('/storage/config', async (req: Request, res: Response) => {
  const admin = (req as any).user;
  try {
    const {
      s3_access_key_id,
      s3_secret_access_key,
      s3_bucket_name,
      s3_endpoint,
      s3_region,
    } = req.body;

    const updates: Record<string, string> = {
      s3_access_key_id: String(s3_access_key_id || '').trim(),
      s3_bucket_name: String(s3_bucket_name || '').trim(),
      s3_endpoint: String(s3_endpoint || '').trim(),
      s3_region: String(s3_region || '').trim(),
    };

    if (s3_secret_access_key && s3_secret_access_key.trim()) {
      updates['s3_secret_access_key'] = s3_secret_access_key.trim();
    }

    for (const [key, value] of Object.entries(updates)) {
      await pool.query(
        `INSERT INTO app_settings (key, value, updated_at) 
         VALUES ($1, $2, NOW()) 
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, value]
      );
    }

    await logAudit(
      admin.email,
      'STORAGE_SETTINGS_UPDATED',
      {
        bucket: updates.s3_bucket_name,
        endpoint: updates.s3_endpoint,
        region: updates.s3_region,
        has_secret_key: Boolean(updates.s3_secret_access_key),
      },
      req.ip
    );

    res.json({ success: true, message: 'Storage credentials saved successfully.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/storage/test-connection
 * Live verification test of S3 / Backblaze B2 connection
 */
adminRouter.post('/storage/test-connection', async (req: Request, res: Response) => {
  try {
    const {
      s3_access_key_id,
      s3_secret_access_key,
      s3_bucket_name,
      s3_endpoint,
      s3_region,
    } = req.body || {};

    const customCreds: any = {};
    if (s3_access_key_id) customCreds.accessKeyId = s3_access_key_id.trim();
    if (s3_secret_access_key) customCreds.secretAccessKey = s3_secret_access_key.trim();
    if (s3_bucket_name) customCreds.bucketName = s3_bucket_name.trim();
    if (s3_endpoint) customCreds.endpoint = s3_endpoint.trim();
    if (s3_region) customCreds.region = s3_region.trim();

    const result = await checkS3Connection(customCreds);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/admin/storage/report
 * Detailed storage capacity, sync, latency, and object list
 */
adminRouter.get('/storage/report', async (_req: Request, res: Response) => {
  try {
    const report = await getStorageReport();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/storage/upload-test
 * Upload a sample text, real binary, or base64 file to Backblaze S3
 */
adminRouter.post('/storage/upload-test', async (req: Request, res: Response) => {
  const admin = (req as any).user;
  try {
    const { fileName, content, contentType, isBase64 } = req.body || {};
    const finalKey = (fileName || `vcon_test_${Date.now()}.txt`).trim().replace(/^\/+/, '');
    
    let fileBuffer: Buffer;
    if (isBase64 || (content && content.startsWith('data:'))) {
      const base64Data = content.includes('base64,') ? content.split('base64,')[1] : content;
      fileBuffer = Buffer.from(base64Data, 'base64');
    } else if (content) {
      fileBuffer = Buffer.from(content, 'utf-8');
    } else {
      fileBuffer = Buffer.from(
        `GitForge vCon S3 Storage Probe\nTimestamp: ${new Date().toISOString()}\nUploaded by: ${admin.email}\nSystem: Neon PostgreSQL + S3 Compatible Storage\n`,
        'utf-8'
      );
    }

    const result = await uploadFileToS3(finalKey, fileBuffer, contentType || 'application/octet-stream');
    
    // Save record in database
    const fileId = 'file_' + Math.random().toString(36).substring(2, 12);
    await pool.query(
      `INSERT INTO app_storage_files (id, file_name, s3_key, size_bytes, content_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [fileId, path.basename(finalKey), finalKey, fileBuffer.length, contentType || 'application/octet-stream', admin.email]
    );

    await logAudit(
      admin.email,
      'STORAGE_FILE_UPLOADED',
      { key: finalKey, size_bytes: fileBuffer.length },
      req.ip
    );

    res.json({
      success: true,
      key: finalKey,
      size: fileBuffer.length,
      file_url: `/file/${finalKey}`,
      message: 'File uploaded to Backblaze S3 successfully.',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/admin/storage/presigned-url
 * Generate a pre-signed download / view URL for any object key
 */
adminRouter.post('/storage/presigned-url', async (req: Request, res: Response) => {
  try {
    const { fileName, expiresInSeconds = 3600 } = req.body;
    if (!fileName) {
      return res.status(400).json({ error: 'fileName is required' });
    }

    const cleanKey = decodeURIComponent(fileName).replace(/^\/+/, '');
    const signedUrl = await generatePresignedUrl(cleanKey, null, parseInt(expiresInSeconds, 10) || 3600);
    res.json({
      success: true,
      fileName: cleanKey,
      signedUrl,
      expiresInSeconds: parseInt(expiresInSeconds, 10) || 3600,
      access_route: `/file/${cleanKey}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/admin/storage/objects
 * Delete an object from the S3 bucket
 */
adminRouter.delete('/storage/objects', async (req: Request, res: Response) => {
  const admin = (req as any).user;
  try {
    const { fileName } = req.body;
    if (!fileName) {
      return res.status(400).json({ error: 'fileName is required' });
    }

    const cleanKey = decodeURIComponent(fileName).replace(/^\/+/, '');
    await deleteS3Object(cleanKey);
    await pool.query(`DELETE FROM app_storage_files WHERE s3_key = $1`, [cleanKey]);
    await logAudit(admin.email, 'STORAGE_OBJECT_DELETED', { key: cleanKey }, req.ip);

    res.json({ success: true, message: `Object ${cleanKey} deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

