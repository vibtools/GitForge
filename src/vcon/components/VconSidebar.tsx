import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  FolderGit2,
  Cloud,
  Terminal,
  Users,
  Sliders,
  Database,
  ScrollText,
  ChevronDown,
  Layers,
  ShieldCheck,
  Activity,
  Globe,
  HardDrive,
} from 'lucide-react';
import { VconTab, AdminOverview } from '../types';

interface VconSidebarProps {
  activeTab: VconTab;
  onSelectTab: (tab: VconTab) => void;
  overview: AdminOverview | null;
}

interface MenuItem {
  id: VconTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
  badgeColor?: string;
}

interface MenuGroup {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
}

export const VconSidebar: React.FC<VconSidebarProps> = ({
  activeTab,
  onSelectTab,
  overview,
}) => {
  const menuGroups: MenuGroup[] = [
    {
      id: 'command',
      label: 'Command Center',
      icon: Activity,
      items: [
        {
          id: 'overview',
          label: 'Dashboard',
          icon: LayoutDashboard,
          badge: overview?.active_builds ? `${overview.active_builds}` : null,
          badgeColor: 'bg-sky-950/60 text-sky-400 border-sky-800/60',
        },
      ],
    },
    {
      id: 'fleet',
      label: 'Fleet & Builds',
      icon: Layers,
      items: [
        {
          id: 'projects',
          label: 'Projects',
          icon: FolderGit2,
          badge: overview ? String(overview.counters.total_projects) : null,
        },
        {
          id: 'accounts',
          label: 'CF Accounts',
          icon: Cloud,
          badge: overview ? String(overview.counters.total_accounts) : null,
        },
        {
          id: 'deployments',
          label: 'Deployments',
          icon: Terminal,
          badge: overview?.counters.building_deployments
            ? `${overview.counters.building_deployments}`
            : overview ? String(overview.counters.total_deployments) : null,
          badgeColor: overview?.counters.building_deployments
            ? 'bg-amber-950/60 text-amber-400 border-amber-800/60'
            : undefined,
        },
      ],
    },
    {
      id: 'users',
      label: 'Users',
      icon: Users,
      items: [
        {
          id: 'users',
          label: 'Users',
          icon: Users,
          badge: overview ? `${overview.counters.total_users}` : null,
        },
      ],
    },
    {
      id: 'analysis',
      label: 'Analysis',
      icon: ScrollText,
      items: [
        {
          id: 'audit',
          label: 'Audit Log',
          icon: ScrollText,
        },
      ],
    },
    {
      id: 'system',
      label: 'System & Security',
      icon: ShieldCheck,
      items: [
        {
          id: 'site_settings',
          label: 'Site Settings',
          icon: Globe,
        },
        {
          id: 'storage',
          label: 'Storage (S3)',
          icon: HardDrive,
        },
        {
          id: 'settings',
          label: 'System Settings',
          icon: Sliders,
        },
        {
          id: 'database',
          label: 'Database',
          icon: Database,
        },
      ],
    },
  ];

  // Track open/collapsed state of each group. Default all to open
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    command: true,
    fleet: true,
    users: true,
    analysis: true,
    system: true,
  });

  // Ensure the group containing the active tab is automatically opened
  useEffect(() => {
    const parentGroup = menuGroups.find((g) => g.items.some((i) => i.id === activeTab));
    if (parentGroup && !openGroups[parentGroup.id]) {
      setOpenGroups((prev) => ({
        ...prev,
        [parentGroup.id]: true,
      }));
    }
  }, [activeTab]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  return (
    <aside className="w-48 bg-slate-900/90 border-r border-slate-800/80 flex flex-col shrink-0 select-none">
      <nav className="p-1.5 space-y-1.5 flex-1 overflow-y-auto">
        {menuGroups.map((group) => {
          const GroupIcon = group.icon;
          const isOpen = !!openGroups[group.id];
          const hasActiveChild = group.items.some((i) => i.id === activeTab);

          return (
            <div key={group.id} className="space-y-0.5">
              {/* Group Nav Header — Clicking toggles the dropdown */}
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
                className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                  hasActiveChild
                    ? 'text-slate-200 bg-slate-800/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <GroupIcon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      hasActiveChild ? 'text-orange-400' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate tracking-tight font-medium">{group.label}</span>
                  {hasActiveChild && !isOpen && (
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <ChevronDown
                    className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${
                      isOpen ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </div>
              </button>

              {/* Submenu Pages Dropdown */}
              {isOpen && (
                <div className="ml-2 pl-2 border-l border-slate-800/70 space-y-0.5 pt-0.5 pb-1">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = activeTab === item.id;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectTab(item.id)}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] font-normal transition cursor-pointer ${
                          isActive
                            ? 'bg-orange-600/90 text-white font-medium shadow-xs'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <ItemIcon
                            className={`w-3 h-3 shrink-0 ${
                              isActive ? 'text-white' : 'text-slate-400'
                            }`}
                          />
                          <span className="truncate">{item.label}</span>
                        </div>

                        {item.badge && (
                          <span
                            className={`text-[9px] font-mono px-1 py-0.2 rounded border shrink-0 ${
                              item.badgeColor ||
                              (isActive
                                ? 'bg-orange-700/80 text-orange-100 border-orange-500/40'
                                : 'bg-slate-800/80 text-slate-400 border-slate-700/60')
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Compact Status Indicator in Sidebar Bottom */}
      {overview && (
        <div className="p-2 border-t border-slate-800/70 bg-slate-950/50 flex items-center justify-between text-[9px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                overview.db.status === 'connected' ? 'bg-emerald-400/90' : 'bg-rose-400/90'
              }`}
            />
            <span className="truncate">DB {overview.db.latency_ms}ms</span>
          </div>
          {overview.maintenance_mode && (
            <span className="px-1 py-0.2 bg-amber-950/60 text-amber-300 border border-amber-800/60 rounded text-[8px] font-medium uppercase">
              Maint
            </span>
          )}
        </div>
      )}
    </aside>
  );
};
