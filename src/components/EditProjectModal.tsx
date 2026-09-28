import React, { useState, useEffect } from 'react';
import { X, Settings, AlertCircle, Save, Trash2 } from 'lucide-react';
import { Project } from '../types';

interface EditProjectModalProps {
  isOpen: boolean;
  project: Project | null;
  onClose: () => void;
  onProjectUpdated: (updated: Project) => void;
  onDeleteProject: (projectId: string) => void;
}

export const EditProjectModal: React.FC<EditProjectModalProps> = ({
  isOpen,
  project,
  onClose,
  onProjectUpdated,
  onDeleteProject,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDescription(project.description || '');
      setError(null);
    }
  }, [project, isOpen]);

  if (!isOpen || !project) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Project Name cannot be empty');
      return;
    }

    setIsSubmitting(true);
    try {
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: cleanName,
          description: description.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update project');
      }

      const updated = await res.json();
      onProjectUpdated(updated);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error updating project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to permanently delete project "${project.name}" and all associated data?`)) {
      onDeleteProject(project.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-lg shadow-xl overflow-hidden flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
        {/* Header */}
        <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Settings className="w-3.5 h-3.5 text-orange-400" />
            <h2 className="text-xs font-semibold text-slate-100">Project Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-3 space-y-2.5 text-[11px]">
          {error && (
            <div className="p-1.5 bg-red-950/50 border border-red-800/50 rounded text-red-200 flex items-center gap-1 text-[10px] font-mono">
              <AlertCircle className="w-3 h-3 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-slate-400 mb-0.5">Project Name *</label>
            <input
              type="text"
              required
              disabled={isSubmitting}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-0.5">Description</label>
            <textarea
              rows={2}
              disabled={isSubmitting}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-200 focus:outline-none focus:border-orange-500 disabled:opacity-50 resize-none"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="px-2 py-0.5 text-[10px] font-semibold text-red-300 hover:text-red-200 bg-red-950/80 hover:bg-red-900 border border-red-800 rounded transition flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white bg-slate-800 rounded transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3 py-1 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center gap-1"
              >
                <Save className="w-3 h-3" />
                <span>{isSubmitting ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
