import React, { useState } from 'react';
import { X, Plus, Upload, CheckCircle2, Shield, AlertCircle } from 'lucide-react';
import { Project } from '../types';

interface BulkAccountModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onAccountsAdded: () => void;
}

export const BulkAccountModal: React.FC<BulkAccountModalProps> = ({
  project,
  isOpen,
  onClose,
  onAccountsAdded,
}) => {
  const [mode, setMode] = useState<'bulk' | 'single'>('bulk');
  const [bulkText, setBulkText] = useState('');
  const [singleAlias, setSingleAlias] = useState('');
  const [singleAccountId, setSingleAccountId] = useState('');
  const [singleApiToken, setSingleApiToken] = useState('');
  const [singleEmail, setSingleEmail] = useState('');
  const [singleSubdomain, setSingleSubdomain] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTestConnection = async () => {
    setTestResult(null);
    setError(null);

    if (!singleAccountId.trim() || !singleApiToken.trim()) {
      setError('Enter Account ID and API Token to test');
      return;
    }

    setIsTesting(true);
    try {
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch('/api/cloudflare/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          account_id: singleAccountId.trim(),
          api_token: singleApiToken.trim(),
        }),
      });

      const data = await res.json();
      if (data.valid) {
        setTestResult({
          valid: true,
          message: `Connected: ${data.accountName || 'Cloudflare Account'} (${data.tokenStatus})`,
        });
      } else {
        setTestResult({
          valid: false,
          message: data.error || 'Cloudflare verification failed',
        });
      }
    } catch (err: any) {
      setTestResult({
        valid: false,
        message: err.message || 'Connection test failed',
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isOpen || !project) return null;

  const handleBulkSubmit = async () => {
    setError(null);
    if (!bulkText.trim()) {
      setError('Please provide account information');
      return;
    }

    const lines = bulkText.trim().split('\n').filter((l) => l.trim().length > 0);
    const parsedAccounts: any[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('{') && line.endsWith('}')) {
        try {
          parsedAccounts.push(JSON.parse(line));
          continue;
        } catch {
          // ignore
        }
      }

      let parts: string[];
      if (line.includes(',') || line.includes('|') || line.includes('\t') || line.includes(';')) {
        parts = line.split(/[,|\t;]+/).map((p) => p.trim());
      } else if (line.includes(':')) {
        parts = line.split(':').map((p) => p.trim());
      } else {
        parts = line.split(/\s+/).map((p) => p.trim());
      }

      if (parts.length >= 2) {
        // Skip header lines if pasted
        const firstCol = parts[0].toLowerCase();
        const secondCol = parts[1].toLowerCase();
        if (
          firstCol === 'alias' ||
          firstCol === 'name' ||
          secondCol === 'account_id' ||
          secondCol === 'account id' ||
          secondCol === 'api_token'
        ) {
          continue;
        }

        if (parts.length >= 4) {
          parsedAccounts.push({
            alias: parts[0],
            account_id: parts[1],
            api_token: parts[2],
            subdomain: parts[3],
          });
        } else if (parts.length === 3) {
          parsedAccounts.push({
            alias: parts[0],
            account_id: parts[1],
            api_token: parts[2],
            subdomain: `sub-${parts[0].toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)}`,
          });
        } else {
          parsedAccounts.push({
            alias: `Account-${i + 1}`,
            account_id: parts[0],
            api_token: parts[1],
            subdomain: `site-${i + 1}`,
          });
        }
      }
    }

    if (parsedAccounts.length === 0) {
      setError('No valid accounts found. Format: Alias, Account_ID, API_Token, Subdomain');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch(`/api/projects/${project.id}/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ accounts: parsedAccounts }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to add accounts');
      }

      onAccountsAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error saving accounts');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!singleAccountId || !singleApiToken) {
      setError('Account ID and API Token are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch(`/api/projects/${project.id}/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          accounts: [
            {
              alias: singleAlias || 'Cloudflare Account',
              account_id: singleAccountId,
              api_token: singleApiToken,
              email: singleEmail,
              subdomain: singleSubdomain || `sub-${Math.random().toString(36).substring(2, 6)}`,
            },
          ],
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to add account');
      }

      onAccountsAdded();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error saving account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5 text-orange-400" />
            <h2 className="text-xs font-semibold text-slate-100">Add Accounts</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mode Selector */}
        <div className="px-3 pt-2 flex items-center justify-between border-b border-slate-800 pb-1.5">
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            <button
              onClick={() => setMode('bulk')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition ${
                mode === 'bulk'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bulk Paste
            </button>
            <button
              onClick={() => setMode('single')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition ${
                mode === 'single'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Single
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-3 text-xs">
          {error && (
            <div className="mb-2 p-1.5 bg-red-950/50 border border-red-800/50 rounded text-red-200 flex items-center gap-1 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'bulk' ? (
            <div className="space-y-2">
              <div>
                <label className="block text-slate-400 mb-0.5 text-[11px]">
                  Accounts (Alias, Account_ID, API_Token, Subdomain)
                </label>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  rows={5}
                  placeholder={`Account-1, 9a8b7c6d5e4f3a2b1c0d, cf_tok_abc123, sub1\nAccount-2, 1a2b3c4d5e6f7a8b9c0d, cf_tok_xyz789, sub2`}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-2 font-mono text-[10px] text-slate-200 focus:outline-none focus:border-orange-500 placeholder:text-slate-600 leading-relaxed"
                />
              </div>

              <div className="flex justify-end gap-1.5 pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleBulkSubmit}
                  className="px-3 py-1 text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>{isSubmitting ? 'Importing...' : 'Import'}</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSingleSubmit} className="space-y-2">
              <div>
                <label className="block text-slate-400 mb-0.5 text-[11px]">Account Alias</label>
                <input
                  type="text"
                  value={singleAlias}
                  onChange={(e) => setSingleAlias(e.target.value)}
                  placeholder="e.g. Account-01"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <label className="block text-slate-400 mb-0.5 text-[11px]">Account ID *</label>
                  <input
                    type="text"
                    required
                    value={singleAccountId}
                    onChange={(e) => setSingleAccountId(e.target.value)}
                    placeholder="8a39d84f923b..."
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-0.5 text-[11px]">Subdomain *</label>
                  <input
                    type="text"
                    value={singleSubdomain}
                    onChange={(e) => setSingleSubdomain(e.target.value)}
                    placeholder="portal"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-0.5 text-[11px]">API Token *</label>
                <input
                  type="password"
                  required
                  value={singleApiToken}
                  onChange={(e) => setSingleApiToken(e.target.value)}
                  placeholder="API Token"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-xs text-slate-200 focus:outline-none focus:border-orange-500"
                />
              </div>

              {testResult && (
                <div
                  className={`p-1.5 rounded text-[10px] font-mono border ${
                    testResult.valid
                      ? 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300'
                      : 'bg-red-950/60 border-red-800/60 text-red-300'
                  }`}
                >
                  {testResult.message}
                </div>
              )}

              <div className="flex items-center justify-between pt-1 border-t border-slate-800">
                <button
                  type="button"
                  disabled={isTesting || !singleAccountId || !singleApiToken}
                  onClick={handleTestConnection}
                  className="px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-40 rounded transition flex items-center gap-1 border border-slate-700"
                >
                  <Shield className="w-3 h-3 text-orange-400" />
                  <span>{isTesting ? 'Testing...' : 'Test Connection'}</span>
                </button>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 rounded transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-3 py-1 text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isSubmitting ? 'Adding...' : 'Add Account'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
