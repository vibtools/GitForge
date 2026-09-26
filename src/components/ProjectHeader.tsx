import React from 'react';
import {
  FolderGit2,
  GitBranch,
  GitCommit,
  Globe,
  RefreshCw,
  ExternalLink,
  Layers,
  CheckCircle2,
  Clock,
  Settings,
  XCircle,
} from 'lucide-react';
import { Project, Account } from '../types';

interface ProjectHeaderProps {
  project: Project;
  accounts: Account[];
  isBuilding: boolean;
  onRebuildAll: () => void;
  onOpenBulkAccounts: () => void;
  onCancelBuild?: () => void;
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project,
  accounts,
  isBuilding,
  onRebuildAll,
  onOpenBulkAccounts,
  onCancelBuild,
}) => {
  const successCount = accounts.filter((a) => a.build_status === 'success').length;

  return (
    <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 mb-3 space-y-2">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
        <div className="flex items-center gap-2">
          <h1 className="text-xs font-semibold text-slate-100 tracking-tight">{project.name}</h1>
          <span
            className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${
              isBuilding
                ? 'bg-amber-950/50 text-amber-400/90 border-amber-800/50'
                : project.status === 'completed'
                ? 'bg-emerald-950/50 text-emerald-400/90 border-emerald-800/50'
                : 'bg-slate-800/80 text-slate-400 border-slate-700/60'
            }`}
          >
            {isBuilding ? 'BUILDING' : project.status.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {isBuilding && onCancelBuild && (
            <button
              onClick={onCancelBuild}
              className="px-2.5 py-1 text-xs font-medium text-rose-300 hover:text-white bg-rose-950/60 hover:bg-rose-900/80 border border-rose-800/60 rounded transition flex items-center gap-1 active:scale-95"
              title="Cancel current build"
            >
              <XCircle className="w-3 h-3 text-rose-400" />
              <span>Cancel Build</span>
            </button>
          )}

          <button
            onClick={onRebuildAll}
            disabled={isBuilding || accounts.length === 0}
            className="px-2.5 py-1 text-xs font-medium text-white bg-orange-600/90 hover:bg-orange-600 disabled:opacity-50 rounded transition flex items-center gap-1 active:scale-95"
          >
            <RefreshCw className={`w-3 h-3 ${isBuilding ? 'animate-spin' : ''}`} />
            <span>{isBuilding ? 'Building...' : 'Rebuild All'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="bg-slate-950/70 border border-slate-800/80 rounded p-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
            <span className="flex items-center gap-1 font-medium">
              <FolderGit2 className="w-3 h-3 text-orange-400" />
              Repository
            </span>
            <a
              href={project.github_repo}
              target="_blank"
              rel="noreferrer"
              className="text-slate-400 hover:text-slate-200"
            >
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <div className="font-mono text-slate-200 truncate font-medium text-[11px]">
            {project.github_repo.replace('https://github.com/', '')}
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
            <GitBranch className="w-2.5 h-2.5" />
            <span>{project.github_branch}</span>
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded p-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
            <span className="flex items-center gap-1 font-medium">
              <GitCommit className="w-3 h-3 text-sky-400" />
              Commit
            </span>
            <span className="font-mono text-[9px] bg-slate-800/80 px-1 rounded text-slate-300 border border-slate-700/60">
              {project.latest_commit_sha || 'HEAD'}
            </span>
          </div>
          <div className="text-slate-300 truncate font-medium text-[11px]">
            {project.latest_commit_message || 'HEAD'}
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded p-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
            <span className="flex items-center gap-1 font-medium">
              <Globe className="w-3 h-3 text-emerald-400" />
              Root Domain
            </span>
          </div>
          <div className="font-mono text-slate-200 truncate font-medium text-[11px]">
            .{project.root_domain}
          </div>
        </div>

        <div className="bg-slate-950/70 border border-slate-800/80 rounded p-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400 mb-0.5">
            <span className="flex items-center gap-1 font-medium">
              <Layers className="w-3 h-3 text-purple-400" />
              Live Status
            </span>
            <span className="text-[10px] font-mono text-slate-300 tabular-nums">
              {successCount}/{accounts.length}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex-1 bg-slate-900 rounded-full h-1 overflow-hidden border border-slate-800">
              <div
                className="bg-emerald-500 h-full transition-all duration-300"
                style={{
                  width: `${accounts.length > 0 ? (successCount / accounts.length) * 100 : 0}%`,
                }}
              />
            </div>
            <span className="font-mono text-[9px] text-slate-400 tabular-nums">
              {accounts.length > 0 ? Math.round((successCount / accounts.length) * 100) : 0}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
