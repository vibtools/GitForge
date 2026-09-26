import React from 'react';
import {
  Cloud,
  FolderGit2,
  Globe,
  Terminal,
  ArrowRight,
  Database,
  Cpu,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Activity,
} from 'lucide-react';
import { useSiteSettings } from '../context/SiteSettingsContext';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth }) => {
  const { siteSettings } = useSiteSettings();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Global Announcement / Maintenance Banner if set */}
      {(siteSettings.maintenance_banner || siteSettings.maintenance_mode) && (
        <div className="bg-amber-950/90 border-b border-amber-800/80 px-3 py-1 text-[11px] font-mono text-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-1.5 mx-auto">
            <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
            <span>
              {siteSettings.maintenance_banner ||
                'System Maintenance is currently ACTIVE. Some build operations may be queued.'}
            </span>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="h-10 border-b border-slate-800 bg-slate-900 sticky top-0 z-40 px-3 sm:px-6 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
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
          <span className="font-bold text-white text-xs tracking-tight">
            {siteSettings.site_name || 'GitForge'}
          </span>
          {siteSettings.site_tagline && (
            <span className="hidden md:inline text-[10px] font-mono text-slate-400 pl-2 border-l border-slate-800">
              {siteSettings.site_tagline}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <button
            onClick={() => onOpenAuth('login')}
            className="px-2.5 py-0.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition font-medium"
          >
            Sign In
          </button>

          {siteSettings.allow_public_registration && (
            <button
              onClick={() => onOpenAuth('register')}
              className="px-2.5 py-0.5 text-white bg-orange-600 hover:bg-orange-500 rounded transition font-semibold flex items-center gap-1 shadow-sm"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Hero Section */}
        <section className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-5 sm:p-7 relative overflow-hidden">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-orange-950/50 border border-orange-800/60 text-[10px] font-mono text-orange-400/90 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              MULTI-ACCOUNT ORCHESTRATION ENGINE
            </div>

            <h1 className="text-lg sm:text-xl font-bold text-slate-100 tracking-tight leading-snug">
              Bulk Cloudflare Pages Deployment & Custom Subdomain Automation
            </h1>

            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              Deploy a single GitHub repository across 10+ independent Cloudflare accounts in parallel with automated DNS CNAME routing and live deployment tracking.
            </p>

            <div className="flex items-center gap-2 pt-2 text-[11px]">
              {siteSettings.allow_public_registration ? (
                <button
                  onClick={() => onOpenAuth('register')}
                  className="px-3.5 py-1.5 font-semibold text-white bg-orange-600/90 hover:bg-orange-600 rounded transition flex items-center gap-1.5 shadow-sm"
                >
                  <span>Launch App</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : null}

              <button
                onClick={() => onOpenAuth('login')}
                className="px-3.5 py-1.5 font-medium text-slate-300 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded transition"
              >
                Sign In
              </button>
            </div>
          </div>
        </section>

        {/* Architecture Flow Preview */}
        <section className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 text-xs">
            <span className="font-semibold text-slate-200 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-orange-400" />
              <span>Deployment Pipeline Architecture</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400/90 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" />
              Parallel Execution
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs font-mono">
            {/* Step 1 */}
            <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-orange-400/90 text-[10px] font-semibold">
                <FolderGit2 className="w-3 h-3" />
                <span>1. GitHub Sync</span>
              </div>
              <p className="text-[10px] text-slate-400">Clone repo & fetch commit metadata</p>
            </div>

            {/* Step 2 */}
            <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-sky-400/90 text-[10px] font-semibold">
                <Cpu className="w-3 h-3" />
                <span>2. Local Build</span>
              </div>
              <p className="text-[10px] text-slate-400">Compile assets (npm run build)</p>
            </div>

            {/* Step 3 */}
            <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400/90 text-[10px] font-semibold">
                <Cloud className="w-3 h-3" />
                <span>3. Multi-Account Push</span>
              </div>
              <p className="text-[10px] text-slate-400">Wrangler deploys to 10+ accounts</p>
            </div>

            {/* Step 4 */}
            <div className="p-2.5 rounded bg-slate-950/70 border border-slate-800/80 space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-400/90 text-[10px] font-semibold">
                <Globe className="w-3 h-3" />
                <span>4. CNAME Routing</span>
              </div>
              <p className="text-[10px] text-slate-400">Auto custom domain binding</p>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Multi Account */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-sky-400 text-xs font-bold">
              <Cloud className="w-4 h-4" />
              <span>Multi-Account Vault</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
              Store and live-validate Cloudflare API tokens across multiple projects with quota enforcement.
            </p>
          </div>

          {/* DNS Automation */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <Globe className="w-4 h-4" />
              <span>DNS CNAME Automation</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
              Automatic generation of subdomain patterns and CNAME target bindings for custom domains.
            </p>
          </div>

          {/* Git Sync */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-orange-400 text-xs font-bold">
              <FolderGit2 className="w-4 h-4" />
              <span>GitHub Commit Sync</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
              Automatic tracking of repository commits, branches, and build triggers from GitHub REST API.
            </p>
          </div>

          {/* Wrangler Engine */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold">
              <Terminal className="w-4 h-4" />
              <span>Wrangler Worker Engine</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
              Managed child process pool with configurable concurrency throttles and terminal logs.
            </p>
          </div>

          {/* Persistent State */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
              <Database className="w-4 h-4" />
              <span>High-Performance Persistence</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
              Secure credential encryption, project state synchronization, and automated disaster recovery.
            </p>
          </div>

          {/* Real-time Telemetry */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2 text-amber-400 text-xs font-bold">
              <Activity className="w-4 h-4" />
              <span>Live Build Monitoring</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono leading-relaxed">
              Real-time build status tracking, live streaming logs, and automated error diagnostics.
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="h-9 border-t border-slate-800 bg-slate-950 px-4 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <div className="flex items-center gap-3 truncate">
          <span className="truncate">
            {siteSettings.site_footer_text ||
              `${siteSettings.site_name || 'GitForge'} — ${
                siteSettings.site_tagline || 'Multi-Account Cloudflare Pages Fleet Orchestrator'
              }`}
          </span>
          {siteSettings.site_support_email && (
            <a
              href={`mailto:${siteSettings.site_support_email}`}
              className="hidden sm:inline-flex items-center gap-1 text-slate-400 hover:text-slate-200 transition"
            >
              <Mail className="w-2.5 h-2.5 text-orange-400" />
              <span>{siteSettings.site_support_email}</span>
            </a>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {siteSettings.site_support_url && (
            <a
              href={siteSettings.site_support_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-orange-400 transition"
            >
              Docs ↗
            </a>
          )}
        </div>
      </footer>
    </div>
  );
};
