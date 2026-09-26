import React from 'react';
import {
  ExternalLink,
  Eye,
  RefreshCw,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Layers,
  ArrowUpRight,
  Shield,
  ShieldCheck,
} from 'lucide-react';
import { Account, Project } from '../types';

interface AccountTableProps {
  project: Project;
  accounts: Account[];
  selectedIds: string[];
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onViewAccount: (account: Account) => void;
  onRebuildAccount: (deploymentId: string) => void;
  onDeleteAccount: (accountId: string) => void;
  isBuilding: boolean;
}

export const AccountTable: React.FC<AccountTableProps> = ({
  project,
  accounts,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onViewAccount,
  onRebuildAccount,
  onDeleteAccount,
  isBuilding,
}) => {
  const [testingId, setTestingId] = React.useState<string | null>(null);
  const [isTestingAll, setIsTestingAll] = React.useState(false);
  const [testResults, setTestResults] = React.useState<Record<string, { valid: boolean; message: string }>>({});
  const [batchSummary, setBatchSummary] = React.useState<{ total: number; valid: number; invalid: number } | null>(null);

  const handleTestAllAccounts = async () => {
    setIsTestingAll(true);
    try {
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch(`/api/projects/${project.id}/test-accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.results) {
        setTestResults((prev) => ({ ...prev, ...data.results }));
        if (data.summary) {
          setBatchSummary(data.summary);
        }
      }
    } catch (err) {
      console.error('Test all accounts error:', err);
    } finally {
      setIsTestingAll(false);
    }
  };

  const handleTestAccount = async (accountId: string) => {
    setTestingId(accountId);
    try {
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch(`/api/accounts/${accountId}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.valid) {
        setTestResults((prev) => ({
          ...prev,
          [accountId]: { valid: true, message: `Active: ${data.accountName || 'OK'}` },
        }));
      } else {
        setTestResults((prev) => ({
          ...prev,
          [accountId]: { valid: false, message: data.error || 'Check failed' },
        }));
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [accountId]: { valid: false, message: err.message || 'Error' },
      }));
    } finally {
      setTestingId(null);
    }
  };

  const allSelected = accounts.length > 0 && selectedIds.length === accounts.length;

  if (accounts.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
        <div className="w-8 h-8 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-400 mb-2">
          <Layers className="w-4 h-4 text-orange-400" />
        </div>
        <h3 className="text-xs font-semibold text-slate-200">No Cloudflare Accounts Added</h3>
      </div>
    );
  }

  return (
    <div className="border border-slate-800/80 rounded-lg overflow-hidden bg-slate-900 shadow-xs">
      {/* Top Toolbar */}
      <div className="bg-slate-950/80 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium text-[11px]">
            {accounts.length} {accounts.length === 1 ? 'Account' : 'Accounts'}
          </span>
          {batchSummary && (
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-900 border border-slate-800 text-slate-300">
              <span className="text-emerald-400 font-semibold">{batchSummary.valid}</span> valid /{' '}
              <span className={batchSummary.invalid > 0 ? 'text-red-400 font-semibold' : 'text-slate-400'}>
                {batchSummary.invalid}
              </span>{' '}
              issues
            </span>
          )}
        </div>

        <button
          onClick={handleTestAllAccounts}
          disabled={isTestingAll || isBuilding}
          className="px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded transition flex items-center gap-1 active:scale-95"
          title="Test API credentials for all accounts against Cloudflare"
        >
          <Shield className={`w-3 h-3 text-orange-400 ${isTestingAll ? 'animate-spin' : ''}`} />
          <span>{isTestingAll ? 'Verifying All Accounts...' : 'Test All Accounts'}</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-[11px]">
          {/* Table Header */}
          <thead className="bg-slate-950/90 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800 font-medium">
            <tr>
              <th className="py-2 px-2.5 w-7">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-slate-700 bg-slate-800 text-orange-500 focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5"
                />
              </th>
              <th className="py-2 px-2.5">Cloudflare Account</th>
              <th className="py-2 px-2.5">Subdomain & Custom Link</th>
              <th className="py-2 px-2.5">Free Pages.dev Domain</th>
              <th className="py-2 px-2.5 min-w-[170px]">Build Progress</th>
              <th className="py-2 px-2.5 text-center">DNS</th>
              <th className="py-2 px-2.5 text-right">Actions</th>
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-800/60">
            {accounts.map((acc) => {
              const isSelected = selectedIds.includes(acc.id);
              const isRowBuilding = acc.build_status === 'building' || acc.build_status === 'queued';
              const isSuccess = acc.build_status === 'success';
              const isFailed = acc.build_status === 'failed';
              const progress = acc.progress_percent ?? 0;

              return (
                <tr
                  key={acc.id}
                  className={`transition-colors duration-75 ${
                    isSelected ? 'bg-orange-500/5' : 'hover:bg-slate-800/30'
                  }`}
                >
                  {/* Checkbox */}
                  <td className="py-1.5 px-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(acc.id)}
                      className="rounded border-slate-700 bg-slate-800 text-orange-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                    />
                  </td>

                  {/* Account Name & CF Account ID */}
                  <td className="py-1.5 px-2.5">
                    <div className="space-y-0.5">
                      <div className="font-medium text-slate-100 flex items-center gap-1.5">
                        <span className="truncate max-w-[130px]">{acc.alias}</span>
                        {acc.cf_pages_project_name && (
                          <span className="text-[9px] font-mono text-slate-400 bg-slate-800 px-1 rounded border border-slate-700/60">
                            {acc.cf_pages_project_name}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 truncate max-w-[150px]">
                        {acc.account_id}
                      </div>
                      {testResults[acc.id] && (
                        <div
                          className={`text-[9px] font-mono truncate max-w-[170px] ${
                            testResults[acc.id].valid ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {testResults[acc.id].message}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Subdomain & Custom URL */}
                  <td className="py-1.5 px-2.5 font-mono">
                    <div className="space-y-0.5">
                      <div className="text-orange-400 font-medium flex items-center gap-1">
                        <span className="truncate max-w-[160px]">
                          {acc.subdomain}.{project.root_domain}
                        </span>
                        {acc.custom_domain && (
                          <a
                            href={acc.custom_domain}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-500 hover:text-orange-300"
                            title="Open custom domain"
                          >
                            <ArrowUpRight className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        CNAME: <span className="text-slate-400">{acc.cname_host || acc.subdomain}</span>
                      </div>
                    </div>
                  </td>

                  {/* Free Pages.dev Domain */}
                  <td className="py-1.5 px-2.5 font-mono">
                    {acc.pages_dev_domain ? (
                      <a
                        href={acc.pages_dev_domain}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1 truncate max-w-[160px]"
                      >
                        <span className="truncate">{acc.pages_dev_domain.replace(/^https?:\/\//, '')}</span>
                        <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                      </a>
                    ) : (
                      <span className="text-slate-500 text-[10px]">Pending build</span>
                    )}
                  </td>

                  {/* Build Progress & Status Bar */}
                  <td className="py-1.5 px-2.5">
                    <div className="space-y-1 min-w-[160px]">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-300 truncate max-w-[120px] font-mono text-[10px]">
                          {acc.current_step || (isSuccess ? 'Live' : 'Ready')}
                        </span>
                        <span className="font-mono text-[9px] text-slate-400 tabular-nums">
                          {progress}%
                        </span>
                      </div>

                      {/* Progress Track */}
                      <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden border border-slate-800">
                        <div
                          className={`h-full transition-all duration-300 rounded-full ${
                            isFailed
                              ? 'bg-red-500'
                              : isSuccess
                              ? 'bg-emerald-500'
                              : 'bg-orange-500'
                          }`}
                          style={{ width: `${Math.max(progress, isRowBuilding ? 8 : 0)}%` }}
                        />
                      </div>

                      {isFailed && acc.error_message && (
                        <div
                          className="text-[9px] font-mono text-red-400 truncate max-w-[170px]"
                          title={acc.error_message}
                        >
                          {acc.error_message}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* DNS Status */}
                  <td className="py-1.5 px-2.5 text-center">
                    {isSuccess ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-400 bg-emerald-950/40 px-1.5 py-0.2 rounded border border-emerald-800/40">
                        <ShieldCheck className="w-2.5 h-2.5" />
                        <span>Ready</span>
                      </span>
                    ) : isRowBuilding ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-400 bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-800/40">
                        <Clock className="w-2.5 h-2.5 animate-spin" />
                        <span>Building</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">Unbound</span>
                    )}
                  </td>

                  {/* Action Buttons: View, Rebuild, Delete */}
                  <td className="py-1.5 px-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      {/* View Button */}
                      <button
                        onClick={() => onViewAccount(acc)}
                        className="px-2 py-0.5 text-[11px] font-medium text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition flex items-center gap-1 shadow-2xs active:scale-95"
                      >
                        <Eye className="w-3 h-3 text-orange-400" />
                        <span>View</span>
                      </button>

                      {/* Test Cloudflare Credentials */}
                      <button
                        onClick={() => handleTestAccount(acc.id)}
                        disabled={testingId === acc.id || isBuilding}
                        className="p-1 text-slate-400 hover:text-orange-400 hover:bg-slate-800 rounded transition disabled:opacity-40"
                        title="Test Cloudflare Credentials"
                      >
                        <ShieldCheck className={`w-3 h-3 ${testingId === acc.id ? 'animate-pulse text-orange-400' : ''}`} />
                      </button>

                      {/* Rebuild Single Account */}
                      {acc.deployment_id && (
                        <button
                          onClick={() => onRebuildAccount(acc.deployment_id!)}
                          disabled={isBuilding}
                          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition disabled:opacity-40"
                          title="Rebuild"
                        >
                          <RefreshCw className={`w-3 h-3 ${isRowBuilding ? 'animate-spin text-orange-400' : ''}`} />
                        </button>
                      )}

                      {/* Delete Account */}
                      <button
                        onClick={() => onDeleteAccount(acc.id)}
                        disabled={isBuilding}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition disabled:opacity-40"
                        title="Delete"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
