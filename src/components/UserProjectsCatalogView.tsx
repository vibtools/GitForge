import React, { useState } from 'react';
import {
  FolderGit2,
  Plus,
  GitBranch,
  Globe,
  Cloud,
  Settings,
  ArrowRight,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Project } from '../types';
import { EditProjectModal } from './EditProjectModal';

interface UserProjectsCatalogViewProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (p: Project) => void;
  onOpenNewProject: () => void;
  onOpenProjectWorkplace: (p: Project) => void;
  onProjectUpdated: (updated: Project) => void;
  onDeleteProject: (projectId: string) => void;
}

export const UserProjectsCatalogView: React.FC<UserProjectsCatalogViewProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onOpenNewProject,
  onOpenProjectWorkplace,
  onProjectUpdated,
  onDeleteProject,
}) => {
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  return (
    <div className="w-full max-w-5xl mx-auto space-y-3 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
            <FolderGit2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-slate-100">Projects</h1>
            <span className="text-[10px] font-mono text-slate-400">
              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
            </span>
          </div>
        </div>

        <button
          onClick={onOpenNewProject}
          className="px-2.5 py-1 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded transition flex items-center gap-1 shadow-xs cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects List */}
      {projects.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center space-y-2.5">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500 mx-auto">
            <FolderGit2 className="w-5 h-5 text-orange-400" />
          </div>
          <div className="text-xs font-bold text-slate-200">No Projects Found</div>
          <button
            onClick={onOpenNewProject}
            className="px-3 py-1 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded transition inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Project</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {projects.map((proj) => {
            const isSelected = activeProject?.id === proj.id;
            const hasRepo = Boolean(proj.github_repo && proj.github_repo.trim());

            return (
              <div
                key={proj.id}
                onClick={() => {
                  onSelectProject(proj);
                  onOpenProjectWorkplace(proj);
                }}
                className={`bg-slate-900 border rounded-lg p-3 space-y-2.5 transition cursor-pointer group flex flex-col justify-between hover:border-slate-700 ${
                  isSelected ? 'border-orange-500/50 bg-slate-900/90' : 'border-slate-800'
                }`}
              >
                {/* Top: Name, Status & Settings Gear */}
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-100 group-hover:text-orange-400 transition truncate">
                          {proj.name}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-mono text-orange-400 bg-orange-950/80 border border-orange-800/80 px-1 py-0.2 rounded shrink-0">
                            Active
                          </span>
                        )}
                      </div>
                      {proj.description ? (
                        <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                          {proj.description}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-500 italic mt-0.5">No description</p>
                      )}
                    </div>

                    {/* Settings Gear Icon */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProject(proj);
                      }}
                      className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition shrink-0"
                      title="Project Settings"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Middle info */}
                <div className="space-y-1.5">
                  <div className="bg-slate-950 border border-slate-800/80 rounded p-1.5 text-[10px] font-mono space-y-1 text-slate-300">
                    <div className="flex items-center justify-between gap-1 truncate">
                      <div className="flex items-center gap-1 truncate text-slate-400">
                        <GitBranch className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">
                          {hasRepo ? proj.github_repo.replace('https://github.com/', '') : 'No repo connected'}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1 py-0.2 rounded shrink-0 ${
                          hasRepo
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {hasRepo ? (proj.github_branch || 'main') : 'Setup Repo'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-900">
                      <div className="flex items-center gap-1 truncate">
                        <Globe className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span className="truncate">{proj.root_domain || 'No domain'}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 text-sky-400">
                        <Cloud className="w-3 h-3" />
                        <span>{proj.account_count || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Workplace Entry Action */}
                <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="font-mono text-slate-500">
                    {new Date(proj.created_at).toLocaleDateString()}
                  </span>

                  <div className="flex items-center gap-1 text-orange-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                    <span>{hasRepo ? 'Open Workplace' : 'Setup & Scan'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Project Modal */}
      <EditProjectModal
        isOpen={Boolean(editingProject)}
        project={editingProject}
        onClose={() => setEditingProject(null)}
        onProjectUpdated={(updated) => {
          onProjectUpdated(updated);
          setEditingProject(null);
        }}
        onDeleteProject={(id) => {
          onDeleteProject(id);
          setEditingProject(null);
        }}
      />
    </div>
  );
};
