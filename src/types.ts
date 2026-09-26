export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Project {
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
  status: 'created' | 'idle' | 'building' | 'completed' | 'partial_error';
  created_at: string;
  updated_at: string;
  account_count?: number;
  successful_deployments?: number;
}

export interface Account {
  id: string;
  project_id: string;
  alias: string;
  account_id: string;
  api_token: string;
  email?: string;
  subdomain: string;
  created_at: string;
  deployment_id?: string;
  cf_pages_project_name?: string;
  pages_dev_domain?: string;
  custom_domain?: string;
  cname_host?: string;
  cname_target?: string;
  dns_status?: 'pending' | 'configured' | 'verified';
  build_status?: 'idle' | 'queued' | 'building' | 'success' | 'failed';
  progress_percent?: number;
  current_step?: string;
  commit_hash?: string;
  commit_message?: string;
  deployed_at?: string;
  error_message?: string;
  logs?: string;
}

export interface DnsRecord {
  type: string;
  name: string;
  content: string;
  ttl: string;
  proxied: boolean;
  full_domain: string;
  bind_format: string;
}

export interface DeploymentViewData {
  deployment: Account & {
    project_name: string;
    root_domain: string;
    github_repo: string;
    github_branch: string;
    cf_account_id: string;
    error_message?: string;
  };
  dns: DnsRecord;
}
