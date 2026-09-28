import {
  AdminOverview,
  AdminSetting,
  AdminUser,
  AdminSession,
  AdminProject,
  AdminAccount,
  AdminDeployment,
  DbStats,
  AuditLog,
  SiteSettings,
  StorageConfig,
  StorageReport,
} from './types';

function getHeaders(): HeadersInit {
  const token = localStorage.getItem('cf_bulk_token') || '';
  return {
    'Content-Type': 'application/json',
    Authorization: token ? `Bearer ${token}` : '',
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const errorMsg = data.error || (res.status === 401 ? 'Invalid credentials or session expired.' : `HTTP ${res.status}: ${res.statusText}`);
    throw new Error(errorMsg);
  }
  return data as T;
}

export const vconApi = {
  // Admin Authentication & Setup
  async getAuthStatus(): Promise<{ has_admin: boolean; is_admin: boolean; user: AdminUser | null }> {
    const res = await fetch('/api/admin/auth/status', { headers: getHeaders() });
    return handleResponse(res);
  },

  async setupMasterAdmin(payload: { email: string; password: string; name?: string }): Promise<{ success: boolean; token: string; user: AdminUser }> {
    const res = await fetch('/api/admin/auth/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async loginAdmin(payload: { email: string; password: string }): Promise<{ success: boolean; token: string; user: AdminUser }> {
    const res = await fetch('/api/admin/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  // Overview
  async getOverview(): Promise<AdminOverview> {
    const res = await fetch('/api/admin/overview', { headers: getHeaders() });
    return handleResponse<AdminOverview>(res);
  },

  async emergencyAbort(): Promise<{ success: boolean; message: string; canceled_workers: number; affected_deployments: number }> {
    const res = await fetch('/api/admin/emergency-abort', {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Settings
  async getSettings(): Promise<AdminSetting[]> {
    const res = await fetch('/api/admin/settings', { headers: getHeaders() });
    return handleResponse<AdminSetting[]>(res);
  },

  async updateSettings(settings: Record<string, any>): Promise<{ success: boolean; settings: AdminSetting[] }> {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ settings }),
    });
    return handleResponse(res);
  },

  // Site Settings (Public & Global Customization)
  async getSiteSettings(): Promise<SiteSettings> {
    const res = await fetch('/api/admin/site-settings', { headers: getHeaders() });
    return handleResponse<SiteSettings>(res);
  },

  async updateSiteSettings(payload: Partial<SiteSettings>): Promise<{ success: boolean; message: string; site_settings: SiteSettings }> {
    const res = await fetch('/api/admin/site-settings', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async testWebhook(webhookUrl: string): Promise<{ success: boolean; status: number; statusText: string }> {
    const res = await fetch('/api/admin/test-webhook', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ webhook_url: webhookUrl }),
    });
    return handleResponse(res);
  },

  // Users
  async getUsers(): Promise<AdminUser[]> {
    const res = await fetch('/api/admin/users', { headers: getHeaders() });
    return handleResponse<AdminUser[]>(res);
  },

  async createUser(payload: { email: string; password: string; name: string; role?: string }): Promise<{ success: boolean; user: AdminUser }> {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async updateUser(id: string, payload: { name?: string; role?: string; password?: string }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async deleteUser(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Sessions
  async getSessions(): Promise<AdminSession[]> {
    const res = await fetch('/api/admin/sessions', { headers: getHeaders() });
    return handleResponse<AdminSession[]>(res);
  },

  async revokeSession(token: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/sessions/${encodeURIComponent(token)}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Projects
  async getProjects(): Promise<AdminProject[]> {
    const res = await fetch('/api/admin/projects', { headers: getHeaders() });
    return handleResponse<AdminProject[]>(res);
  },

  async updateProject(id: string, payload: Partial<AdminProject>): Promise<AdminProject> {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<AdminProject>(res);
  },

  async deleteProject(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/projects/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async syncRepoCommit(id: string): Promise<{ success: boolean; project: AdminProject; commit: any }> {
    const res = await fetch(`/api/admin/projects/${id}/sync-repo`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async triggerProjectBuild(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/projects/${id}/build`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async cancelProjectBuild(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/projects/${id}/cancel`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Accounts
  async getAccounts(): Promise<AdminAccount[]> {
    const res = await fetch('/api/admin/accounts', { headers: getHeaders() });
    return handleResponse<AdminAccount[]>(res);
  },

  async verifyCloudflareToken(account_id: string, api_token: string): Promise<{ valid: boolean; accountName?: string; error?: string }> {
    const res = await fetch('/api/admin/accounts/verify-token', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ account_id, api_token }),
    });
    return handleResponse(res);
  },

  async updateAccount(id: string, payload: { alias?: string; account_id?: string; api_token?: string; subdomain?: string; email?: string }): Promise<{ success: boolean }> {
    const res = await fetch(`/api/admin/accounts/${id}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async deleteAccount(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/accounts/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Deployments
  async getDeployments(params?: { status?: string; project_id?: string; limit?: number }): Promise<AdminDeployment[]> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.project_id) searchParams.set('project_id', params.project_id);
    if (params?.limit) searchParams.set('limit', String(params.limit));

    const res = await fetch(`/api/admin/deployments?${searchParams.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse<AdminDeployment[]>(res);
  },

  async retryDeployment(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/deployments/${id}/rebuild`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async forceCancelDeployment(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/deployments/${id}/force-cancel`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async deleteDeployment(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/deployments/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Database & Diagnostics
  async getDbStats(): Promise<DbStats> {
    const res = await fetch('/api/admin/db-stats', { headers: getHeaders() });
    return handleResponse<DbStats>(res);
  },

  async runDbCleanup(): Promise<{ success: boolean; message: string; expired_sessions_cleared: number; orphaned_builds_reset: number }> {
    const res = await fetch('/api/admin/db-cleanup', {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Audit Logs
  async getAuditLogs(action?: string, limit?: number): Promise<AuditLog[]> {
    const searchParams = new URLSearchParams();
    if (action) searchParams.set('action', action);
    if (limit) searchParams.set('limit', String(limit));

    const res = await fetch(`/api/admin/audit-logs?${searchParams.toString()}`, {
      headers: getHeaders(),
    });
    return handleResponse<AuditLog[]>(res);
  },

  // Storage (Backblaze B2 / S3)
  async getStorageConfig(): Promise<StorageConfig> {
    const res = await fetch('/api/admin/storage/config', { headers: getHeaders() });
    return handleResponse<StorageConfig>(res);
  },

  async updateStorageConfig(payload: StorageConfig): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/admin/storage/config', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async testStorageConnection(customCreds?: Partial<StorageConfig>): Promise<{
    success: boolean;
    latency_ms: number;
    bucket: string;
    endpoint: string;
    region: string;
    error?: string;
    message?: string;
  }> {
    const res = await fetch('/api/admin/storage/test-connection', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(customCreds || {}),
    });
    return handleResponse(res);
  },

  async getStorageReport(): Promise<StorageReport> {
    const res = await fetch('/api/admin/storage/report', { headers: getHeaders() });
    return handleResponse<StorageReport>(res);
  },

  async uploadTestStorageFile(payload: { fileName?: string; content?: string; contentType?: string; isBase64?: boolean }): Promise<{
    success: boolean;
    key: string;
    size: number;
    file_url: string;
    message: string;
  }> {
    const res = await fetch('/api/admin/storage/upload-test', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async uploadStorageFile(file: File): Promise<{
    success: boolean;
    key: string;
    size: number;
    file_url: string;
    message: string;
  }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const resultStr = reader.result as string;
          const base64Data = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
          const res = await fetch('/api/admin/storage/upload-test', {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({
              fileName: file.name,
              content: base64Data,
              contentType: file.type || 'application/octet-stream',
              isBase64: true,
            }),
          });
          const data = await handleResponse<any>(res);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  },

  async generateStoragePresignedUrl(fileName: string, expiresInSeconds = 3600): Promise<{
    success: boolean;
    fileName: string;
    signedUrl: string;
    expiresInSeconds: number;
    access_route: string;
  }> {
    const res = await fetch('/api/admin/storage/presigned-url', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ fileName, expiresInSeconds }),
    });
    return handleResponse(res);
  },

  async deleteStorageObject(fileName: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/admin/storage/objects', {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify({ fileName }),
    });
    return handleResponse(res);
  },

  // Test Cloudflare OAuth credentials
  async testCloudflareOAuth(payload: { client_id: string; client_secret: string }): Promise<{ valid: boolean; message: string; error?: string }> {
    const res = await fetch('/api/admin/cloudflare/oauth/test', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },
};
