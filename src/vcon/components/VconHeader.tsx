import React from 'react';
import {
  ShieldAlert,
  ArrowLeft,
  Database,
  AlertTriangle,
  LogOut,
  PowerOff,
  Cpu,
} from 'lucide-react';
import { AdminOverview } from '../types';
import { useSiteSettings } from '../../context/SiteSettingsContext';

interface VconHeaderProps {
  overview: AdminOverview | null;
  onExitToApp: () => void;
  onEmergencyAbort: () => void;
  onLogout: () => void;
  userEmail?: string;
  isAborting?: boolean;
}

export const VconHeader: React.FC<VconHeaderProps> = ({
  overview,
  onExitToApp,
  onEmergencyAbort,
  onLogout,
  userEmail,
  isAborting = false,
}) => {
  const { siteSettings } = useSiteSettings();

  return (
    <header className="h-9 border-b border-slate-800/80 bg-slate-900/90 sticky top-0 z-40 px-3 flex items-center justify-between text-xs">
      {/* Brand */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5">
          {siteSettings.site_logo_url ? (
            <img
              src={siteSettings.site_logo_url}
              alt={siteSettings.site_name}
              className="h-4 max-w-[80px] object-contain shrink-0"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div
              className="w-5 h-5 rounded flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: siteSettings.site_primary_color || '#ea580c' }}
            >
              <ShieldAlert className="w-3 h-3" />
            </div>
          )}
          <span className="text-xs font-semibold tracking-tight text-slate-100">
            {siteSettings.site_name || 'GitForge'}
          </span>
          <span className="text-slate-600 text-[10px]">/</span>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">vCon</span>
          <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-orange-950/60 text-orange-400/90 border border-orange-800/60">
            ADMIN
          </span>
        </div>

        {overview?.maintenance_mode && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-950/60 text-amber-300 border border-amber-800/60">
            <AlertTriangle className="w-2.5 h-2.5" />
            MAINTENANCE
          </span>
        )}
      </div>

      {/* Vitals */}
      <div className="hidden sm:flex items-center gap-3 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-1">
          <Database className="w-3 h-3 text-emerald-400/90" />
          <span>DB:</span>
          <span className="text-emerald-400/90 font-medium">
            {overview?.db?.status === 'connected' ? `${overview.db.latency_ms}ms` : 'Offline'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Cpu className="w-3 h-3 text-sky-400/90" />
          <span>RAM:</span>
          <span className="text-sky-300/90 font-medium">
            {overview?.system?.memory_used_mb || 0}M
          </span>
        </div>

        {overview && overview.active_builds > 0 && (
          <div className="flex items-center gap-1 px-1.5 py-0.2 rounded bg-sky-950/60 border border-sky-800/60 text-sky-300">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            <span>{overview.active_builds} Active</span>
          </div>
        )}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onEmergencyAbort}
          disabled={isAborting}
          className="px-2 py-0.5 text-[10px] font-medium text-rose-300 hover:text-white bg-rose-950/50 hover:bg-rose-900/80 border border-rose-800/60 rounded transition flex items-center gap-1"
          title="Emergency Stop"
        >
          <PowerOff className="w-2.5 h-2.5 text-rose-400" />
          <span>Stop All</span>
        </button>

        <button
          onClick={onExitToApp}
          className="px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded transition flex items-center gap-1"
        >
          <ArrowLeft className="w-2.5 h-2.5" />
          <span>App</span>
        </button>

        <div className="flex items-center gap-1 pl-1.5 border-l border-slate-800/80 text-[11px]">
          <span className="text-slate-400 hidden md:inline font-mono max-w-[100px] truncate text-[10px]">
            {userEmail || 'admin'}
          </span>
          <button
            onClick={onLogout}
            title="Sign out of vCon"
            className="p-1 text-slate-400 hover:text-rose-300 hover:bg-slate-800 rounded transition"
          >
            <LogOut className="w-3 h-3" />
          </button>
        </div>
      </div>
    </header>
  );
};
