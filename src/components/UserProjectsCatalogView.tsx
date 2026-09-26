import React from 'react';
import {
  FolderGit2,
  Plus,
  GitBranch,
  Globe,
  Cloud,
  Trash2,
  Layers,
  Upload,
} from 'lucide-react';
import { Project } from '../types';

interface UserProjectsCatalogViewProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (p: Project) => void;
  onOpenNewProject: () => void;
  onOpenBulkAccounts: (p: Project) => void;
  onGoToBuilder: (p: Project) => void;
  onDeleteProject: (projectId: string) => void;
}

export const UserProjectsCatalogView: React.FC<UserProjectsCatalogViewProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onOpenNewProject,
  onOpenBulkAccounts,
  onGoToBuilder,
  onDeleteProject,
}) => {
  return (
    <div className="w-full max-w-5xl mx-auto space-y-2.5">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-bold text-slate-100">
          <FolderGit2 className="w-3.5 h-3.5 text-orange-400" />
          <span>Projects Catalog</span>
        </div>

        <button
          onClick={onOpenNewProject}
          className="px-2.5 py-0.5 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded transition flex items-center gap-1"
        >
          <Plus className="w-3 h-3" />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects List */}
      {projects.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center space-y-2">
          <FolderGit2 className="w-6 h-6 text-slate-600 mx-auto" />
          <div className="text-xs font-bold text-slate-200">No Projects</div>
          <button
            onClick={onOpenNewProject}
            className="px-2.5 py-0.5 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded transition inline-flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>Create Project</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {projects.map((proj) => {
            const isSelected = activeProject?.id === proj.id;

            return (
              <div
                key={proj.id}
                className={`bg-slate-900 border rounded-lg p-2.5 space-y-2 transition ${
                  isSelected
                    ? 'border-orange-500/50'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="truncate min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100 truncate">
                      <span>{proj.name}</span>
                      {isSelected && (
                        <span className="text-[9px] font-mono text-orange-400 bg-orange-950/80 border border-orange-800/80 px-1 py-0.2 rounded">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 truncate flex items-center gap-1">
                      <GitBranch className="w-2.5 h-2.5 text-slate-500" />
                      <span>{proj.github_repo} ({proj.github_branch || 'main'})</span>
                    </div>
                  </div>

                  <span
                    className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded shrink-0 ${
                      proj.status === 'completed'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : proj.status === 'building'
                        ? 'bg-blue-950 text-blue-300 border border-blue-700 animate-pulse'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {proj.status || 'ready'}
                  </span>
                </div>

                {/* Details */}
                <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono bg-slate-950/80 border border-slate-800 rounded p-1.5 text-slate-300">
                  <div className="flex items-center gap-1 truncate">
                    <Globe className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="truncate">{proj.root_domain}</span>
                  </div>

                  <div className="flex items-center gap-1 truncate">
                    <Cloud className="w-3 h-3 text-sky-400 shrink-0" />
                    <span>{proj.account_count || 0} Accounts</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[11px]">
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete project "${proj.name}"?`)) {
                        onDeleteProject(proj.id);
                      }
                    }}
                    className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition"
                    title="Delete Project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        onSelectProject(proj);
                        onOpenBulkAccounts(proj);
                      }}
                      className="px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition flex items-center gap-1"
                    >
                      <Upload className="w-2.5 h-2.5 text-orange-400" />
                      <span>Add Accounts</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectProject(proj);
                        onGoToBuilder(proj);
                      }}
                      className="px-2.5 py-0.5 text-[10px] font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded transition flex items-center gap-1"
                    >
                      <Layers className="w-2.5 h-2.5" />
                      <span>Open Builder</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
