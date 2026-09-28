import React, { useState, useEffect } from 'react';
import { X, Plus, Upload, CheckCircle2, Shield, AlertCircle, Cloud, Sparkles, ExternalLink, RefreshCw } from 'lucide-react';
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
  const [mode, setMode] = useState<'oauth' | 'bulk' | 'single'>('oauth');
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

  // Cloudflare OAuth State
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);
  const [isOAuthConfigured, setIsOAuthConfigured] = useState<boolean | null>(null);

  // Check if admin has configured Cloudflare OAuth App
  useEffect(() => {
    if (isOpen) {
      fetch('/api/auth/cloudflare/config-status')
        .then((r) => r.json())
        .then((data) => {
          setIsOAuthConfigured(Boolean(data.configured));
          if (!data.configured) {
            setMode('bulk');
          }
        })
        .catch(() => {
          setIsOAuthConfigured(false);
        });
    }
  }, [isOpen]);

  // Listen for OAuth postMessage from popup window
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'CF_OAUTH_SUCCESS') {
        setIsConnectingOAuth(false);
        onAccountsAdded();
        onClose();
      } else if (event.data?.type === 'CF_OAUTH_ERROR') {
        setIsConnectingOAuth(false);
        setError(event.data.error || 'Cloudflare authorization failed.');
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [onAccountsAdded, onClose]);

  const handleConnectCloudflareOAuth = async () => {
    setError(null);
    setIsConnectingOAuth(true);
    try {
      if (!project) return;
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch(`/api/auth/cloudflare/url?project_id=${project.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error || 'Cloudflare OAuth App is not configured. Administrator must set OAuth Client ID and Secret in /vcon Settings.'
        );
      }

      const data = await res.json();
      if (!data.url) throw new Error('Authorization URL missing');

      // Open OAuth provider directly in popup window
      const popup = window.open(
        data.url,
        'cf_oauth_popup',
        'width=600,height=750,menubar=no,status=no,toolbar=no,scrollbars=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked by browser. Please enable popups for this site to connect Cloudflare.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to open Cloudflare authorization popup');
      setIsConnectingOAuth(false);
    }
  };

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
              onClick={() => setMode('oauth')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition flex items-center gap-1 cursor-pointer ${
                mode === 'oauth'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cloud className="w-3 h-3 text-orange-400" />
              <span>1-Click OAuth</span>
            </button>
            <button
              onClick={() => setMode('bulk')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition cursor-pointer ${
                mode === 'bulk'
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Bulk Paste
            </button>
            <button
              onClick={() => setMode('single')}
              className={`px-2 py-0.5 text-[11px] font-medium rounded transition cursor-pointer ${
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

          {mode === 'oauth' ? (
            <div className="space-y-3 py-1">
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-orange-600/15 border border-orange-500/30 flex items-center justify-center text-orange-400 mx-auto">
                  <Cloud className="w-5 h-5" />
                </div>

                <div className="space-y-0.5">
                  <div className="text-xs font-bold text-slate-100">
                    Connect Cloudflare Account
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Authenticate via official Cloudflare authorization popup. Grants secure Pages &amp; DNS management access automatically.
                  </p>
                </div>

                {isOAuthConfigured === false && (
                  <div className="p-2 bg-amber-950/40 border border-amber-800/60 rounded text-amber-300 text-[10px] text-left flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">OAuth App Not Configured:</span> The administrator has not configured Cloudflare Auth App credentials in <strong>vCon Settings</strong> yet. You can use <strong>Bulk Paste</strong> or <strong>Single</strong> token.
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleConnectCloudflareOAuth}
                    disabled={isConnectingOAuth || isOAuthConfigured === false}
                    className="w-full py-2 px-3 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-98"
                  >
                    {isConnectingOAuth ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Awaiting Cloudflare Authorization...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Connect with Cloudflare (Open Popup)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] text-slate-500 px-1 font-mono">
                <span>Official Cloudflare OAuth 2.0 Handshake</span>
                <span className="text-emerald-400">Zero-Paste Setup</span>
              </div>

              <div className="flex justify-end pt-1 border-t border-slate-800">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-2.5 py-1 text-xs text-slate-400 hover:text-white bg-slate-800 rounded transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : mode === 'bulk' ? (
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
