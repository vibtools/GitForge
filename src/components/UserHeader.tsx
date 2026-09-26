import React, { useState, useRef, useEffect } from 'react';
import { Plus, User as UserIcon, Settings, LogOut, ChevronDown, Layers } from 'lucide-react';
import { Project, User } from '../types';
import { useSiteSettings } from '../context/SiteSettingsContext';
import { UserNavTab } from './UserSidebar';

interface UserHeaderProps {
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (p: Project) => void;
  onOpenNewProject: () => void;
  user: User | null;
  onLogout: () => void;
  onSelectTab?: (tab: UserNavTab) => void;
  isBuilding?: boolean;
}

export const UserHeader: React.FC<UserHeaderProps> = ({
  projects,
  activeProject,
  onSelectProject,
  onOpenNewProject,
  user,
  onLogout,
  onSelectTab,
  isBuilding = false,
}) => {
  const { siteSettings } = useSiteSettings();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userInitial = user?.name
    ? user.name.charAt(0).toUpperCase()
    : user?.email
    ? user.email.charAt(0).toUpperCase()
    : 'U';

  return (
    <header className="h-10 bg-slate-900 border-b border-slate-800 px-3 flex items-center justify-between text-xs select-none sticky top-0 z-40 shrink-0">
      {/* Left: Brand & Active Project Selector */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Brand Logo & Title */}
        <div className="flex items-center gap-1.5 shrink-0">
          {siteSettings.site_logo_url ? (
            <img
              src={siteSettings.site_logo_url}
              alt={siteSettings.site_name}
              className="h-4 max-w-[100px] object-contain"
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
          <span className="font-bold text-slate-100 text-xs tracking-tight">
            {siteSettings.site_name || 'GitForge'}
          </span>

          {isBuilding && (
            <span
              title="Fleet deployment in progress"
              className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0 ml-1"
            />
          )}
        </div>

        {/* Divider */}
        <div className="h-3.5 w-px bg-slate-800" />

        {/* Compact Active Project & + New Project */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider hidden sm:inline shrink-0">
            Active Project:
          </span>

          {projects.length > 0 ? (
            <select
              value={activeProject?.id || ''}
              onChange={(e) => {
                const found = projects.find((p) => p.id === e.target.value);
                if (found) {
                  onSelectProject(found);
                  if (onSelectTab) onSelectTab('builder');
                }
              }}
              className="bg-slate-950 border border-slate-800 text-[11px] text-slate-200 font-medium rounded px-2 py-0.5 focus:outline-none focus:border-orange-500 cursor-pointer max-w-[150px] sm:max-w-[200px] truncate"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.account_count || 0})
                </option>
              ))}
            </select>
          ) : (
            <span className="text-[10px] font-mono text-slate-500">No project</span>
          )}

          <button
            onClick={onOpenNewProject}
            title="Create New Project"
            className="p-1 sm:px-2 sm:py-0.5 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 border border-orange-500/30 rounded transition text-[10px] font-semibold flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3 h-3" />
            <span className="hidden sm:inline">Project</span>
          </button>
        </div>
      </div>

      {/* Right: Profile Dropdown Icon */}
      <div className="relative shrink-0" ref={profileMenuRef}>
        <button
          onClick={() => setIsProfileOpen(!isProfileOpen)}
          className="flex items-center gap-1.5 p-1 hover:bg-slate-800/80 rounded transition cursor-pointer text-xs focus:outline-none"
        >
          <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 text-orange-400 flex items-center justify-center font-bold font-mono text-[10px] shadow-xs">
            {userInitial}
          </div>

          <span className="text-[11px] font-medium text-slate-200 hidden md:inline max-w-[120px] truncate">
            {user?.name || user?.email || 'User'}
          </span>

          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Profile Menu Dropdown */}
        {isProfileOpen && (
          <div className="absolute right-0 mt-1 w-48 bg-slate-900 border border-slate-800 rounded-lg shadow-xl py-1 text-[11px] font-mono z-50 animate-in fade-in">
            <div className="px-3 py-1.5 border-b border-slate-800">
              <div className="text-slate-200 font-semibold truncate font-sans">
                {user?.name || 'User'}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {user?.email}
              </div>
            </div>

            {onSelectTab && (
              <button
                onClick={() => {
                  onSelectTab('settings');
                  setIsProfileOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-slate-300 hover:text-white hover:bg-slate-800 flex items-center gap-2 transition cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5 text-orange-400" />
                <span>Profile & Settings</span>
              </button>
            )}

            <button
              onClick={() => {
                setIsProfileOpen(false);
                onLogout();
              }}
              className="w-full text-left px-3 py-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 flex items-center gap-2 transition cursor-pointer border-t border-slate-800/80"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
