import React, { useState, useEffect } from 'react';
import {
  Cloud,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  ShieldCheck,
  X,
  Save,
} from 'lucide-react';
import { AdminAccount } from '../types';
import { vconApi } from '../api';

interface VconCloudflareControlProps {
  onNotify: (msg: string, isError?: boolean) => void;
}

export const VconCloudflareControl: React.FC<VconCloudflareControlProps> = ({ onNotify }) => {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [visibleTokens, setVisibleTokens] = useState<Record<string, boolean>>({});
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verificationResults, setVerificationResults] = useState<
    Record<string, { valid: boolean; accountName?: string; error?: string }>
  >({});
  const [editingAccount, setEditingAccount] = useState<AdminAccount | null>(null);
  const [editForm, setEditForm] = useState({
    alias: '',
    account_id: '',
    api_token: '',
    subdomain: '',
    email: '',
  });

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await vconApi.getAccounts();
      setAccounts(data);
    } catch (err: any) {
      onNotify(err.message || 'Failed to load accounts', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const toggleTokenVisibility = (id: string) => {
    setVisibleTokens((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleVerifyToken = async (acc: AdminAccount) => {
    try {
      setVerifyingId(acc.id);
      const res = await vconApi.verifyCloudflareToken(acc.account_id, acc.api_token);
      setVerificationResults((prev) => ({ ...prev, [acc.id]: res }));
      if (res.valid) {
        onNotify(`Account verified.`);
      } else {
        onNotify(`Invalid: ${res.error || 'Check credentials'}`, true);
      }
    } catch (err: any) {
      onNotify(err.message || 'Verification error', true);
    } finally {
      setVerifyingId(null);
    }
  };

  const handleEditClick = (acc: AdminAccount) => {
    setEditingAccount(acc);
    setEditForm({
      alias: acc.alias,
      account_id: acc.account_id,
      api_token: acc.api_token,
      subdomain: acc.subdomain,
      email: acc.email || '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount) return;

    try {
      await vconApi.updateAccount(editingAccount.id, editForm);
      onNotify(`Account updated.`);
      setEditingAccount(null);
      loadAccounts();
    } catch (err: any) {
      onNotify(err.message || 'Update failed', true);
    }
  };

  const handleDelete = async (id: string, alias: string) => {
    if (!window.confirm(`Delete account "${alias}"?`)) return;
    try {
      await vconApi.deleteAccount(id);
      onNotify(`Account deleted.`);
      loadAccounts();
    } catch (err: any) {
      onNotify(err.message || 'Delete failed', true);
    }
  };

  const distinctProjects = Array.from(new Set(accounts.map((a) => a.project_name))).filter(Boolean);

  const filtered = accounts.filter((a) => {
    const matchesSearch =
      a.alias.toLowerCase().includes(search.toLowerCase()) ||
      a.account_id.toLowerCase().includes(search.toLowerCase()) ||
      a.subdomain.toLowerCase().includes(search.toLowerCase()) ||
      a.project_name.toLowerCase().includes(search.toLowerCase());

    const matchesProject = projectFilter === 'all' || a.project_name === projectFilter;
    return matchesSearch && matchesProject;
  });

  return (
    <div className="space-y-2.5">
      {/* Control Header */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
        <div className="flex items-center gap-1.5">
          <Cloud className="w-4 h-4 text-sky-400" />
          <span className="font-bold text-white">Cloudflare Accounts ({accounts.length})</span>
        </div>

        <div className="flex items-center gap-1.5">
          {distinctProjects.length > 0 && (
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-[11px] text-slate-200 px-2 py-0.5 rounded focus:outline-none focus:border-orange-500"
            >
              <option value="all">All Projects</option>
              {distinctProjects.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}

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
            onClick={loadAccounts}
            disabled={loading}
            className="p-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-950/80 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2 px-2.5">Alias / Project</th>
                <th className="py-2 px-2.5">Account ID</th>
                <th className="py-2 px-2.5">API Token</th>
                <th className="py-2 px-2.5">Subdomain</th>
                <th className="py-2 px-2.5 text-center">Verify</th>
                <th className="py-2 px-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    {loading ? 'Loading...' : 'No accounts found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((acc) => {
                  const check = verificationResults[acc.id];
                  const isVisible = visibleTokens[acc.id];
                  return (
                    <tr key={acc.id} className="hover:bg-slate-800/30 transition">
                      {/* Alias & Project */}
                      <td className="py-2 px-2.5">
                        <div className="font-semibold text-slate-200">{acc.alias}</div>
                        <div className="text-[10px] text-orange-400">{acc.project_name}</div>
                      </td>

                      {/* Account ID */}
                      <td className="py-2 px-2.5 font-mono text-[10px] text-slate-300">
                        {acc.account_id}
                      </td>

                      {/* API Token */}
                      <td className="py-2 px-2.5">
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-[10px] text-slate-300 bg-slate-950 px-1.5 py-0.2 rounded border border-slate-800 select-all">
                            {isVisible ? acc.api_token : acc.masked_token || '••••••••'}
                          </span>
                          <button
                            onClick={() => toggleTokenVisibility(acc.id)}
                            className="p-0.5 text-slate-400 hover:text-slate-200"
                          >
                            {isVisible ? <EyeOff className="w-2.5 h-2.5" /> : <Eye className="w-2.5 h-2.5" />}
                          </button>
                        </div>
                      </td>

                      {/* Subdomain */}
                      <td className="py-2 px-2.5">
                        <div className="text-slate-200 font-semibold">
                          {acc.subdomain}.{acc.root_domain}
                        </div>
                      </td>

                      {/* Live Check */}
                      <td className="py-2 px-2.5 text-center">
                        {check ? (
                          check.valid ? (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                              OK
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-950 text-red-300 border border-red-800"
                              title={check.error || 'Failed'}
                            >
                              <AlertCircle className="w-2.5 h-2.5 text-red-400" />
                              ERR
                            </span>
                          )
                        ) : (
                          <button
                            onClick={() => handleVerifyToken(acc)}
                            disabled={verifyingId === acc.id}
                            className="px-1.5 py-0.2 rounded text-[9px] font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition inline-flex items-center gap-1"
                          >
                            <ShieldCheck className={`w-2.5 h-2.5 text-sky-400 ${verifyingId === acc.id ? 'animate-spin' : ''}`} />
                            <span>{verifyingId === acc.id ? '...' : 'Test'}</span>
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEditClick(acc)}
                            className="p-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition"
                            title="Edit"
                          >
                            <Edit2 className="w-3 h-3 text-sky-400" />
                          </button>
                          <button
                            onClick={() => handleDelete(acc.id, acc.alias)}
                            className="p-1 text-red-400 hover:text-white hover:bg-red-950 rounded transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-3.5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5 text-orange-400" />
                <span>Edit CF Account</span>
              </span>
              <button onClick={() => setEditingAccount(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-2 text-[11px]">
              <div>
                <label className="block text-slate-400 mb-0.5">Alias</label>
                <input
                  type="text"
                  required
                  value={editForm.alias}
                  onChange={(e) => setEditForm({ ...editForm, alias: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-0.5">Account ID</label>
                <input
                  type="text"
                  required
                  value={editForm.account_id}
                  onChange={(e) => setEditForm({ ...editForm, account_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-[10px]"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-0.5">API Token</label>
                <input
                  type="text"
                  required
                  value={editForm.api_token}
                  onChange={(e) => setEditForm({ ...editForm, api_token: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-[10px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-0.5">Subdomain</label>
                  <input
                    type="text"
                    required
                    value={editForm.subdomain}
                    onChange={(e) => setEditForm({ ...editForm, subdomain: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-0.5">Email</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingAccount(null)}
                  className="px-2.5 py-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded transition flex items-center gap-1"
                >
                  <Save className="w-3 h-3" />
                  <span>Update</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
