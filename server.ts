import express from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { pool, initDb, logAudit } from './server/db.js';
import { runBulkBuild, isProjectBuilding, cancelProjectBuild, runWithConcurrency, fetchGitHubRepoDetails, sanitizePagesProjectName, verifyCloudflareCredentials, scanRepository } from './server/builder.js';
import { hashPassword, verifyPassword, createSession, validateSession, requireAuth, invalidateSessionCache } from './server/auth.js';
import { adminRouter } from './server/admin.js';
import { cfOAuthRouter } from './server/cf-oauth.js';
import { generatePresignedUrl, uploadFileToS3 } from './server/s3-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

// Enable Gzip/Deflate response compression for ultra-fast payload delivery
app.use(compression() as any);
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Mount vCon Admin Control APIs
app.use('/api/admin', adminRouter);

// Mount Cloudflare OAuth 2.0 Auth Router
app.use('/api/auth/cloudflare', cfOAuthRouter);

// Production / Docker / Coolify Health Check Endpoint
app.get('/api/health', async (_req, res) => {
  let dbStatus = 'disconnected';
  let dbLatencyMs = -1;
  const start = Date.now();
  try {
    const dbTest = await pool.query('SELECT 1 as alive');
    if (dbTest?.rows?.[0]?.alive === 1) {
      dbStatus = 'connected';
      dbLatencyMs = Date.now() - start;
    }
  } catch (err: any) {
    dbStatus = `error: ${err?.message || 'DB query failed'}`;
  }

  const isHealthy = dbStatus === 'connected';
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? 'healthy' : 'degraded',
    service: 'gitforge',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      latency_ms: dbLatencyMs,
    },
    version: '1.0.0',
  });
});

// S3 File Access Gateway: Generates pre-signed URL & 302 redirects user to secure temporary S3 / Backblaze URL
const handleFileRedirect = async (req: express.Request, res: express.Response) => {
  try {
    const rawFileName = req.params[0] || (req.params as any).fileName;
    if (!rawFileName) {
      return res.status(400).send('File name is required');
    }
    const cleanKey = decodeURIComponent(rawFileName).replace(/^\/+/, '');
    const signedUrl = await generatePresignedUrl(cleanKey, null, 3600);
    // User ke 302 (Temporary Redirect) diye Backblaze er secure link e pathiye dibe
    res.redirect(302, signedUrl);
  } catch (error: any) {
    console.error('S3 Pre-signed URL generation error:', error.message);
    res.status(404).send(`File access error: ${error.message || 'File not found'}`);
  }
};

app.get('/file/*', handleFileRedirect);
app.get('/api/file/*', handleFileRedirect);

