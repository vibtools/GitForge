import React, { useState, useEffect } from 'react';
import { ScrollText, RefreshCw, Filter, ChevronRight, ChevronDown } from 'lucide-react';
import { AuditLog } from '../types';
import { vconApi } from '../api';

interface VconAuditLogsProps {
  onNotify: (msg: string, isError?: boolean) => void;
}

export const VconAuditLogs: React.FC<VconAuditLogsProps> = ({ onNotify }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const data = await vconApi.getAuditLogs(actionFilter !== 'all' ? actionFilter : undefined, 100);
      setLogs(data);
    } catch (err: any) {
      onNotify(err.message || 'Failed to load audit logs', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800/80 px-3 py-1.5 rounded-lg text-xs">
        <div className="flex items-center gap-1.5">
          <ScrollText className="w-4 h-4 text-orange-400" />
          <span className="font-semibold text-slate-200">Audit Trail</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-slate-950/80 px-2 py-0.5 rounded border border-slate-800/80 text-[11px]">
            <Filter className="w-2.5 h-2.5 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-transparent text-slate-300 focus:outline-none text-[11px] cursor-pointer"
            >
              <option value="all">All Actions</option>
              <option value="EMERGENCY_GLOBAL_ABORT">Emergency Abort</option>
              <option value="SITE_SETTINGS_UPDATED">Site Settings Updated</option>
              <option value="SETTINGS_UPDATED">Settings Updated</option>
              <option value="USER_CREATED">User Created</option>
              <option value="USER_UPDATED">User Updated</option>
              <option value="USER_DELETED">User Deleted</option>
              <option value="SESSION_REVOKED">Session Revoked</option>
              <option value="PROJECT_GIT_SYNCED">Git Synced</option>
              <option value="ACCOUNT_UPDATED_BY_ADMIN">Account Updated</option>
              <option value="ACCOUNT_DELETED_BY_ADMIN">Account Deleted</option>
              <option value="DB_CLEANUP_PERFORMED">DB Cleanup</option>
            </select>
          </div>

          <button
            onClick={loadLogs}
            disabled={loading}
            className="p-1 text-slate-300 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-800 rounded border border-slate-700/80 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] font-mono">
            <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800/80">
              <tr>
                <th className="py-2 px-2.5">Timestamp</th>
                <th className="py-2 px-2.5">Action</th>
                <th className="py-2 px-2.5">User</th>
                <th className="py-2 px-2.5">IP</th>
                <th className="py-2 px-2.5 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-400">
                    {loading ? 'Loading...' : 'No audit entries.'}
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => toggleExpand(log.id)}
                        className="hover:bg-slate-800/40 transition cursor-pointer"
                      >
                        <td className="py-1.5 px-2.5 text-slate-400 text-[10px] whitespace-nowrap">
                          {new Date(log.created_at).toLocaleTimeString()}
                        </td>
                        <td className="py-1.5 px-2.5">
                          <span
                            className={`font-medium px-1.5 py-0.2 rounded text-[9px] border ${
                              log.action.includes('EMERGENCY') || log.action.includes('DELETED')
                                ? 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                                : log.action.includes('SETTINGS')
                                ? 'bg-orange-950/40 text-orange-300 border-orange-800/60'
                                : 'bg-slate-800/80 text-slate-300 border-slate-700/60'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-1.5 px-2.5 text-slate-300 text-[10px]">{log.user_email}</td>
                        <td className="py-1.5 px-2.5 text-slate-400 text-[10px]">{log.ip_address}</td>
                        <td className="py-1.5 px-2.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(log.id);
                            }}
                            className="p-0.5 text-slate-400 hover:text-slate-200"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-slate-950">
                          <td colSpan={5} className="p-2 text-[10px]">
                            <pre className="p-2 rounded bg-slate-950 border border-slate-800 text-slate-300 overflow-x-auto select-text font-mono">
                              {JSON.stringify(log.details, null, 2)}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
