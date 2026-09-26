import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Save,
  Bell,
  RefreshCw,
  Send,
  ShieldAlert,
  Cpu,
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
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingWebhook, setTestingWebhook] = useState(false);

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
