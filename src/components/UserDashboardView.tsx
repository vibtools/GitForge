import React, { useState, useEffect } from 'react';
import {
  FolderGit2,
  Cloud,
  Globe,
  Activity,
  Plus,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  GitBranch,
} from 'lucide-react';
import { Project, User } from '../types';

interface UserDashboardViewProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (p: Project) => void;
  onOpenNewProject: () => void;
  onGoToBuilder: () => void;
  user: User | null;
}

interface UserStats {
  total_projects: number;
  total_accounts: number;
  live_deployments: number;
  building_deployments: number;
  success_rate_percent: number;
  recent_deployments: Array<{
    id: string;
    project_id: string;
    project_name: string;
    account_alias: string;
    cf_pages_project_name: string;
    custom_domain?: string;
    pages_dev_domain?: string;
    build_status: string;
    dns_status: string;
    deployed_at: string;
    created_at: string;
  }>;
}

export const UserDashboardView: React.FC<UserDashboardViewProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onOpenNewProject,
  onGoToBuilder,
  user,
}) => {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch('/api/user/stats', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      // Ignore background stats load errors
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [projects]);

  const totalAccounts = projects.reduce((acc, p) => acc + (p.account_count || 0), 0);
  const totalLive = projects.reduce((acc, p) => acc + (p.successful_deployments || 0), 0);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-2.5">
      {/* Top Header Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-100 text-xs">Dashboard</span>
          <span className="text-[10px] font-mono text-slate-400">
            ({user?.email || 'User'})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={loadStats}
            title="Refresh"
            className="p-1 text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 rounded transition"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={onOpenNewProject}
            className="px-2.5 py-0.5 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded transition flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>New Project</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>PROJECTS</span>
            <FolderGit2 className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div className="text-sm font-bold font-mono text-slate-100">
            {stats?.total_projects ?? projects.length}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>CF ACCOUNTS</span>
            <Cloud className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-sm font-bold font-mono text-slate-100">
            {stats?.total_accounts ?? totalAccounts}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>LIVE SITES</span>
            <Globe className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-bold font-mono text-emerald-300">
            {stats?.live_deployments ?? totalLive}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>FLEET HEALTH</span>
            <Activity className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-sm font-bold font-mono text-slate-100">
            {stats?.success_rate_percent ?? 100}%
          </div>
        </div>
      </div>

      {/* Projects Catalog Grid */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-2">
        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-xs">
          <span className="font-bold text-slate-200">Active Projects</span>
          <button
            onClick={onGoToBuilder}
            className="text-[11px] font-medium text-orange-400 hover:text-orange-300 flex items-center gap-1 transition"
          >
            <span>Open Builder</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="py-6 text-center bg-slate-950/60 border border-slate-800 rounded-lg space-y-2">
            <FolderGit2 className="w-5 h-5 text-slate-600 mx-auto" />
            <div className="text-[11px] text-slate-400 font-mono">No projects configured</div>
            <button
              onClick={onOpenNewProject}
              className="px-2.5 py-0.5 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded transition inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" />
              <span>New Project</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {projects.map((proj) => {
              const isSelected = activeProject?.id === proj.id;

              return (
                <div
                  key={proj.id}
                  onClick={() => {
                    onSelectProject(proj);
                    onGoToBuilder();
                  }}
                  className={`p-2 rounded border transition cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-slate-950 border-orange-500/40'
                      : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="truncate min-w-0">
                      <div className="text-[11px] font-semibold text-slate-100 truncate flex items-center gap-1">
                        <span>{proj.name}</span>
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate flex items-center gap-1">
                        <GitBranch className="w-2.5 h-2.5 text-slate-500" />
                        <span>{proj.github_repo}</span>
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

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800/80">
                    <span className="truncate max-w-[120px]">{proj.root_domain}</span>
                    <span className="text-slate-300 font-semibold">{proj.account_count || 0} Accounts</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Deployments Activity */}
      {stats && stats.recent_deployments && stats.recent_deployments.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-xs font-bold text-slate-200">
            <span>Recent Deployments</span>
            <span className="text-[10px] font-mono text-slate-400 font-normal">Latest Events</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] font-mono">
              <thead>
                <tr className="bg-slate-950 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                  <th className="py-1 px-2">Project</th>
                  <th className="py-1 px-2">Account</th>
                  <th className="py-1 px-2">Target</th>
                  <th className="py-1 px-2">Status</th>
                  <th className="py-1 px-2 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stats.recent_deployments.map((dep) => (
                  <tr key={dep.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-1 px-2 font-medium text-slate-200 truncate max-w-[120px]">
                      {dep.project_name}
                    </td>
                    <td className="py-1 px-2 text-slate-400 truncate max-w-[100px]">
                      {dep.account_alias}
                    </td>
                    <td className="py-1 px-2 text-slate-300">
                      {dep.custom_domain ? (
                        <a
                          href={`https://${dep.custom_domain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-orange-400 hover:underline inline-flex items-center gap-0.5 truncate max-w-[160px]"
                        >
                          <span>{dep.custom_domain}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      ) : (
                        <span className="text-slate-500 font-mono text-[10px]">
                          {dep.cf_pages_project_name}
                        </span>
                      )}
                    </td>
                    <td className="py-1 px-2">
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                          dep.build_status === 'success'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : dep.build_status === 'building'
                            ? 'bg-blue-950 text-blue-300 border border-blue-700 animate-pulse'
                            : dep.build_status === 'failed'
                            ? 'bg-red-950 text-red-300 border border-red-800'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {dep.build_status}
                      </span>
                    </td>
                    <td className="py-1 px-2 text-right text-slate-400 text-[10px]">
                      {dep.deployed_at
                        ? new Date(dep.deployed_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
