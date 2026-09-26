import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Key,
  Trash2,
  RefreshCw,
  LogOut,
  X,
  Save,
  Clock,
} from 'lucide-react';
import { AdminUser, AdminSession } from '../types';
import { vconApi } from '../api';

interface VconUsersControlProps {
  onNotify: (msg: string, isError?: boolean) => void;
}

export const VconUsersControl: React.FC<VconUsersControlProps> = ({ onNotify }) => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(false);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'admin',
  });

  // Edit Modal
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'admin',
    newPassword: '',
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [u, s] = await Promise.all([vconApi.getUsers(), vconApi.getSessions()]);
      setUsers(u);
      setSessions(s);
    } catch (err: any) {
      onNotify(err.message || 'Failed to load users', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await vconApi.createUser(createForm);
      onNotify(`User created.`);
      setIsCreateOpen(false);
      setCreateForm({ name: '', email: '', password: '', role: 'admin' });
      loadData();
    } catch (err: any) {
      onNotify(err.message || 'Failed to create user', true);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await vconApi.updateUser(editingUser.id, {
        name: editForm.name,
        role: editForm.role,
        password: editForm.newPassword || undefined,
      });
      onNotify(`User updated.`);
      setEditingUser(null);
      loadData();
    } catch (err: any) {
      onNotify(err.message || 'Update failed', true);
    }
  };

  const handleDeleteUser = async (u: AdminUser) => {
    if (!window.confirm(`Delete user "${u.email}"?`)) return;
    try {
      await vconApi.deleteUser(u.id);
      onNotify(`User deleted.`);
      loadData();
    } catch (err: any) {
      onNotify(err.message || 'Delete failed', true);
    }
  };

  const handleRevokeSession = async (token: string) => {
    try {
      await vconApi.revokeSession(token);
      onNotify('Session revoked.');
      loadData();
    } catch (err: any) {
      onNotify(err.message || 'Failed to revoke session', true);
    }
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-indigo-400" />
          <span className="font-bold text-white">Users & Access</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-2 py-0.5 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition flex items-center gap-1"
          >
            <UserPlus className="w-3 h-3" />
            <span>New User</span>
          </button>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-2 border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold text-white flex items-center gap-1.5">
          <Shield className="w-3 h-3 text-indigo-400" />
          <span>Accounts ({users.length})</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-950/80 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2 px-2.5">Name & Email</th>
                <th className="py-2 px-2.5">Role</th>
                <th className="py-2 px-2.5 text-center">Sessions</th>
                <th className="py-2 px-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-2 px-2.5">
                    <div className="font-semibold text-slate-200">{u.name}</div>
                    <div className="text-[10px] text-slate-400">{u.email}</div>
                  </td>
                  <td className="py-2 px-2.5">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase ${
                        u.role === 'admin'
                          ? 'bg-orange-950 text-orange-400 border-orange-800'
                          : 'bg-slate-800 text-slate-300 border-slate-700'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-2 px-2.5 text-center">
                    {u.active_sessions > 0 ? (
                      <span className="text-emerald-400 font-bold">{u.active_sessions}</span>
                    ) : (
                      <span className="text-slate-400">0</span>
                    )}
                  </td>
                  <td className="py-2 px-2.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => {
                          setEditingUser(u);
                          setEditForm({ name: u.name, role: u.role, newPassword: '' });
                        }}
                        className="p-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition"
                        title="Edit / Reset Password"
                      >
                        <Key className="w-2.5 h-2.5 text-amber-400" />
                      </button>

                      <button
                        onClick={() => handleDeleteUser(u)}
                        className="p-1 text-red-400 hover:text-white hover:bg-red-950 rounded transition"
                        title="Delete"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sessions Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-2 border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold text-white flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-sky-400" />
          <span>Active Sessions ({sessions.length})</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px] font-mono">
            <thead className="bg-slate-950/80 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-1.5 px-2.5">Token</th>
                <th className="py-1.5 px-2.5">User</th>
                <th className="py-1.5 px-2.5">Expires</th>
                <th className="py-1.5 px-2.5 text-right">Revoke</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-[10px]">
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-slate-400">
                    No active sessions.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => (
                  <tr key={s.token} className="hover:bg-slate-800/30">
                    <td className="py-1.5 px-2.5 text-slate-300">
                      <code>{s.token.slice(0, 8)}••</code>
                    </td>
                    <td className="py-1.5 px-2.5 text-slate-200">{s.email}</td>
                    <td className="py-1.5 px-2.5 text-slate-400">
                      {new Date(s.expires_at).toLocaleTimeString()}
                    </td>
                    <td className="py-1.5 px-2.5 text-right">
                      <button
                        onClick={() => handleRevokeSession(s.token)}
                        className="p-0.5 text-red-400 hover:text-white hover:bg-red-950 rounded"
                        title="Revoke"
                      >
                        <LogOut className="w-2.5 h-2.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-sm w-full p-3.5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
                <span>New User</span>
              </span>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-2 text-[11px]">
              <div>
                <label className="block text-slate-400 mb-0.5">Name</label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-0.5">Email</label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-0.5">Password</label>
                <input
                  type="password"
                  required
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-0.5">Role</label>
                <select
                  value={createForm.role}
                  onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-2.5 py-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded transition flex items-center gap-1"
                >
                  <Save className="w-3 h-3" />
                  <span>Create</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-sm w-full p-3.5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>Edit: {editingUser.email}</span>
              </span>
              <button onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-2 text-[11px]">
              <div>
                <label className="block text-slate-400 mb-0.5">Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-0.5">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-0.5">New Password (optional)</label>
                <input
                  type="password"
                  placeholder="Leave empty to keep"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-2.5 py-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded transition flex items-center gap-1"
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
