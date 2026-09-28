import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Save,
  Bell,
  RefreshCw,
  Send,
  ShieldAlert,
  Cpu,
  Cloud,
  KeyRound,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { vconApi } from '../api';

interface VconSettingsControlProps {
  onNotify: (msg: string, isError?: boolean) => void;
}

export const VconSettingsControl: React.FC<VconSettingsControlProps> = ({ onNotify }) => {
  const [settings, setSettings] = useState<Record<string, string>>({
    concurrency_limit: '3',
    build_timeout_sec: '600',
    maintenance_mode: 'false',
    default_branch: 'main',
    webhook_url: '',
    alert_on_failure: 'true',
    auto_dns_check: 'true',
    cf_oauth_client_id: '',
    cf_oauth_client_secret: '',
    cf_oauth_scopes: 'account:read pages:edit dns:edit',
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);
  const [testingOAuth, setTestingOAuth] = useState(false);
  const [showOAuthSecret, setShowOAuthSecret] = useState(false);
  const [oauthTestResult, setOauthTestResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [copiedCallback, setCopiedCallback] = useState(false);

  const callbackUrl = `${window.location.origin}/api/auth/cloudflare/callback`;

  const loadSettings = async () => {
    try {
      setLoading(true);
      const rows = await vconApi.getSettings();
      const map: Record<string, string> = {};
      for (const row of rows) {
        map[row.key] = row.value;
      }
      setSettings((prev) => ({ ...prev, ...map }));
    } catch (err: any) {
      onNotify(err.message || 'Failed to load settings', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await vconApi.updateSettings(settings);
      onNotify('Settings saved.');
    } catch (err: any) {
      onNotify(err.message || 'Save failed', true);
    } finally {
      setSaving(false);
    }
  };

  const handleCopyCallback = () => {
    navigator.clipboard.writeText(callbackUrl);
    setCopiedCallback(true);
    setTimeout(() => setCopiedCallback(false), 2000);
    onNotify('Callback URL copied.');
  };

  const handleTestOAuth = async () => {
    if (!settings.cf_oauth_client_id || !settings.cf_oauth_client_secret) {
      onNotify('Enter both Client ID and Client Secret to test connection.', true);
      return;
    }
    setOauthTestResult(null);
    try {
      setTestingOAuth(true);
      const res = await vconApi.testCloudflareOAuth({
        client_id: settings.cf_oauth_client_id.trim(),
        client_secret: settings.cf_oauth_client_secret.trim(),
      });
      if (res.valid) {
        setOauthTestResult({ valid: true, message: res.message });
        onNotify(res.message);
      } else {
        setOauthTestResult({ valid: false, message: res.error || 'Connection failed' });
        onNotify(res.error || 'Connection test failed', true);
      }
    } catch (err: any) {
      setOauthTestResult({ valid: false, message: err.message || 'Verification error' });
      onNotify(err.message || 'Verification error', true);
    } finally {
      setTestingOAuth(false);
    }
  };

  const handleTestWebhook = async () => {
    if (!settings.webhook_url) {
      onNotify('Enter a Webhook URL first.', true);
      return;
    }
    try {
      setTestingWebhook(true);
      const res = await vconApi.testWebhook(settings.webhook_url);
      if (res.success) {
        onNotify(`Webhook OK: HTTP ${res.status}`);
      } else {
        onNotify(`Webhook failed: HTTP ${res.status}`, true);
      }
    } catch (err: any) {
      onNotify(err.message || 'Webhook failed', true);
    } finally {
      setTestingWebhook(false);
    }
  };

  return (
    <div className="space-y-2.5 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800/80 px-3 py-1.5 rounded-lg text-xs">
        <div className="flex items-center gap-1.5">
          <Sliders className="w-3.5 h-3.5 text-orange-400/90" />
          <span className="font-semibold text-slate-200">System Settings</span>
        </div>

        <button
          onClick={loadSettings}
          disabled={loading}
          className="p-1 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded border border-slate-700/80 transition"
          title="Reload"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-orange-400' : ''}`} />
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-2.5 text-[11px]">
        {/* Worker Pool */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 space-y-2">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5 text-[11px]">
            <Cpu className="w-3 h-3 text-sky-400/90" />
            <span>Worker Concurrency & Timeout</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-slate-300 font-medium">Concurrency Limit</span>
                <span className="font-mono text-orange-400/90 font-medium">{settings.concurrency_limit} workers</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={settings.concurrency_limit || '3'}
                onChange={(e) => setSettings({ ...settings, concurrency_limit: e.target.value })}
                className="w-full accent-orange-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Timeout (Seconds)</label>
              <input
                type="number"
                min="60"
                max="3600"
                step="30"
                value={settings.build_timeout_sec || '600'}
                onChange={(e) => setSettings({ ...settings, build_timeout_sec: e.target.value })}
                className="bg-slate-950/80 border border-slate-800/80 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-[11px] w-28"
              />
            </div>
          </div>
        </div>

        {/* Policies */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 space-y-2">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5 text-[11px]">
            <ShieldAlert className="w-3 h-3 text-amber-400/90" />
            <span>Policies</span>
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="p-2 rounded bg-slate-950/60 border border-slate-800/70 flex items-center justify-between">
              <span className="font-medium text-slate-300">Maintenance Mode</span>
              <input
                type="checkbox"
                checked={settings.maintenance_mode === 'true'}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    maintenance_mode: e.target.checked ? 'true' : 'false',
                  })
                }
                className="w-3.5 h-3.5 accent-amber-500 cursor-pointer"
              />
            </div>

            <div className="p-2 rounded bg-slate-950/60 border border-slate-800/70 flex items-center justify-between">
              <span className="font-medium text-slate-300">Auto DNS Check</span>
              <input
                type="checkbox"
                checked={settings.auto_dns_check === 'true'}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    auto_dns_check: e.target.checked ? 'true' : 'false',
                  })
                }
                className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
              />
            </div>

            <div className="p-2 rounded bg-slate-950/60 border border-slate-800/70 flex items-center justify-between">
              <span className="font-medium text-slate-300">Failure Webhook Alert</span>
              <input
                type="checkbox"
                checked={settings.alert_on_failure === 'true'}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    alert_on_failure: e.target.checked ? 'true' : 'false',
                  })
                }
                className="w-3.5 h-3.5 accent-rose-500 cursor-pointer"
              />
            </div>

            <div className="p-2 rounded bg-slate-950/60 border border-slate-800/70 flex items-center justify-between">
              <span className="font-medium text-slate-300">Default Branch</span>
              <input
                type="text"
                value={settings.default_branch || 'main'}
                onChange={(e) => setSettings({ ...settings, default_branch: e.target.value })}
                className="bg-slate-900 border border-slate-800/80 rounded px-1.5 py-0.5 text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-[11px] w-24"
              />
            </div>
          </div>
        </div>

        {/* Cloudflare OAuth Application Configuration */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5 text-[11px]">
              <Cloud className="w-3.5 h-3.5 text-orange-400" />
              <span>Cloudflare Auth App Credentials (1-Click Connect)</span>
            </span>

            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800">
              OAuth 2.0
            </span>
          </div>

          <div className="space-y-2">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Cloudflare OAuth Client ID *
              </label>
              <input
                type="text"
                placeholder="e.g. 5d9f8b... or your Cloudflare OAuth client ID"
                value={settings.cf_oauth_client_id || ''}
                onChange={(e) => setSettings({ ...settings, cf_oauth_client_id: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-800/80 rounded p-1.5 text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-[11px]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-slate-300 font-medium">Cloudflare OAuth Client Secret *</label>
                <button
                  type="button"
                  onClick={() => setShowOAuthSecret(!showOAuthSecret)}
                  className="text-slate-500 hover:text-slate-300 text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  {showOAuthSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showOAuthSecret ? 'Hide' : 'Show'}</span>
                </button>
              </div>
              <input
                type={showOAuthSecret ? 'text' : 'password'}
                placeholder="Enter client secret generated from Cloudflare dashboard"
                value={settings.cf_oauth_client_secret || ''}
                onChange={(e) => setSettings({ ...settings, cf_oauth_client_secret: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-800/80 rounded p-1.5 text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block text-slate-400 text-[10px] mb-1">Authorized Callback / Redirect URI (Paste in Cloudflare OAuth App):</label>
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded p-1">
                <span className="flex-1 font-mono text-[10px] text-emerald-400 truncate px-1 select-all">
                  {callbackUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCallback}
                  className="px-2 py-0.5 text-[10px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {copiedCallback ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCallback ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestOAuth}
                  disabled={testingOAuth}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck className={`w-3.5 h-3.5 text-orange-400 ${testingOAuth ? 'animate-spin' : ''}`} />
                  <span>{testingOAuth ? 'Testing Credentials...' : 'Test Connection'}</span>
                </button>

                {oauthTestResult && (
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                      oauthTestResult.valid
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                        : 'bg-red-950/80 text-red-300 border-red-800'
                    }`}
                  >
                    {oauthTestResult.valid ? <Check className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                    <span>{oauthTestResult.message}</span>
                  </span>
                )}
              </div>

              <a
                href="https://dash.cloudflare.com/?to=/:account/api-tokens"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-slate-400 hover:text-orange-400 flex items-center gap-1 transition"
              >
                <span>Cloudflare Dashboard</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Webhooks */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 space-y-2">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5 text-[11px]">
            <Bell className="w-3 h-3 text-sky-400/90" />
            <span>Webhook URL</span>
          </span>

          <div className="flex items-center gap-1.5">
            <input
              type="url"
              placeholder="https://discord.com/api/webhooks/... or https://hooks.slack.com/..."
              value={settings.webhook_url || ''}
              onChange={(e) => setSettings({ ...settings, webhook_url: e.target.value })}
              className="flex-1 bg-slate-950/80 border border-slate-800/80 rounded p-1.5 text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-[11px]"
            />
            <button
              type="button"
              onClick={handleTestWebhook}
              disabled={testingWebhook}
              className="px-2.5 py-1.5 text-[11px] font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded transition flex items-center gap-1 shrink-0"
            >
              <Send className={`w-3 h-3 text-sky-400/90 ${testingWebhook ? 'animate-spin' : ''}`} />
              <span>Test</span>
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-0.5">
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1 text-[11px] font-medium text-white bg-orange-600/90 hover:bg-orange-600 rounded transition flex items-center gap-1 shadow-xs"
          >
            <Save className="w-3 h-3" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
