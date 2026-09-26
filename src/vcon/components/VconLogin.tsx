import React, { useState } from 'react';
import { ShieldAlert, Lock, Mail, ArrowRight, ArrowLeft } from 'lucide-react';
import { AdminUser } from '../types';
import { vconApi } from '../api';

interface VconLoginProps {
  onLoginSuccess: (user: AdminUser) => void;
  onExit: () => void;
}

export const VconLogin: React.FC<VconLoginProps> = ({ onLoginSuccess, onExit }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await vconApi.loginAdmin({ email, password });
      if (res.token) {
        localStorage.setItem('cf_bulk_token', res.token);
      }
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Authentication failed: Invalid credentials or insufficient privileges.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-3 font-['Plus_Jakarta_Sans',sans-serif]">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-xs w-full p-4 shadow-2xl space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-red-600 to-orange-600 flex items-center justify-center text-white shrink-0 shadow-md">
              <ShieldAlert className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white uppercase tracking-wider block">vCon Security</span>
              <span className="text-[9px] font-mono text-slate-400">Restricted Console</span>
            </div>
          </div>
          <button
            onClick={onExit}
            className="text-[10px] text-slate-400 hover:text-slate-200 transition flex items-center gap-0.5"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>App</span>
          </button>
        </div>

        {error && (
          <div className="p-2 rounded bg-red-950/60 border border-red-800 text-[10px] text-red-300 font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2 text-[11px]">
          <div>
            <label className="block text-slate-400 mb-0.5">Admin Email</label>
            <div className="relative">
              <Mail className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="admin@system.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded pl-7 pr-2 py-1 text-slate-200 focus:outline-none focus:border-orange-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-0.5">Secure Password</label>
            <div className="relative">
              <Lock className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded pl-7 pr-2 py-1 text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-[11px]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-1.5 mt-2 font-bold text-white bg-orange-600 hover:bg-orange-500 rounded transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>{loading ? 'Authenticating...' : 'Unlock vCon Console'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </form>
      </div>
    </div>
  );
};
