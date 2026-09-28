import React, { useState } from 'react';
import { Lock, Mail, User as UserIcon, Shield, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { User } from '../types';

interface LoginViewProps {
  onLoginSuccess: (user: User, token: string) => void;
  hasUsers: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, hasUsers }) => {
  const [isRegister, setIsRegister] = useState(!hasUsers);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      return;
    }

    if (isRegister) {
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please check again.');
        return;
      }
    }

    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister 
        ? { email: cleanEmail, password, confirmPassword, name: name.trim() } 
        : { email: cleanEmail, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (data.token) {
        localStorage.setItem('cf_bulk_token', data.token);
      }
      onLoginSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-lg p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <h1 className="text-xs font-semibold text-slate-100">
            {isRegister ? 'Create Account' : 'Sign In'}
          </h1>
        </div>

        {error && (
          <div className="mb-2.5 p-1.5 bg-red-950/60 border border-red-800/60 rounded text-[11px] text-red-300 font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2 text-xs">
          {isRegister && (
            <div>
              <label className="block text-slate-400 text-[11px] mb-0.5">Name</label>
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded px-2 py-1 focus-within:border-orange-500">
                <UserIcon className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
                <input
                  type="text"
                  required
                  disabled={loading}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full bg-transparent text-slate-200 focus:outline-none text-xs disabled:opacity-50"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-400 text-[11px] mb-0.5">Email</label>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded px-2 py-1 focus-within:border-orange-500">
              <Mail className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
              <input
                type="email"
                required
                disabled={loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-transparent text-slate-200 focus:outline-none text-xs disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-[11px] mb-0.5">Password</label>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded px-2 py-1 focus-within:border-orange-500 relative">
              <Shield className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={isRegister ? 6 : undefined}
                disabled={loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegister ? 'Min 6 characters' : '••••••••'}
                className="w-full bg-transparent text-slate-200 focus:outline-none text-xs font-mono pr-5 disabled:opacity-50"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-500 hover:text-slate-300 transition shrink-0 ml-1"
              >
                {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-slate-400 text-[11px] mb-0.5">Confirm Password</label>
              <div className={`flex items-center bg-slate-950 border rounded px-2 py-1 relative ${
                confirmPassword && confirmPassword !== password
                  ? 'border-red-600 focus-within:border-red-500'
                  : 'border-slate-800 focus-within:border-orange-500'
              }`}>
                <Shield className="w-3.5 h-3.5 text-slate-500 mr-1.5 shrink-0" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  disabled={loading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-transparent text-slate-200 focus:outline-none text-xs font-mono pr-5 disabled:opacity-50"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-slate-500 hover:text-slate-300 transition shrink-0 ml-1"
                >
                  {showConfirmPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-1.5 text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center justify-center gap-1"
          >
            <span>{loading ? 'Authenticating...' : isRegister ? 'Create Account' : 'Sign In'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </form>

        <div className="mt-3 pt-2 border-t border-slate-800 text-center">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
              setShowPassword(false);
            }}
            className="text-[11px] text-slate-400 hover:text-slate-200 transition disabled:opacity-50"
          >
            {isRegister ? 'Already registered? Sign In' : 'Create new account'}
          </button>
        </div>
      </div>
    </div>
  );
};