// Unified File Upload API: Uploads file to Backblaze S3 private bucket, stores metadata in DB, returns /file/<key>
app.post('/api/upload', requireAuth, async (req: express.Request, res: express.Response) => {
  const user = (req as any).user;
  try {
    const { fileName, content, contentType = 'application/octet-stream', isBase64 } = req.body || {};
    if (!fileName || !content) {
      return res.status(400).json({ error: 'fileName and content are required' });
    }

    const cleanBaseName = path.basename(fileName).replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `uploads/${Date.now()}_${cleanBaseName}`;

    let buffer: Buffer;
    if (isBase64 || content.startsWith('data:')) {
      const base64Data = content.includes('base64,') ? content.split('base64,')[1] : content;
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      buffer = Buffer.from(content, 'utf-8');
    }

    await uploadFileToS3(s3Key, buffer, contentType);

    // Save record in database
    const fileId = 'file_' + Math.random().toString(36).substring(2, 12);
    await pool.query(
      `INSERT INTO app_storage_files (id, file_name, s3_key, size_bytes, content_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [fileId, cleanBaseName, s3Key, buffer.length, contentType, user.email || 'user']
    );

    await logAudit(user.email, 'FILE_UPLOADED_TO_S3', { key: s3Key, size: buffer.length }, req.ip);

    res.json({
      success: true,
      file_id: fileId,
      file_name: cleanBaseName,
      key: s3Key,
      file_url: `/file/${s3Key}`,
      size: buffer.length,
      content_type: contentType,
    });
  } catch (error: any) {
    console.error('[Upload Error]', error);
    res.status(500).json({ error: error.message || 'File upload to S3 failed' });
  }
});

// Public Site Settings: Site name, branding, tagline, favicon, and public policies
app.get('/api/site-settings', async (_req, res) => {
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

// Auth: Check current user / session
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-session-token'] as string);

    if (!token) {
      // Check if any users exist in the system
      const userCountRes = await pool.query('SELECT COUNT(*) FROM app_users');
      const totalUsers = parseInt(userCountRes.rows[0].count, 10);
      return res.json({ user: null, has_users: totalUsers > 0 });
    }

    const user = await validateSession(token);
    const userCountRes = await pool.query('SELECT COUNT(*) FROM app_users');
    const totalUsers = parseInt(userCountRes.rows[0].count, 10);

    res.json({ user, has_users: totalUsers > 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Auth: Register (Create initial admin or new user in Neon DB)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, confirmPassword, name } = req.body || {};
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail) || normalizedEmail.length > 254) {
      return res.status(400).json({ error: 'Please enter a valid email address' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    if (password.length > 128) {
      return res.status(400).json({ error: 'Password is too long (maximum 128 characters)' });
    }

    // Check if public registration is enabled (initial setup is always permitted)
    const totalUsersRes = await pool.query('SELECT COUNT(*) FROM app_users');
    const totalUsers = parseInt(totalUsersRes.rows[0].count, 10);
    if (totalUsers > 0) {
      const regSettingRes = await pool.query("SELECT value FROM app_settings WHERE key = 'allow_public_registration'");
      const allowRegistration = regSettingRes.rows.length === 0 || regSettingRes.rows[0].value !== 'false';
      if (!allowRegistration) {
        return res.status(403).json({ error: 'Public user registration is currently disabled by administrator.' });
      }
    }

    const existing = await pool.query('SELECT id FROM app_users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account already exists with this email address' });
    }

    const { hash, salt } = hashPassword(password);
    const userId = 'usr_' + crypto.randomBytes(8).toString('hex');
    const userName = (typeof name === 'string' && name.trim() ? name.trim() : normalizedEmail.split('@')[0]).slice(0, 100);

    await pool.query(
      `INSERT INTO app_users (id, email, password_hash, salt, name) VALUES ($1, $2, $3, $4, $5)`,
      [userId, normalizedEmail, hash, salt, userName]
    );

    const token = await createSession(userId);
    res.status(201).json({
      success: true,
      token,
      user: { id: userId, email: normalizedEmail, name: userName, role: totalUsers === 0 ? 'admin' : 'user' },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Registration failed' });
  }
});

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || typeof email !== 'string' || !password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query('SELECT * FROM app_users WHERE email = $1', [normalizedEmail]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];
    const isValid = verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = await createSession(user.id);
    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role || 'user' },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Authentication failed' });
  }
});

// Auth: Logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : (req.headers['x-session-token'] as string);
    if (token) {
      invalidateSessionCache(token);
      await pool.query('DELETE FROM app_sessions WHERE token = $1', [token]);
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// User Profile Update
app.post('/api/auth/profile', requireAuth, async (req, res) => {
  const user = (req as any).user;
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    await pool.query('UPDATE app_users SET name = $1 WHERE id = $2', [name.trim(), user.id]);
    invalidateSessionCache();

    res.json({ success: true, message: 'Profile updated', name: name.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// User Password Change
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const user = (req as any).user;
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const userRes = await pool.query('SELECT password_hash, salt FROM app_users WHERE id = $1', [user.id]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const dbUser = userRes.rows[0];
    const isCurrentValid = verifyPassword(currentPassword, dbUser.password_hash, dbUser.salt);
    if (!isCurrentValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const { hash, salt } = hashPassword(newPassword);
    await pool.query('UPDATE app_users SET password_hash = $1, salt = $2 WHERE id = $3', [hash, salt, user.id]);
    invalidateSessionCache();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// User Dashboard Stats & Overview
app.get('/api/user/stats', requireAuth, async (_req, res) => {
  try {
    const projectsCountRes = await pool.query('SELECT COUNT(*) FROM cf_projects');
    const accountsCountRes = await pool.query('SELECT COUNT(*) FROM cf_accounts');
    const liveDeploymentsRes = await pool.query("SELECT COUNT(*) FROM cf_deployments WHERE build_status = 'success'");
    const buildingDeploymentsRes = await pool.query("SELECT COUNT(*) FROM cf_deployments WHERE build_status = 'building'");
    const totalDeploymentsRes = await pool.query('SELECT COUNT(*) FROM cf_deployments');

    const totalProjects = parseInt(projectsCountRes.rows[0].count, 10) || 0;
    const totalAccounts = parseInt(accountsCountRes.rows[0].count, 10) || 0;
    const liveDeployments = parseInt(liveDeploymentsRes.rows[0].count, 10) || 0;
    const buildingDeployments = parseInt(buildingDeploymentsRes.rows[0].count, 10) || 0;
    const totalDeployments = parseInt(totalDeploymentsRes.rows[0].count, 10) || 0;

    const successRate = totalDeployments > 0 ? Math.round((liveDeployments / totalDeployments) * 100) : 100;

    const recentDeployments = await pool.query(`
      SELECT 
        d.id,
        d.project_id,
        p.name as project_name,
        a.alias as account_alias,
        d.cf_pages_project_name,
        d.custom_domain,
        d.pages_dev_domain,
        d.build_status,
        d.dns_status,
        d.deployed_at,
        d.created_at
      FROM cf_deployments d
      JOIN cf_projects p ON p.id = d.project_id
      JOIN cf_accounts a ON a.id = d.account_id
      ORDER BY d.deployed_at DESC NULLS LAST, d.created_at DESC
      LIMIT 10
    `);

    res.json({
      total_projects: totalProjects,
      total_accounts: totalAccounts,
      live_deployments: liveDeployments,
      building_deployments: buildingDeployments,
      success_rate_percent: successRate,
      recent_deployments: recentDeployments.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Health and DB check
app.get('/api/health', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({
      status: 'ok',
      db: 'connected',
      neon_time: result.rows[0].current_time,
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// GET /api/projects - List all projects
app.get('/api/projects', requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM cf_accounts a WHERE a.project_id = p.id)::int AS account_count,
        (SELECT COUNT(*) FROM cf_deployments d WHERE d.project_id = p.id AND d.build_status = 'success')::int AS successful_deployments
      FROM cf_projects p
      ORDER BY p.updated_at DESC
    `);
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects - Create project (Step 01: Name and Description)
app.post('/api/projects', requireAuth, async (req, res) => {
  try {
    const {
      name,
      description = '',
      github_repo = '',
      github_branch = 'main',
      github_token = '',
      build_command = 'npm run build',
      output_dir = 'dist',
      root_domain = '',
      subdomain_pattern = 'site-{index}',
    } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project Name is required' });
    }

    const id = 'proj_' + Math.random().toString(36).substring(2, 11);
    const cleanName = name.trim();
    const cleanRepo = (github_repo || '').trim();
    const cleanRootDomain = (root_domain || '').trim().toLowerCase().replace(/^https?:\/\//, '');

    // Fetch commit info if repo provided
    let commit = { sha: '', message: '' };
    if (cleanRepo) {
      commit = await fetchGitHubRepoDetails(cleanRepo, github_branch, github_token);
    }

    const result = await pool.query(
      `INSERT INTO cf_projects 
       (id, name, description, github_repo, github_branch, github_token, build_command, output_dir, root_domain, subdomain_pattern, latest_commit_sha, latest_commit_message, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        id,
        cleanName,
        description.trim(),
        cleanRepo,
        (github_branch || 'main').trim(),
        github_token || '',
        build_command.trim(),
        output_dir.trim(),
        cleanRootDomain,
        subdomain_pattern,
        commit.sha,
        commit.message,
        cleanRepo ? 'idle' : 'created',
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Error creating project:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/scan-repo - Standalone or project repository scanner
app.post('/api/projects/scan-repo', requireAuth, async (req, res) => {
  try {
    const { github_repo, github_branch = 'main', github_token } = req.body || {};
    if (!github_repo || !github_repo.trim()) {
      return res.status(400).json({ error: 'GitHub repository URL is required' });
    }

    const scanResult = await scanRepository(github_repo.trim(), github_branch.trim(), github_token);
    res.json(scanResult);
  } catch (err: any) {
    console.error('Scan error:', err);
    res.status(500).json({ error: err.message || 'Repository scan failed' });
  }
});

// POST /api/projects/:id/scan-repo - Scan and attach report to existing project
app.post('/api/projects/:id/scan-repo', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { github_repo, github_branch = 'main', github_token, root_domain } = req.body || {};

    if (!github_repo || !github_repo.trim()) {
      return res.status(400).json({ error: 'GitHub repository URL is required' });
    }

    const scanResult = await scanRepository(github_repo.trim(), github_branch.trim(), github_token);

    // Check if project has env_vars already, if not seed with scanResult defaults
    const currentProjRes = await pool.query('SELECT env_vars FROM cf_projects WHERE id = $1', [id]);
    let envVarsToSave = currentProjRes.rows[0]?.env_vars;
    if (!envVarsToSave || Object.keys(envVarsToSave).length === 0) {
      envVarsToSave = scanResult.detected_env_defaults || {};
    }

    // Update project with scanned parameters
    const updateRes = await pool.query(
      `UPDATE cf_projects 
       SET github_repo = $1,
           github_branch = $2,
           github_token = COALESCE($3, github_token),
           build_command = COALESCE($4, build_command),
           output_dir = COALESCE($5, output_dir),
           root_domain = CASE WHEN $6 <> '' THEN $6 ELSE root_domain END,
           latest_commit_sha = $7,
           latest_commit_message = $8,
           status = 'idle',
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        github_repo.trim(),
        github_branch.trim(),
        github_token || '',
        scanResult.recommended_build_command,
        scanResult.recommended_output_dir,
        (root_domain || '').trim().toLowerCase().replace(/^https?:\/\//, ''),
        scanResult.commit_sha,
        scanResult.commit_message,
        id,
      ]
    );

    const updatedProject = {
      ...updateRes.rows[0],
      env_vars: envVarsToSave,
      scan_report: scanResult,
    };

    res.json({
      project: updatedProject,
      scan_report: scanResult,
    });
  } catch (err: any) {
    console.error('Project scan error:', err);
    res.status(500).json({ error: err.message || 'Repository scan failed' });
  }
});

// GET /api/projects/:id - Get project with accounts and deployments
app.get('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const projectRes = await pool.query('SELECT * FROM cf_projects WHERE id = $1', [id]);
    if (projectRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const accountsRes = await pool.query(
      `SELECT a.*, 
        d.id as deployment_id,
        d.cf_pages_project_name,
        d.pages_dev_domain,
        d.custom_domain,
        d.cname_host,
        d.cname_target,
        d.dns_status,
        d.build_status,
        d.progress_percent,
        d.current_step,
        d.commit_hash,
        d.commit_message,
        d.deployed_at,
        d.error_message,
        d.logs
      FROM cf_accounts a
      LEFT JOIN cf_deployments d ON d.account_id = a.id AND d.project_id = a.project_id
      WHERE a.project_id = $1
      ORDER BY a.created_at ASC`,
      [id]
    );

    res.json({
      project: projectRes.rows[0],
      accounts: accountsRes.rows,
      is_building: isProjectBuilding(id),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/projects/:id - Update project configuration
app.put('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      github_repo,
      github_branch,
      github_token,
      build_command,
      output_dir,
      root_domain,
      subdomain_pattern,
      env_vars,
      scan_report,
    } = req.body;

    const result = await pool.query(
      `UPDATE cf_projects 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           github_repo = COALESCE($3, github_repo),
           github_branch = COALESCE($4, github_branch),
           github_token = COALESCE($5, github_token),
           build_command = COALESCE($6, build_command),
           output_dir = COALESCE($7, output_dir),
           root_domain = COALESCE($8, root_domain),
           subdomain_pattern = COALESCE($9, subdomain_pattern),
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        name,
        description,
        github_repo,
        github_branch,
        github_token,
        build_command,
        output_dir,
        root_domain,
        subdomain_pattern,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updated = {
      ...result.rows[0],
      env_vars: env_vars !== undefined ? env_vars : result.rows[0].env_vars,
      scan_report: scan_report !== undefined ? scan_report : result.rows[0].scan_report,
    };

    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/projects/:id - Delete project
app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM cf_projects WHERE id = $1', [id]);
    res.json({ success: true, message: 'Project and all associated data deleted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/build - Trigger bulk build for all accounts in project
app.post('/api/projects/:id/build', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { accountIds } = req.body || {};

    if (isProjectBuilding(id)) {
      return res.status(409).json({ error: 'A build is already running for this project.' });
    }

    // Launch build asynchronously in background
    runBulkBuild({ projectId: id, accountIds }).catch((err) => {
      console.error(`Build execution error for project ${id}:`, err);
    });

    res.json({ success: true, message: 'Bulk build started' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/cancel - Cancel active build or reset stuck state
app.post('/api/projects/:id/cancel', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    cancelProjectBuild(id);

    await pool.query(
      `UPDATE cf_deployments 
       SET build_status = 'failed', 
           current_step = 'Canceled by user', 
           error_message = 'Build was canceled by user.' 
       WHERE project_id = $1 AND build_status IN ('building', 'queued')`,
      [id]
    );

    await pool.query(
      `UPDATE cf_projects 
       SET status = 'idle' 
       WHERE id = $1 AND status = 'building'`,
      [id]
    );

    res.json({ success: true, message: 'Build canceled successfully' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/test-accounts - Test all accounts in project concurrently
app.post('/api/projects/:id/test-accounts', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const accsRes = await pool.query(
      'SELECT id, account_id, api_token, alias FROM cf_accounts WHERE project_id = $1 ORDER BY created_at ASC',
      [id]
    );

    const accounts = accsRes.rows;
    if (accounts.length === 0) {
      return res.json({ results: {}, summary: { total: 0, valid: 0, invalid: 0 } });
    }

    const results: Record<string, { valid: boolean; message: string; alias: string }> = {};

    // Run verification with concurrency limit 3
    await runWithConcurrency(accounts, 3, async (acc: any) => {
      const res = await verifyCloudflareCredentials(acc.account_id, acc.api_token);
      results[acc.id] = {
        valid: res.valid,
        message: res.valid
          ? `Connected (${res.tokenStatus})`
          : (res.error || 'Verification failed'),
        alias: acc.alias,
      };
    });

    const total = accounts.length;
    const valid = Object.values(results).filter((r) => r.valid).length;
    const invalid = total - valid;

    res.json({
      results,
      summary: { total, valid, invalid },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/projects/:id/status - Lightweight live build progress status
app.get('/api/projects/:id/status', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const projectRes = await pool.query(
      'SELECT id, status, latest_commit_sha, latest_commit_message, updated_at FROM cf_projects WHERE id = $1',
      [id]
    );

    if (projectRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const deploymentsRes = await pool.query(
      `SELECT account_id, id as deployment_id, build_status, progress_percent, current_step, error_message, updated_at, pages_dev_domain, custom_domain, logs
       FROM cf_deployments 
       WHERE project_id = $1`,
      [id]
    );

    res.json({
      project: projectRes.rows[0],
      is_building: isProjectBuilding(id),
      deployments: deploymentsRes.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/accounts - Bulk or single account add
app.post('/api/projects/:id/accounts', requireAuth, async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { accounts } = req.body;

    if (!Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ error: 'Accounts array is required' });
    }

    const projectRes = await pool.query('SELECT * FROM cf_projects WHERE id = $1', [projectId]);
    if (projectRes.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = projectRes.rows[0];

    // Fetch existing subdomains for this project to prevent collisions
    const existingSubsRes = await pool.query('SELECT subdomain FROM cf_accounts WHERE project_id = $1', [projectId]);
    const usedSubdomains = new Set<string>(existingSubsRes.rows.map((r: any) => (r.subdomain || '').toLowerCase()));

    const inserted: any[] = [];
    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      const accountId = 'acc_' + Math.random().toString(36).substring(2, 11);
      const alias = acc.alias || `CF Account ${i + 1}`;
      const cfAccountId = (acc.account_id || acc.accountId || '').trim();
      const apiToken = (acc.api_token || acc.apiToken || '').trim();
      const email = (acc.email || '').trim();

      let subdomain = (acc.subdomain || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/^-+|-+$/g, '');
      if (!subdomain) {
        const fallbackPrefix = alias.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8);
        subdomain = fallbackPrefix ? `app-${fallbackPrefix}` : `site-${i + 1}`;
      }

      // Ensure uniqueness
      let candidateSubdomain = subdomain;
      let counter = 1;
      while (usedSubdomains.has(candidateSubdomain)) {
        candidateSubdomain = `${subdomain}-${counter++}`;
      }
      subdomain = candidateSubdomain;
      usedSubdomains.add(subdomain);

      const accRes = await pool.query(
        `INSERT INTO cf_accounts (id, project_id, alias, account_id, api_token, email, subdomain)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [accountId, projectId, alias, cfAccountId, apiToken, email, subdomain]
      );

      const sanitizedPagesName = sanitizePagesProjectName(project.name, subdomain);

      const targetPagesDev = `${sanitizedPagesName}.pages.dev`;
      const targetCustom = `${subdomain}.${project.root_domain}`;

      // Initialize deployment record
      const depId = 'dep_' + Math.random().toString(36).substring(2, 11);
      await pool.query(
        `INSERT INTO cf_deployments 
        (id, project_id, account_id, cf_pages_project_name, pages_dev_domain, custom_domain, cname_host, cname_target, dns_status, build_status, progress_percent, current_step, logs)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 'idle', 0, 'Ready to build', '')`,
        [
          depId,
          projectId,
          accountId,
          sanitizedPagesName,
          `https://${targetPagesDev}`,
          `https://${targetCustom}`,
          subdomain,
          targetPagesDev,
        ]
      );

      inserted.push(accRes.rows[0]);
    }

    res.status(201).json({ count: inserted.length, accounts: inserted });
  } catch (err: any) {
    console.error('Error adding accounts:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cloudflare/verify - Live test of Cloudflare API Token & Account ID
app.post('/api/cloudflare/verify', requireAuth, async (req, res) => {
  try {
    const { account_id, api_token } = req.body || {};
    const result = await verifyCloudflareCredentials(account_id, api_token);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

// POST /api/accounts/:id/test - Test an existing account's credentials against Cloudflare API
app.post('/api/accounts/:id/test', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const accRes = await pool.query('SELECT account_id, api_token, alias FROM cf_accounts WHERE id = $1', [id]);
    if (accRes.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }
    const { account_id, api_token, alias } = accRes.rows[0];
    const result = await verifyCloudflareCredentials(account_id, api_token);
    res.json({ ...result, alias });
  } catch (err: any) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

// DELETE /api/accounts/:id - Remove account
app.delete('/api/accounts/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM cf_accounts WHERE id = $1', [id]);
    res.json({ success: true, message: 'Account removed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/projects/:id/accounts/bulk-delete - Remove multiple accounts
app.post('/api/projects/:id/accounts/bulk-delete', requireAuth, async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { account_ids } = req.body;
    if (!Array.isArray(account_ids) || account_ids.length === 0) {
      return res.status(400).json({ error: 'account_ids array is required' });
    }
    await pool.query('DELETE FROM cf_accounts WHERE project_id = $1 AND id = ANY($2)', [
      projectId,
      account_ids,
    ]);
    res.json({ success: true, count: account_ids.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/deployments/:id - View deployment, domain links, and DNS info
app.get('/api/deployments/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT d.*, 
              p.name as project_name, p.root_domain, p.github_repo, p.github_branch,
              a.alias as account_alias, a.account_id as cf_account_id, a.subdomain
       FROM cf_deployments d
       JOIN cf_projects p ON p.id = d.project_id
       JOIN cf_accounts a ON a.id = d.account_id
       WHERE d.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deployment not found' });
    }

    const dep = result.rows[0];
    const dnsRecord = {
      type: 'CNAME',
      name: dep.cname_host,
      content: dep.cname_target,
      ttl: 'Auto',
      proxied: true,
      full_domain: `${dep.cname_host}.${dep.root_domain}`,
      bind_format: `${dep.cname_host}.${dep.root_domain}. 300 IN CNAME ${dep.cname_target}.`,
    };

    res.json({
      deployment: dep,
      dns: dnsRecord,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/deployments/:id/rebuild - Rebuild single deployment (supports deployment ID or account ID)
app.post('/api/deployments/:id/rebuild', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    let depRes = await pool.query('SELECT project_id, account_id FROM cf_deployments WHERE id = $1', [id]);
    if (depRes.rows.length === 0) {
      // Fallback: check if id is an account_id
      depRes = await pool.query('SELECT project_id, id as account_id FROM cf_accounts WHERE id = $1', [id]);
    }
    if (depRes.rows.length === 0) {
      return res.status(404).json({ error: 'Deployment or account not found' });
    }

    const { project_id, account_id } = depRes.rows[0];
    if (isProjectBuilding(project_id)) {
      return res.status(409).json({ error: 'A build is already running for this project.' });
    }

    runBulkBuild({ projectId: project_id, accountIds: [account_id] }).catch((err) => {
      console.error('Single rebuild error:', err);
    });

    res.json({ success: true, message: 'Rebuild initiated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/accounts/:id/build - Build single account directly
app.post('/api/accounts/:id/build', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const accRes = await pool.query('SELECT id, project_id FROM cf_accounts WHERE id = $1', [id]);
    if (accRes.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' });
    }

    const { project_id } = accRes.rows[0];
    if (isProjectBuilding(project_id)) {
      return res.status(409).json({ error: 'A build is already running for this project.' });
    }

    runBulkBuild({ projectId: project_id, accountIds: [id] }).catch((err) => {
      console.error('Account build error:', err);
    });

    res.json({ success: true, message: 'Account build initiated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
async function startServer() {
  try {
    await initDb();
    // Clean up any stale builds left over from unexpected process termination
    await pool.query(`UPDATE cf_projects SET status = 'idle' WHERE status = 'building'`);
    await pool.query(`
      UPDATE cf_deployments 
      SET build_status = 'failed', 
          current_step = 'Server restarted', 
          error_message = 'Build process interrupted by server restart. Click rebuild to retry.' 
      WHERE build_status IN ('building', 'queued')
    `);
  } catch (err: any) {
    console.warn('[DB Warning] Initial DB setup connection issue:', err?.message || err);
  }

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[Server] Cloudflare Bulk Pages Builder running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Error]', err);
  process.exit(1);
});

