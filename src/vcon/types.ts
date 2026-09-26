export interface AdminOverview {
  counters: {
    total_projects: number;
    total_accounts: number;
    total_deployments: number;
    success_deployments: number;
    failed_deployments: number;
    building_deployments: number;
    total_users: number;
    active_sessions: number;
  };
  active_builds: number;
  system: {
    uptime_sec: number;
    platform: string;
    cpus: number;
    memory_used_mb: number;
    memory_total_mb: number;
    memory_percent: number;
    node_version: string;
    process_uptime_sec: number;
  };
  db: {
    status: string;
    latency_ms: number;
    neon_time: string;
  };
  maintenance_mode: boolean;
  concurrency_limit: number;
  recent_audit_logs: AuditLog[];
}

export interface AdminSetting {
  key: string;
  value: string;
  description?: string;
  updated_at?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'operator';
  created_at: string;
  active_sessions: number;
  last_login?: string;
}

export interface AdminSession {
  token: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
  created_at: string;
  expires_at: string;
}

export interface AdminProject {
  id: string;
  name: string;
  description: string;
  github_repo: string;
  github_branch: string;
  github_token?: string;
  build_command: string;
  output_dir: string;
  root_domain: string;
  subdomain_pattern: string;
  latest_commit_sha?: string;
  latest_commit_message?: string;
  status: string;
  created_at: string;
  updated_at: string;
  account_count: number;
  success_count: number;
  failed_count: number;
  building_count: number;
  is_building: boolean;
}

export interface AdminAccount {
  id: string;
  project_id: string;
  project_name: string;
  root_domain: string;
  github_repo: string;
  alias: string;
  account_id: string;
  api_token: string;
  masked_token?: string;
  email?: string;
  subdomain: string;
  created_at: string;
  deployment_id?: string;
  build_status?: string;
  pages_dev_domain?: string;
  custom_domain?: string;
  error_message?: string;
  dns_status?: string;
}

export interface AdminDeployment {
  id: string;
  project_id: string;
  project_name: string;
  root_domain: string;
  github_repo: string;
  account_id: string;
  account_alias: string;
  cf_account_id: string;
  subdomain: string;
  cf_pages_project_name: string;
  pages_dev_domain?: string;
  custom_domain?: string;
  cname_host?: string;
  cname_target?: string;
  dns_status?: string;
  build_status: string;
  progress_percent: number;
  current_step: string;
  logs?: string;
  commit_hash?: string;
  commit_message?: string;
  error_message?: string;
  deployed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DbStats {
  status: string;
  provider: string;
  exact_counts: {
    cf_projects: number;
    cf_accounts: number;
    cf_deployments: number;
    app_users: number;
    app_sessions: number;
    app_audit_logs: number;
  };
  stat_tables: Array<{
    table_name: string;
    row_estimate: number;
  }>;
  connection_pool: {
    total_count: number;
    idle_count: number;
    waiting_count: number;
  };
}

export interface AuditLog {
  id: string;
  user_email: string;
  action: string;
  details: any;
  ip_address: string;
  created_at: string;
}

export interface SiteSettings {
  site_name: string;
  site_tagline: string;
  site_description: string;
  site_logo_url: string;
  site_favicon_url: string;
  site_primary_color: string;
  site_footer_text: string;
  site_support_email: string;
  site_support_url: string;
  allow_public_registration: boolean;
  maintenance_mode: boolean;
  maintenance_banner: string;
}

export interface StorageConfig {
  s3_access_key_id: string;
  s3_secret_access_key?: string;
  s3_bucket_name: string;
  s3_endpoint: string;
  s3_region: string;
  has_secret_key?: boolean;
  masked_secret_key?: string;
}

export interface StorageReport {
  connected: boolean;
  bucket: string;
  endpoint: string;
  region: string;
  latency_ms: number;
  total_objects: number;
  total_size_bytes: number;
  total_size_formatted: string;
  last_sync: string;
  objects: Array<{
    key: string;
    size: number;
    size_formatted: string;
    last_modified: string;
    etag?: string;
  }>;
  error?: string;
}

export type VconTab =
  | 'overview'
  | 'projects'
  | 'accounts'
  | 'deployments'
  | 'users'
  | 'site_settings'
  | 'storage'
  | 'settings'
  | 'database'
  | 'audit';
