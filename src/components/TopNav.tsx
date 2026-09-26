import React from 'react';
import { Plus, Upload, LogOut } from 'lucide-react';
import { Project, User } from '../types';
import { useSiteSettings } from '../context/SiteSettingsContext';

interface TopNavProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (p: Project) => void;
  onOpenNewProject: () => void;
  onOpenBulkAccounts: () => void;
  user: User | null;
  onLogout: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onOpenNewProject,
  onOpenBulkAccounts,
  user,
  onLogout,
}) => {
  const { siteSettings } = useSiteSettings();

  return (
    <header className="h-10 border-b border-slate-800/80 bg-slate-900/90 sticky top-0 z-40 px-3 flex items-center justify-between text-xs">
      <div className="flex items-center gap-2.5">
        <span className="text-xs font-semibold text-slate-100 flex items-center gap-1.5 shrink-0">
          {siteSettings.site_logo_url ? (
            <img
              src={siteSettings.site_logo_url}
              alt={siteSettings.site_name}
              className="h-4 max-w-[120px] object-contain shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: siteSettings.site_primary_color || '#ea580c' }}
            />
          )}
          <span>{siteSettings.site_name || 'GitForge'}</span>
        </span>

        {projects.length > 0 && (
          <div className="flex items-center gap-1 border-l border-slate-800/80 pl-2.5">
            <select
              value={activeProject?.id || ''}
              onChange={(e) => {
                const found = projects.find((p) => p.id === e.target.value);
                if (found) onSelectProject(found);
              }}
              className="bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-200 rounded px-2 py-0.5 focus:outline-none focus:border-orange-500 font-medium cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.account_count || 0})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px]">
        {activeProject && (
          <button
            onClick={onOpenBulkAccounts}
            className="px-2.5 py-1 text-[11px] font-medium text-slate-300 bg-slate-800/80 hover:bg-slate-800 hover:text-slate-100 border border-slate-700/80 rounded transition flex items-center gap-1 whitespace-nowrap"
          >
            <Upload className="w-3 h-3 text-orange-400" />
            <span>Add Accounts</span>
          </button>
        )}

        <button
          onClick={onOpenNewProject}
          className="px-2.5 py-1 text-[11px] font-medium text-white bg-orange-600/90 hover:bg-orange-600 rounded transition flex items-center gap-1 whitespace-nowrap shadow-xs"
        >
          <Plus className="w-3 h-3" />
          <span>New Project</span>
        </button>

        {user && (
          <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-800/80">
            <span className="text-[10px] text-slate-400 font-mono hidden md:inline truncate max-w-[120px]">
              {user.email}
            </span>
            <button
              onClick={onLogout}
              title="Logout"
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
