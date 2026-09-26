import React, { useState } from 'react';
import { User as UserIcon, Lock, ShieldCheck, Save, Key, Settings } from 'lucide-react';
import { User } from '../types';

interface UserProfileSettingsViewProps {
  user: User | null;
  onUpdateUser: (updated: Partial<User>) => void;
  onNotify: (msg: string, isError?: boolean) => void;
}

export const UserProfileSettingsView: React.FC<UserProfileSettingsViewProps> = ({
  user,
  onUpdateUser,
  onNotify,
}) => {
  const [name, setName] = useState(user?.name || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onNotify('Name cannot be empty', true);
      return;
    }

    try {
      setIsUpdatingProfile(true);
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      onUpdateUser({ name: name.trim() });
      onNotify('Profile updated.');
    } catch (err: any) {
      onNotify(err.message || 'Profile update failed', true);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      onNotify('Enter current and new password', true);
      return;
    }

    if (newPassword.length < 6) {
      onNotify('New password must be at least 6 characters', true);
      return;
    }

    if (newPassword !== confirmPassword) {
      onNotify('New passwords do not match', true);
      return;
    }

    try {
      setIsChangingPassword(true);
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password');
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onNotify('Password updated.');
    } catch (err: any) {
      onNotify(err.message || 'Password change failed', true);
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-3">
      {/* Settings Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-100">
          <Settings className="w-3.5 h-3.5 text-orange-400" />
          <span>Account & Security Settings</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          {user?.email || 'User'}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Account Details Card */}
        <form
          onSubmit={handleSaveProfile}
          className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2.5 flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-xs font-bold text-slate-200">
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Profile Details</span>
              </div>
              <span className="text-[9px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded border border-slate-700">
                Active
              </span>
            </div>

            <div className="space-y-2 text-[11px]">
              <div>
                <label className="block text-slate-400 mb-0.5 font-medium">Email Address</label>
                <input
                  type="email"
                  disabled
                  value={user?.email || ''}
                  className="w-full bg-slate-950/60 border border-slate-800 rounded px-2.5 py-1 text-slate-400 font-mono text-[11px] cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-0.5 font-medium">Display Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[10px] font-mono mt-2">
            <span className="text-slate-400">ID: {user?.id || '—'}</span>
            <button
              type="submit"
              disabled={isUpdatingProfile}
              className="px-3 py-1 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded transition flex items-center gap-1 shadow-xs"
            >
              <Save className="w-3 h-3" />
              <span>{isUpdatingProfile ? 'Saving...' : 'Save Profile'}</span>
            </button>
          </div>
        </form>

        {/* Password Change Card */}
        <form
          onSubmit={handleChangePassword}
          className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2.5 flex flex-col justify-between"
        >
          <div className="space-y-2.5">
            <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5 text-xs font-bold text-slate-200">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Security & Password</span>
            </div>

            <div className="space-y-2 text-[11px]">
              <div>
                <label className="block text-slate-300 mb-0.5 font-medium">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-0.5 font-medium">New Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 chars"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-0.5 font-medium">Confirm Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm"
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-800 mt-2">
            <button
              type="submit"
              disabled={isChangingPassword}
              className="px-3 py-1 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded transition flex items-center gap-1 shadow-xs"
            >
              <Lock className="w-3 h-3" />
              <span>{isChangingPassword ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
