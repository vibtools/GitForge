import React, { useState, useEffect } from 'react';
import {
  Database,
  RefreshCw,
  Trash2,
  Download,
  HardDrive,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { DbStats } from '../types';
import { vconApi } from '../api';

interface VconDatabaseControlProps {
  onNotify: (msg: string, isError?: boolean) => void;
}

export const VconDatabaseControl: React.FC<VconDatabaseControlProps> = ({ onNotify }) => {
  const [stats, setStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await vconApi.getDbStats();
      setStats(data);
    } catch (err: any) {
      onNotify(err.message || 'Failed to load database metrics', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleCleanup = async () => {
    if (!window.confirm('Run database cleanup routine?')) return;
    try {
      setCleaning(true);
      const res = await vconApi.runDbCleanup();
      onNotify(`Cleanup complete: ${res.expired_sessions_cleared} expired sessions purged.`);
      loadStats();
    } catch (err: any) {
      onNotify(err.message || 'Database cleanup failed', true);
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="space-y-3 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
        <div className="flex items-center gap-1.5">
          <Database className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white">Database Diagnostics</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCleanup}
            disabled={cleaning}
            className="px-2 py-0.5 text-[11px] font-semibold text-amber-300 hover:text-white bg-amber-950/60 hover:bg-amber-900 border border-amber-800/80 rounded transition flex items-center gap-1"
          >
            <Trash2 className={`w-3 h-3 ${cleaning ? 'animate-spin' : ''}`} />
            <span>Cleanup</span>
          </button>

          <a
            href="/api/admin/export-system"
            download
            className="px-2 py-0.5 text-[11px] font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition flex items-center gap-1"
          >
            <Download className="w-3 h-3 text-sky-400" />
            <span>Backup JSON</span>
          </a>

          <button
            onClick={loadStats}
            disabled={loading}
            className="p-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
      </div>

      {stats ? (
        <div className="space-y-2.5">
          {/* Health & Pool */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="font-bold text-white block text-[11px]">{stats.provider}</span>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    SSL Connected
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-sky-400" />
                <div>
                  <span className="font-bold text-sky-300 block text-[11px] font-mono">
                    Pool: {stats.connection_pool.total_count} total / {stats.connection_pool.idle_count} idle
                  </span>
                  <span className="text-[10px] text-slate-400">Waiting: {stats.connection_pool.waiting_count}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Table Exact Counts Grid */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-2">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block">
              Table Row Counts
            </span>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-xs font-mono">
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-center">
                <span className="text-slate-400 block text-[9px]">projects</span>
                <span className="font-bold text-white">{stats.exact_counts.cf_projects}</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-center">
                <span className="text-slate-400 block text-[9px]">accounts</span>
                <span className="font-bold text-sky-400">{stats.exact_counts.cf_accounts}</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-center">
                <span className="text-slate-400 block text-[9px]">deployments</span>
                <span className="font-bold text-emerald-400">{stats.exact_counts.cf_deployments}</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-center">
                <span className="text-slate-400 block text-[9px]">users</span>
                <span className="font-bold text-indigo-400">{stats.exact_counts.app_users}</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-center">
                <span className="text-slate-400 block text-[9px]">sessions</span>
                <span className="font-bold text-amber-400">{stats.exact_counts.app_sessions}</span>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800 text-center">
                <span className="text-slate-400 block text-[9px]">audit_logs</span>
                <span className="font-bold text-orange-400">{stats.exact_counts.app_audit_logs}</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-slate-400 text-xs font-mono">
          Loading metrics...
        </div>
      )}
    </div>
  );
};
