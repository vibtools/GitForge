import pg from 'pg';
const { Pool } = pg;

const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_n4cz9yJKfEhN@ep-late-pine-b3reqzi8-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function initDb() {
  const client = await pool.connect();
  try {
    // Projects table
    await client.query(`
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
    `);

    // Cloudflare Accounts table
    await client.query(`
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
    `);

    // Deployments table
    await client.query(`
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
    `);

    // App Users table for secure authentication
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_users (
        id VARCHAR(64) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        salt VARCHAR(64) NOT NULL,
        name VARCHAR(128) NOT NULL,
        role VARCHAR(32) DEFAULT 'admin',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure role column exists if app_users already existed
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='app_users' AND column_name='role'
        ) THEN
          ALTER TABLE app_users ADD COLUMN role VARCHAR(32) DEFAULT 'admin';
        END IF;
      END $$;
    `);

    // App Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_sessions (
        token VARCHAR(128) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // App System Settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key VARCHAR(64) PRIMARY KEY,
        value TEXT NOT NULL,
        description TEXT,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Seed default settings if empty
    await client.query(`
      INSERT INTO app_settings (key, value, description)
      VALUES 
        ('concurrency_limit', '3', 'Maximum concurrent build tasks across all accounts'),
        ('build_timeout_sec', '600', 'Maximum build runtime before timeout (seconds)'),
        ('maintenance_mode', 'false', 'Global system maintenance mode toggle'),
        ('default_branch', 'main', 'Default Git branch for newly created projects'),
        ('webhook_url', '', 'Webhook URL for deployment alerts (Slack/Discord/Custom)'),
        ('alert_on_failure', 'true', 'Send alerts when a deployment fails'),
        ('auto_dns_check', 'true', 'Automatically verify DNS status on deployment finish'),
        ('site_name', 'GitForge', 'Public platform brand name'),
        ('site_tagline', 'Multi-Account Cloudflare Pages Fleet Orchestrator', 'Public platform subtitle and punchline'),
        ('site_description', 'High-Performance Git Repository Multi-Account Cloudflare Pages Deployment Orchestrator & vCon Forensic Command Console', 'Global meta description for SEO'),
        ('site_logo_url', '', 'Custom logo image URL or SVG graphic'),
        ('site_favicon_url', '', 'Custom favicon image URL (.ico, .png, .svg)'),
        ('site_primary_color', '#ea580c', 'Primary brand accent color hex'),
        ('site_footer_text', 'GitForge — Multi-Account Cloudflare Pages Fleet Orchestrator', 'Footer copyright and platform designation'),
        ('site_support_email', 'support@gitforge.dev', 'Platform customer and technical support contact'),
        ('site_support_url', '', 'External documentation or support portal URL'),
        ('allow_public_registration', 'true', 'Allow public self-service user registration'),
        ('maintenance_banner', '', 'Announcement banner shown across the top of the site'),
        ('s3_access_key_id', '', 'Backblaze S3 Key ID (keyID)'),
        ('s3_secret_access_key', '', 'Backblaze S3 Secret Access Key (applicationKey)'),
        ('s3_bucket_name', 'gitforgedev', 'Backblaze S3 Bucket Name'),
        ('s3_endpoint', 'https://s3.us-west-004.backblazeb2.com', 'Backblaze S3 Endpoint'),
        ('s3_region', 'us-west-004', 'Backblaze S3 Region')
      ON CONFLICT (key) DO NOTHING;
    `);

    // App Storage Files table for tracking files saved in S3
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_storage_files (
        id VARCHAR(64) PRIMARY KEY,
        file_name VARCHAR(255) NOT NULL,
        s3_key VARCHAR(512) NOT NULL,
        size_bytes BIGINT DEFAULT 0,
        content_type VARCHAR(128) DEFAULT 'application/octet-stream',
        uploaded_by VARCHAR(255) DEFAULT 'system',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // App Audit Logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        user_email VARCHAR(255) NOT NULL,
        action VARCHAR(128) NOT NULL,
        details JSONB,
        ip_address VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // High-performance indexes for fast lookups and instantaneous joins
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_cf_accounts_project_id ON cf_accounts(project_id);
      CREATE INDEX IF NOT EXISTS idx_cf_deployments_project_id ON cf_deployments(project_id);
      CREATE INDEX IF NOT EXISTS idx_cf_deployments_account_id ON cf_deployments(account_id);
      CREATE INDEX IF NOT EXISTS idx_cf_deployments_build_status ON cf_deployments(build_status);
      CREATE INDEX IF NOT EXISTS idx_cf_deployments_proj_status ON cf_deployments(project_id, build_status);
      CREATE INDEX IF NOT EXISTS idx_app_sessions_token_expires ON app_sessions(token, expires_at);
      CREATE INDEX IF NOT EXISTS idx_app_users_role ON app_users(role);
      CREATE INDEX IF NOT EXISTS idx_app_audit_logs_created_at ON app_audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_app_audit_logs_action ON app_audit_logs(action);
    `);

    // Reset any deployments and projects that were interrupted by a server restart
    await client.query(`
      UPDATE cf_deployments 
      SET build_status = 'failed', 
          current_step = 'Build interrupted by server restart',
          error_message = 'Build process was interrupted by server restart.'
      WHERE build_status IN ('building', 'queued');

      UPDATE cf_projects
      SET status = 'partial_error'
      WHERE status = 'building';
    `);

    // Clean up any old mock/fake data if previously seeded
    await client.query(`
      DELETE FROM cf_projects WHERE id = 'proj_starter_alpha';
      DELETE FROM cf_accounts WHERE alias LIKE '%demo%' OR alias LIKE '%Sample%' OR account_id LIKE 'cf_sg_%' OR account_id LIKE 'cf_us_%';
    `);

    console.log('[DB] Neon PostgreSQL schema initialized with real auth & tables.');
  } catch (err) {
    console.error('[DB] Error during table initialization:', err);
    throw err;
  } finally {
    client.release();
  }
}

export async function logAudit(userEmail: string, action: string, details: any = {}, ipAddress?: string) {
  try {
    const id = 'log_' + Math.random().toString(36).substring(2, 12);
    await pool.query(
      `INSERT INTO app_audit_logs (id, user_email, action, details, ip_address) VALUES ($1, $2, $3, $4, $5)`,
      [id, userEmail || 'system', action, JSON.stringify(details), ipAddress || 'internal']
    );
  } catch (err) {
    console.error('[Audit Log Error]', err);
  }
}
