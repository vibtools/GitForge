import React, { useState } from 'react';
import {
  FolderGit2,
  Cloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  Cpu,
  Database,
  PowerOff,
  Wrench,
  Download,
  RefreshCw,
  Terminal,
} from 'lucide-react';
import { AdminOverview, VconTab } from '../types';

interface VconOverviewProps {
  overview: AdminOverview | null;
  onSelectTab: (tab: VconTab) => void;
  onEmergencyAbort: () => void;
  onToggleMaintenance: (enabled: boolean) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const VconOverview: React.FC<VconOverviewProps> = ({
  overview,
  onSelectTab,
  onEmergencyAbort,
  onToggleMaintenance,
  onRefresh,
  isLoading,
}) => {
  const [confirmAbort, setConfirmAbort] = useState(false);

  if (!overview) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-400 text-xs font-mono">
        <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5 text-orange-500" />
        Loading...
      </div>
    );
  }

  const { counters, system, db, maintenance_mode, active_builds, recent_audit_logs } = overview;
  const totalDeployments = counters.total_deployments || 1;
  const successRate = Math.round((counters.success_deployments / totalDeployments) * 100);

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d > 0 ? `${d}d ` : ''}${h}h ${m}m`;
  };

  return (
    <div className="space-y-2.5">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800/80 px-3 py-1.5 rounded-lg">
        <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/90"></span>
          <span>System Status</span>
        </span>

        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="px-2 py-0.5 text-slate-300 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded transition flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 text-orange-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <a
            href="/api/admin/export-system"
            download
            className="px-2 py-0.5 text-slate-300 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded transition flex items-center gap-1"
          >
            <Download className="w-3 h-3 text-sky-400" />
            <span>Backup</span>
          </a>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
        {/* Projects */}
        <div
          onClick={() => onSelectTab('projects')}
          className="bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 p-2.5 rounded-lg cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider">Projects</span>
            <FolderGit2 className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div className="text-base font-bold text-slate-200 font-mono">{counters.total_projects}</div>
        </div>

        {/* CF Accounts */}
        <div
          onClick={() => onSelectTab('accounts')}
          className="bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 p-2.5 rounded-lg cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider">Accounts</span>
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-base font-bold text-slate-200 font-mono">{counters.total_accounts}</div>
        </div>

        {/* Live / Success */}
        <div
          onClick={() => onSelectTab('deployments')}
          className="bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 p-2.5 rounded-lg cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider">Live</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/90" />
          </div>
          <div className="text-base font-bold text-emerald-400/90 font-mono">
            {counters.success_deployments} <span className="text-[10px] text-slate-400">({successRate}%)</span>
          </div>
        </div>

        {/* Active Builds */}
        <div
          onClick={() => onSelectTab('deployments')}
          className="bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 p-2.5 rounded-lg cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider">Active</span>
            <Clock className={`w-3.5 h-3.5 text-amber-400/90 ${active_builds > 0 ? 'animate-spin' : ''}`} />
          </div>
          <div className="text-base font-bold text-amber-400/90 font-mono">{active_builds}</div>
        </div>

        {/* Errors */}
        <div
          onClick={() => onSelectTab('deployments')}
          className="bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 p-2.5 rounded-lg cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider">Errors</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-400/90" />
          </div>
          <div className="text-base font-bold text-rose-400/90 font-mono">{counters.failed_deployments}</div>
        </div>

        {/* DB Ping */}
        <div
          onClick={() => onSelectTab('database')}
          className="bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 p-2.5 rounded-lg cursor-pointer transition"
        >
          <div className="flex items-center justify-between text-slate-400 mb-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wider">DB Latency</span>
            <Database className="w-3.5 h-3.5 text-emerald-400/90" />
          </div>
          <div className="text-base font-bold text-slate-200 font-mono">{db.latency_ms}ms</div>
        </div>
      </div>

      {/* Control Strip & System Vitals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2.5">
        {/* Controls */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Wrench className="w-3 h-3 text-orange-400" />
              <span>Controls</span>
            </span>
          </div>

          {/* Maintenance Toggle */}
          <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/70 text-[11px]">
            <span className="font-medium text-slate-300">Maintenance Mode</span>
            <button
              onClick={() => onToggleMaintenance(!maintenance_mode)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition font-mono ${
                maintenance_mode
                  ? 'bg-amber-600/90 hover:bg-amber-500 text-white'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80'
              }`}
            >
              {maintenance_mode ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Emergency Kill Switch */}
          <div className="p-2 rounded bg-rose-950/30 border border-rose-900/40 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-rose-400/90 flex items-center gap-1">
                <PowerOff className="w-3 h-3" />
                <span>Emergency Abort</span>
              </span>
            </div>

            {!confirmAbort ? (
              <button
                onClick={() => setConfirmAbort(true)}
                className="w-full py-1 text-[11px] font-medium text-slate-200 bg-rose-900/60 hover:bg-rose-900/90 border border-rose-800/60 rounded transition flex items-center justify-center gap-1"
              >
                <PowerOff className="w-3 h-3" />
                <span>Abort All Builds</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    onEmergencyAbort();
                    setConfirmAbort(false);
                  }}
                  className="flex-1 py-1 text-[11px] font-semibold text-white bg-rose-700 hover:bg-rose-600 rounded transition"
                >
                  CONFIRM ABORT
                </button>
                <button
                  onClick={() => setConfirmAbort(false)}
                  className="px-2.5 py-1 text-[11px] text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Telemetry */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Cpu className="w-3 h-3 text-sky-400" />
              <span>Telemetry</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400/90">Node {system.node_version}</span>
          </div>

          {/* RAM */}
          <div className="space-y-1 text-[11px] font-mono">
            <div className="flex justify-between text-slate-400">
              <span>RAM</span>
              <span className="text-slate-300">{system.memory_used_mb}M / {system.memory_total_mb}M ({system.memory_percent}%)</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-950/80 border border-slate-800/70 overflow-hidden">
              <div
                className={`h-full ${
                  system.memory_percent > 85
                    ? 'bg-rose-500'
                    : system.memory_percent > 65
                    ? 'bg-amber-500'
                    : 'bg-sky-500'
                }`}
                style={{ width: `${Math.min(system.memory_percent, 100)}%` }}
              />
            </div>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono pt-0.5">
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800/70 flex justify-between">
              <span className="text-slate-400">CPUs</span>
              <span className="text-slate-300">{system.cpus} Cores</span>
            </div>
            <div className="p-1.5 rounded bg-slate-950/60 border border-slate-800/70 flex justify-between">
              <span className="text-slate-400">Uptime</span>
              <span className="text-slate-300">{formatUptime(system.process_uptime_sec)}</span>
            </div>
          </div>
        </div>

        {/* Audit Log Snippet */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800/70 pb-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
              <Terminal className="w-3 h-3 text-emerald-400/90" />
              <span>Recent Activity</span>
            </span>
            <button
              onClick={() => onSelectTab('audit')}
              className="text-[10px] text-orange-400/90 hover:text-orange-300"
            >
              All →
            </button>
          </div>

          <div className="space-y-1 overflow-y-auto max-h-36 pr-0.5">
            {recent_audit_logs && recent_audit_logs.length > 0 ? (
              recent_audit_logs.slice(0, 4).map((log) => (
                <div
                  key={log.id}
                  className="px-2 py-1 rounded bg-slate-950/60 border border-slate-800/70 text-[10px] font-mono flex items-center justify-between"
                >
                  <span className="text-orange-400/90 font-medium truncate max-w-[130px]">
                    {log.action}
                  </span>
                  <span className="text-slate-400">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-slate-400 text-[11px] font-mono text-center py-4">
                No activity
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
