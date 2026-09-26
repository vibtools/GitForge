import React from 'react';
import {
  LayoutDashboard,
  Layers,
  FolderGit2,
  Settings,
  LogOut,
} from 'lucide-react';
import { Project, User } from '../types';

export type UserNavTab = 'dashboard' | 'builder' | 'projects' | 'settings';

interface UserSidebarProps {
  currentTab: UserNavTab;
  onSelectTab: (tab: UserNavTab) => void;
  projects: Project[];
  activeProject: Project | null;
  onSelectProject: (p: Project) => void;
  onOpenNewProject: () => void;
  user: User | null;
  onLogout: () => void;
  isBuilding?: boolean;
}

export const UserSidebar: React.FC<UserSidebarProps> = ({
  currentTab,
  onSelectTab,
  projects,
  activeProject,
  user,
  onLogout,
}) => {

  const navItems: Array<{
    id: UserNavTab;
    label: string;
    icon: React.ElementType;
    badge?: string | number;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'builder',
      label: 'Fleet Builder',
      icon: Layers,
      badge: activeProject ? activeProject.account_count || 0 : undefined,
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: FolderGit2,
      badge: projects.length,
    },
    {
      id: 'settings',
      label: 'Profile & Settings',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-44 lg:w-48 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 select-none text-xs">
      {/* Nav List */}
      <nav className="flex-1 p-1.5 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                isActive
                  ? 'bg-orange-600/15 text-orange-400 border border-orange-500/30 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2 truncate">
                <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-orange-400' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge !== undefined && (
                <span
                  className={`text-[9px] font-mono px-1 py-0.2 rounded ${
                    isActive
                      ? 'bg-orange-500/20 text-orange-300'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-2 border-t border-slate-800 bg-slate-950/60 text-[11px]">
        {user ? (
          <div className="flex items-center justify-between gap-1">
            <div className="truncate min-w-0">
              <div className="text-slate-200 font-medium truncate text-[11px]">
                {user.name || 'User'}
              </div>
              <div className="text-slate-400 font-mono text-[9px] truncate">
                {user.email}
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded transition shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="text-slate-400 text-[10px] font-mono">Not signed in</div>
        )}
      </div>
    </aside>
  );
};
