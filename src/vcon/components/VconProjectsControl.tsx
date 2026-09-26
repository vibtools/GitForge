import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Search,
  RefreshCw,
  GitBranch,
  Play,
  Square,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Save,
} from 'lucide-react';
import { AdminProject } from '../types';
import { vconApi } from '../api';

interface VconProjectsControlProps {
  onNotify: (msg: string, isError?: boolean) => void;
}

export const VconProjectsControl: React.FC<VconProjectsControlProps> = ({ onNotify }) => {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [editingProject, setEditingProject] = useState<AdminProject | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    github_repo: '',
    github_branch: 'main',
    github_token: '',
    build_command: 'npm run build',
    output_dir: 'dist',
    root_domain: '',
    subdomain_pattern: 'sub-{index}',
  });

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await vconApi.getProjects();
      setProjects(data);
    } catch (err: any) {
      onNotify(err.message || 'Failed to load projects', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleEditClick = (p: AdminProject) => {
    setEditingProject(p);
    setFormData({
      name: p.name,
      description: p.description || '',
      github_repo: p.github_repo,
      github_branch: p.github_branch || 'main',
      github_token: p.github_token || '',
      build_command: p.build_command || 'npm run build',
      output_dir: p.output_dir || 'dist',
      root_domain: p.root_domain,
      subdomain_pattern: p.subdomain_pattern || 'sub-{index}',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    try {
      await vconApi.updateProject(editingProject.id, formData);
      onNotify(`Project updated.`);
      setEditingProject(null);
      loadProjects();
    } catch (err: any) {
      onNotify(err.message || 'Update failed', true);
    }
  };

  const handleSyncCommit = async (id: string) => {
    try {
      setSyncingId(id);
      const res = await vconApi.syncRepoCommit(id);
      onNotify(`Synced: [${res.commit.sha}] ${res.commit.message}`);
      loadProjects();
    } catch (err: any) {
      onNotify(err.message || 'Sync failed', true);
    } finally {
      setSyncingId(null);
    }
  };

  const handleTriggerBuild = async (id: string, name: string) => {
    try {
      await vconApi.triggerProjectBuild(id);
      onNotify(`Build started: ${name}`);
      loadProjects();
    } catch (err: any) {
      onNotify(err.message || 'Build trigger failed', true);
    }
  };

  const handleCancelBuild = async (id: string, name: string) => {
    try {
      await vconApi.cancelProjectBuild(id);
      onNotify(`Build canceled: ${name}`);
      loadProjects();
    } catch (err: any) {
      onNotify(err.message || 'Cancel failed', true);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!window.confirm(`Delete project "${name}" and all records?`)) return;
    try {
      setDeletingId(id);
      await vconApi.deleteProject(id);
      onNotify(`Project deleted.`);
      loadProjects();
    } catch (err: any) {
      onNotify(err.message || 'Delete failed', true);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.github_repo.toLowerCase().includes(search.toLowerCase()) ||
      p.root_domain.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-2.5">
      {/* Action Header */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
        <div className="flex items-center gap-1.5">
          <FolderGit2 className="w-4 h-4 text-orange-400" />
          <span className="font-bold text-white">Projects ({projects.length})</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="w-3 h-3 text-slate-400 absolute left-2 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-[11px] text-slate-200 pl-6 pr-2 py-0.5 rounded focus:outline-none focus:border-orange-500 w-36 sm:w-48"
            />
          </div>

          <button
            onClick={loadProjects}
            disabled={loading}
            className="p-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded border border-slate-700 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Projects Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-950/80 text-[10px] font-mono uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2 px-2.5">Project / Repo</th>
                <th className="py-2 px-2.5">Domain</th>
                <th className="py-2 px-2.5">Commit</th>
                <th className="py-2 px-2.5 text-center">Accounts</th>
                <th className="py-2 px-2.5 text-center">Status</th>
                <th className="py-2 px-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-400">
                    {loading ? 'Loading...' : 'No projects found.'}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-800/30 transition">
                    {/* Project & Repo */}
                    <td className="py-2 px-2.5">
                      <div className="font-semibold text-slate-200">{p.name}</div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <GitBranch className="w-2.5 h-2.5 text-orange-400 shrink-0" />
                        <span className="truncate max-w-[150px]">{p.github_repo.replace('https://github.com/', '')}</span>
                        <span className="px-1 rounded bg-slate-800 text-slate-300">{p.github_branch}</span>
                      </div>
                    </td>

                    {/* Domain */}
                    <td className="py-2 px-2.5">
                      <div className="text-slate-200">{p.root_domain}</div>
                      <div className="text-[10px] text-slate-400">{p.subdomain_pattern}</div>
                    </td>

                    {/* Commit SHA */}
                    <td className="py-2 px-2.5">
                      <div className="flex items-center gap-1">
                        <span className="px-1 py-0.2 rounded bg-slate-950 border border-slate-800 text-orange-400 font-bold text-[10px]">
                          {p.latest_commit_sha || 'HEAD'}
                        </span>
                        <button
                          onClick={() => handleSyncCommit(p.id)}
                          disabled={syncingId === p.id}
                          className="p-0.5 text-slate-400 hover:text-slate-200"
                          title="Sync"
                        >
                          <RefreshCw className={`w-2.5 h-2.5 ${syncingId === p.id ? 'animate-spin text-orange-400' : ''}`} />
                        </button>
                      </div>
                    </td>

                    {/* Accounts */}
                    <td className="py-2 px-2.5 text-center">
                      <div className="font-bold text-slate-200">{p.account_count}</div>
                      <div className="text-[10px] text-slate-400">
                        <span className="text-emerald-400">{p.success_count}</span>/<span className="text-red-400">{p.failed_count}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-2 px-2.5 text-center">
                      {p.is_building ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-950 text-blue-300 border border-blue-700/60 animate-pulse">
                          BUILDING
                        </span>
                      ) : p.failed_count > 0 ? (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-red-950 text-red-300 border border-red-800/60">
                          ERRORS
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/60">
                          OK
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.is_building ? (
                          <button
                            onClick={() => handleCancelBuild(p.id, p.name)}
                            className="p-1 text-red-300 hover:text-white bg-red-950/80 hover:bg-red-900 border border-red-800 rounded transition"
                            title="Stop"
                          >
                            <Square className="w-3 h-3 text-red-400" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleTriggerBuild(p.id, p.name)}
                            className="p-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition"
                            title="Build"
                          >
                            <Play className="w-3 h-3 text-emerald-400" />
                          </button>
                        )}

                        <button
                          onClick={() => handleEditClick(p)}
                          className="p-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition"
                          title="Edit"
                        >
                          <Edit2 className="w-3 h-3 text-sky-400" />
                        </button>

                        <button
                          onClick={() => handleDeleteProject(p.id, p.name)}
                          disabled={deletingId === p.id}
                          className="p-1 text-red-400 hover:text-white hover:bg-red-950 rounded transition"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75">
          <div className="bg-slate-900 border border-slate-800 rounded-lg max-w-md w-full p-3.5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Edit2 className="w-3.5 h-3.5 text-orange-400" />
                <span>Edit Project</span>
              </span>
              <button onClick={() => setEditingProject(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-2 text-[11px]">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-0.5">Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-0.5">Root Domain</label>
                  <input
                    type="text"
                    required
                    value={formData.root_domain}
                    onChange={(e) => setFormData({ ...formData, root_domain: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-slate-400 mb-0.5">GitHub Repo</label>
                  <input
                    type="text"
                    required
                    value={formData.github_repo}
                    onChange={(e) => setFormData({ ...formData, github_repo: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-0.5">Branch</label>
                  <input
                    type="text"
                    required
                    value={formData.github_branch}
                    onChange={(e) => setFormData({ ...formData, github_branch: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-0.5">Build Command</label>
                  <input
                    type="text"
                    value={formData.build_command}
                    onChange={(e) => setFormData({ ...formData, build_command: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-0.5">Output Dir</label>
                  <input
                    type="text"
                    value={formData.output_dir}
                    onChange={(e) => setFormData({ ...formData, output_dir: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-orange-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-0.5">Subdomain Pattern</label>
                <input
                  type="text"
                  value={formData.subdomain_pattern}
                  onChange={(e) => setFormData({ ...formData, subdomain_pattern: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-slate-200 focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="px-2.5 py-1 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded transition flex items-center gap-1"
                >
                  <Save className="w-3 h-3" />
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
