import React, { useState, useEffect } from 'react';
import { Shield, Lock, Mail, User as UserIcon, X, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { User } from '../types';
import { useSiteSettings } from '../context/SiteSettingsContext';

interface UserAuthModalProps {
  isOpen: boolean;
  initialMode?: 'login' | 'register';
  onClose: () => void;
  onSuccess: (user: User) => void;
}

export const UserAuthModal: React.FC<UserAuthModalProps> = ({
  isOpen,
  initialMode = 'login',
  onClose,
  onSuccess,
}) => {
  const { siteSettings } = useSiteSettings();
  const [mode, setMode] = useState<'login' | 'register'>(
    !siteSettings.allow_public_registration ? 'login' : initialMode
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Sync mode and reset form fields whenever modal opens or initialMode changes
  useEffect(() => {
    if (isOpen) {
      setMode(!siteSettings.allow_public_registration ? 'login' : initialMode);
      setError(null);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setName('');
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [isOpen, initialMode, siteSettings.allow_public_registration]);

  if (!isOpen) return null;

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

    if (mode === 'register') {
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
      const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const payload = mode === 'register' 
        ? { email: cleanEmail, password, confirmPassword, name: name.trim() } 
        : { email: cleanEmail, password };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (data.token) {
        localStorage.setItem('cf_bulk_token', data.token);
      }

      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-xs w-full p-4 shadow-2xl space-y-3 font-['Plus_Jakarta_Sans',sans-serif]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded bg-orange-600 flex items-center justify-center text-white">
              <Shield className="w-3 h-3" />
            </div>
            <span className="text-xs font-bold text-white">
              {mode === 'login' ? 'Sign In' : 'Create Account'}
            </span>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            disabled={loading}
            className="p-0.5 text-slate-400 hover:text-slate-200 transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Tab switcher */}
        {siteSettings.allow_public_registration ? (
          <div className="flex items-center bg-slate-950 p-0.5 rounded border border-slate-800 text-[11px]">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-1 font-medium rounded transition ${
                mode === 'login'
                  ? 'bg-slate-800 text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-1 font-medium rounded transition ${
                mode === 'register'
                  ? 'bg-slate-800 text-white shadow-xs font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign Up
            </button>
          </div>
        ) : (
          <div className="text-[10px] font-mono text-slate-400 px-2 py-1 bg-slate-950 border border-slate-800 rounded">
            Public registration is currently disabled.
          </div>
        )}

        {error && (
          <div className="p-2 rounded bg-red-950/60 border border-red-800 text-[10px] text-red-300 font-mono">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-2 text-[11px]">
          {mode === 'register' && (
            <div>
              <label className="block text-slate-400 mb-0.5">Name</label>
              <div className="relative">
                <UserIcon className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  disabled={loading}
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded pl-7 pr-2 py-1 text-slate-200 focus:outline-none focus:border-orange-500 disabled:opacity-50"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-slate-400 mb-0.5">Email Address</label>
            <div className="relative">
              <Mail className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                disabled={loading}
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded pl-7 pr-2 py-1 text-slate-200 focus:outline-none focus:border-orange-500 disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-0.5">Password</label>
            <div className="relative">
              <Lock className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={mode === 'register' ? 6 : undefined}
                disabled={loading}
                placeholder={mode === 'register' ? 'Min 6 characters' : '••••••••'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded pl-7 pr-7 py-1 text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-[11px] disabled:opacity-50"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
              >
                {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-slate-400 mb-0.5">Confirm Password</label>
              <div className="relative">
                <Lock className="w-3 h-3 text-slate-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  disabled={loading}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full bg-slate-950 border rounded pl-7 pr-7 py-1 text-slate-200 focus:outline-none font-mono text-[11px] disabled:opacity-50 ${
                    confirmPassword && confirmPassword !== password
                      ? 'border-red-600 focus:border-red-500'
                      : 'border-slate-800 focus:border-orange-500'
                  }`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showConfirmPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-1.5 mt-1 font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span>{loading ? 'Authenticating...' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </form>
      </div>
    </div>
  );
};
