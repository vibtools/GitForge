import React, { useState, useEffect } from 'react';
import {
  Terminal,
  Search,
  RefreshCw,
  Play,
  Square,
  Trash2,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Copy,
  X,
  Globe,
} from 'lucide-react';
import { AdminDeployment } from '../types';
import { vconApi } from '../api';

interface VconDeploymentsControlProps {
  onNotify: (msg: string, isError?: boolean) => void;
}

export const VconDeploymentsControl: React.FC<VconDeploymentsControlProps> = ({ onNotify }) => {
  const [deployments, setDeployments] = useState<AdminDeployment[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeLogDeployment, setActiveLogDeployment] = useState<AdminDeployment | null>(null);

  const loadDeployments = async () => {
    try {
      setLoading(true);
      const data = await vconApi.getDeployments({
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setDeployments(data);
    } catch (err: any) {
      onNotify(err.message || 'Failed to load deployments', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDeployments();
  }, [statusFilter]);

  const handleRetry = async (id: string) => {
    try {
      await vconApi.retryDeployment(id);
      onNotify('Rebuild initiated.');
      loadDeployments();
    } catch (err: any) {
      onNotify(err.message || 'Retry failed', true);
    }
  };

  const handleForceCancel = async (id: string) => {
    try {
      await vconApi.forceCancelDeployment(id);
      onNotify('Canceled.');
      loadDeployments();
    } catch (err: any) {
      onNotify(err.message || 'Cancel failed', true);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete record?')) return;
    try {
      await vconApi.deleteDeployment(id);
      onNotify('Record deleted.');
      loadDeployments();
    } catch (err: any) {
      onNotify(err.message || 'Delete failed', true);
    }
  };

  const handleCopyLogs = (logs: string) => {
    navigator.clipboard.writeText(logs);
    onNotify('Logs copied.');
  };

  const filtered = deployments.filter((d) => {
    const query = search.toLowerCase();
    return (
      d.account_alias.toLowerCase().includes(query) ||
      d.project_name.toLowerCase().includes(query) ||
      d.subdomain.toLowerCase().includes(query) ||
      (d.custom_domain && d.custom_domain.toLowerCase().includes(query)) ||
      (d.cf_pages_project_name && d.cf_pages_project_name.toLowerCase().includes(query))
    );
  });

  return (
    <div className="space-y-2.5">
      {/* Control Header */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
        <div className="flex items-center gap-1.5">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span className="font-bold text-white">Deployments ({deployments.length})</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Status Tabs */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800 text-[10px]">
            {['all', 'building', 'success', 'failed'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-0.5 font-medium rounded capitalize transition ${
                  statusFilter === st
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-[11px] text-slate-200 pl-6 pr-2 py-0.5 rounded focus:outline-none focus:border-orange-500 w-32 sm:w-44"
            />
          </div>

          <button
            onClick={loadDeployments}
            disabled={loading}
            className="p-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Deployments Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-950/80 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2 px-2.5">Account / Project</th>
                <th className="py-2 px-2.5">Domain</th>
                <th className="py-2 px-2.5 text-center">Status</th>
                <th className="py-2 px-2.5">Step / Logs</th>
                <th className="py-2 px-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    {loading ? 'Loading...' : 'No deployments match.'}
                  </td>
                </tr>
              ) : (
                filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/30 transition">
                    {/* Account / Project */}
                    <td className="py-2 px-2.5">
                      <div className="font-semibold text-slate-200">{d.account_alias}</div>
                      <div className="text-[10px] text-orange-400">{d.project_name}</div>
                    </td>

                    {/* Domain */}
                    <td className="py-2 px-2.5">
                      {d.custom_domain ? (
                        <a
                          href={`https://${d.custom_domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-200 font-semibold hover:text-emerald-400 flex items-center gap-1"
                        >
                          <Globe className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                          <span className="truncate max-w-[160px]">{d.custom_domain}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-400">
                          {d.subdomain}.{d.root_domain}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-2 px-2.5 text-center">
                      {d.build_status === 'building' || d.build_status === 'queued' ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-950 text-blue-300 border border-blue-700/60 animate-pulse">
                          {d.progress_percent}%
                        </span>
                      ) : d.build_status === 'success' ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                          LIVE
                        </span>
                      ) : d.build_status === 'failed' ? (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-950 text-red-300 border border-red-800">
                          <AlertCircle className="w-2.5 h-2.5 text-red-400" />
                          FAIL
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          IDLE
                        </span>
                      )}
                    </td>

                    {/* Step / Logs */}
                    <td className="py-2 px-2.5 max-w-[200px]">
                      <div className="text-[10px] text-slate-300 truncate" title={d.error_message || d.current_step}>
                        {d.error_message || d.current_step || 'Idle'}
                      </div>
                      <button
                        onClick={() => setActiveLogDeployment(d)}
                        className="text-[9px] text-orange-400 hover:text-orange-300 flex items-center gap-0.5 mt-0.5"
                      >
                        <Terminal className="w-2.5 h-2.5" />
                        <span>Logs</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRetry(d.id)}
                          className="p-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition"
                          title="Retry"
                        >
                          <Play className="w-2.5 h-2.5 text-emerald-400" />
                        </button>

                        {(d.build_status === 'building' || d.build_status === 'queued') && (
                          <button
                            onClick={() => handleForceCancel(d.id)}
                            className="p-1 text-red-300 hover:text-white bg-red-950/80 hover:bg-red-900 border border-red-800 rounded transition"
                            title="Cancel"
                          >
                            <Square className="w-2.5 h-2.5 text-red-400" />
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(d.id)}
                          className="p-1 text-red-400 hover:text-white hover:bg-red-950 rounded transition"
                          title="Delete"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Logs Modal */}
      {activeLogDeployment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75">
          <div className="bg-slate-950 border border-slate-800 rounded-lg max-w-2xl w-full flex flex-col max-h-[80vh] shadow-2xl overflow-hidden font-mono text-[11px]">
            <div className="h-8 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Terminal className="w-3 h-3 text-emerald-400" />
                <span>Logs: {activeLogDeployment.account_alias}</span>
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleCopyLogs(activeLogDeployment.logs || '')}
                  className="px-1.5 py-0.5 text-[10px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition flex items-center gap-1 border border-slate-700"
                >
                  <Copy className="w-2.5 h-2.5" />
                  <span>Copy</span>
                </button>
                <button
                  onClick={() => setActiveLogDeployment(null)}
                  className="p-0.5 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="p-3 overflow-y-auto flex-1 bg-slate-950 text-slate-300 whitespace-pre-wrap leading-relaxed select-text">
              {activeLogDeployment.logs || <span className="text-slate-400 italic">No logs recorded.</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
