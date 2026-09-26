import React, { useState } from 'react';
import { X, GitBranch, Globe, FolderGit2, AlertCircle, Sparkles } from 'lucide-react';
import { Project } from '../types';

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

export const AddProjectModal: React.FC<AddProjectModalProps> = ({
  isOpen,
  onClose,
  onProjectCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [githubRepo, setGithubRepo] = useState('');
  const [githubBranch, setGithubBranch] = useState('main');
  const [buildCommand, setBuildCommand] = useState('npm run build');
  const [outputDir, setOutputDir] = useState('dist');
  const [rootDomain, setRootDomain] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !githubRepo.trim() || !rootDomain.trim()) {
      setError('Name, GitHub Repo URL, and Root Domain are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          github_repo: githubRepo.trim(),
          github_branch: githubBranch.trim() || 'main',
          build_command: buildCommand.trim() || 'npm run build',
          output_dir: outputDir.trim() || 'dist',
          root_domain: rootDomain.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create project');
      }

      const created = await res.json();
      onProjectCreated(created);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-lg shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <FolderGit2 className="w-3.5 h-3.5 text-orange-400" />
            <h2 className="text-xs font-semibold text-slate-100">New Project</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-3 space-y-2 text-xs">
          {error && (
            <div className="p-1.5 bg-red-950/50 border border-red-800/50 rounded text-red-200 flex items-center gap-1 text-[11px]">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-400 mb-0.5 text-[11px]">Project Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My-Pages-App"
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-orange-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-1.5">
            <div className="col-span-2">
              <label className="block text-slate-400 mb-0.5 text-[11px]">GitHub Repo URL *</label>
              <input
                type="text"
                required
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-slate-200 focus:outline-none focus:border-orange-500 text-[11px]"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-0.5 text-[11px]">Branch</label>
              <input
                type="text"
                value={githubBranch}
                onChange={(e) => setGithubBranch(e.target.value)}
                placeholder="main"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-slate-200 focus:outline-none focus:border-orange-500 text-[11px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-0.5 text-[11px]">Root Domain *</label>
            <input
              type="text"
              required
              value={rootDomain}
              onChange={(e) => setRootDomain(e.target.value)}
              placeholder="e.g. mydomain.com"
              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-slate-200 focus:outline-none focus:border-orange-500 text-[11px]"
            />
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <label className="block text-slate-400 mb-0.5 text-[10px]">Build Command</label>
              <input
                type="text"
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                placeholder="npm run build"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-slate-200 focus:outline-none focus:border-orange-500 text-[10px]"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-0.5 text-[10px]">Output Dir</label>
              <input
                type="text"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                placeholder="dist"
                className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 font-mono text-slate-200 focus:outline-none focus:border-orange-500 text-[10px]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-1.5 pt-2 border-t border-slate-800">
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
              className="px-3 py-1 text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition"
            >
              {isSubmitting ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
