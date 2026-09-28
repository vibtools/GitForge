import React from 'react';
import {
  Layers,
  ArrowRight,
  Rocket,
  LogIn,
  Check,
  Workflow,
  CheckCircle2,
  GitBranch,
  Cpu,
  UploadCloud,
  Globe,
  Cloud,
  GitPullRequest,
  Terminal,
  ShieldCheck,
  Activity,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { useSiteSettings } from '../context/SiteSettingsContext';

interface LandingPageProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenAuth }) => {
  const { siteSettings } = useSiteSettings();

  const handleOpenRegister = () => {
    if (siteSettings.allow_public_registration) {
      onOpenAuth('register');
    } else {
      onOpenAuth('login');
    }
  };

  return (
    <div className="min-h-screen bg-[#06080D] text-slate-200 antialiased font-sans selection:bg-orange-500 selection:text-white flex flex-col">
      {/* Global Announcement / Maintenance Banner if set */}
      {(siteSettings.maintenance_banner || siteSettings.maintenance_mode) && (
        <div className="bg-amber-950/90 border-b border-amber-800/80 px-3 py-1.5 text-xs font-mono text-amber-200 flex items-center justify-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            {siteSettings.maintenance_banner ||
              'System Maintenance is currently ACTIVE. Some build operations may be queued.'}
          </span>
        </div>
      )}

      {/* Live Status Micro-Header */}
      <div className="border-b border-[#1A202C] bg-[#0C0F17]/90 px-4 py-1.5 text-xs text-center text-slate-400 font-mono flex items-center justify-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00E599] animate-pulse shrink-0"></span>
        <span>Cloud Fleet Engine Live — Deploy unlimited Cloudflare Pages instantly without hosting your own server.</span>
        <button
          onClick={handleOpenRegister}
          className="text-[#F6821F] hover:underline font-semibold ml-1 inline-flex items-center gap-0.5 cursor-pointer"
        >
          Create Free Account &rarr;
        </button>
      </div>

      {/* Main Navigation */}
      <header className="sticky top-0 z-50 border-b border-[#1A202C] bg-[#06080D]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              {siteSettings.site_logo_url ? (
                <img
                  src={siteSettings.site_logo_url}
                  alt={siteSettings.site_name || 'GitForge'}
                  className="h-7 max-w-[120px] object-contain shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-7 h-7 rounded bg-[#F6821F] flex items-center justify-center text-white font-bold shadow-md shadow-[#F6821F]/20">
                  <Layers className="w-4 h-4" />
                </div>
              )}
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span className="font-bold tracking-tight text-white font-mono text-sm">
                  {siteSettings.site_name || 'GitForge'}
                </span>
                <span className="text-[11px] text-slate-400 font-mono hidden md:inline border-l border-[#1A202C] pl-2">
                  {siteSettings.site_tagline || 'Multi-Account Cloudflare Pages Fleet Orchestrator'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:flex items-center gap-2 border border-[#1A202C] bg-[#0C0F17] rounded px-2.5 py-1 text-[11px] font-mono text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E599]"></span> 0s Server Config Needed
            </div>
            <button
              onClick={() => onOpenAuth('login')}
              className="px-3 py-1.5 text-xs font-medium rounded border border-[#1A202C] bg-[#0C0F17] hover:border-slate-600 transition text-slate-300 cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={handleOpenRegister}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded bg-[#F6821F] hover:bg-[#E06B08] transition text-white orange-glow cursor-pointer"
            >
              <span>Get Started Free</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative bg-grid overflow-hidden border-b border-[#1A202C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="text-center max-w-3xl mx-auto">
            {/* Live Tag */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded border border-[#F6821F]/30 bg-[#F6821F]/10 text-[#F6821F] text-xs font-mono font-medium mb-5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#F6821F] animate-ping"></span>
              MULTI-ACCOUNT ORCHESTRATION CLOUD ENGINE
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white mb-4 leading-snug">
              Bulk Cloudflare Pages Deployment & <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F6821F] via-amber-400 to-[#00E599]">
                Custom Subdomain Automation
              </span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-400 max-w-2xl mx-auto mb-7 leading-relaxed font-normal">
              Deploy a single GitHub repository across 10+ to 100+ independent Cloudflare accounts in parallel with automated DNS CNAME routing, live build streaming, and quota verification. No self-hosting needed.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
              <button
                onClick={handleOpenRegister}
                className="px-5 py-2.5 rounded text-xs font-semibold bg-[#F6821F] hover:bg-[#E06B08] text-white transition flex items-center gap-2 shadow-lg shadow-[#F6821F]/20 orange-glow cursor-pointer"
              >
                <Rocket className="w-4 h-4" /> Launch App Now — Free
              </button>
              <button
                onClick={() => onOpenAuth('login')}
                className="px-5 py-2.5 rounded text-xs font-semibold bg-[#0C0F17] border border-[#1A202C] hover:border-slate-600 text-slate-300 transition flex items-center gap-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4" /> Sign In to Dashboard
              </button>
            </div>

            {/* Trust / Highlight Badges */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500 font-mono">
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00E599]" /> Free Account
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00E599]" /> No VPS Setup Needed
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00E599]" /> Encrypted Token Vault
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-[#00E599]" /> Automated CNAME Binding
              </span>
            </div>
          </div>

          {/* Live Interactive Pipeline Visualizer */}
          <div className="mt-12 max-w-4xl mx-auto rounded border border-[#1A202C] bg-[#0C0F17] overflow-hidden">
            <div className="bg-[#06080D] px-4 py-2.5 border-b border-[#1A202C] flex items-center justify-between font-mono text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <span className="text-[#F6821F] font-bold flex items-center gap-1.5">
                  <Workflow className="w-3.5 h-3.5" /> DEPLOYMENT PIPELINE ARCHITECTURE
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[#00E599] text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5" /> Parallel Execution Active
              </div>
            </div>

            {/* 4 Step Pipeline Grid */}
            <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
              <div className="border border-[#1A202C] bg-[#06080D] p-3 rounded">
                <div className="flex items-center justify-between text-amber-400 font-semibold mb-1">
                  <span>1. GitHub Sync</span>
                  <GitBranch className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">Fetch repo, branch commits & parse output directory.</p>
              </div>

              <div className="border border-[#1A202C] bg-[#06080D] p-3 rounded">
                <div className="flex items-center justify-between text-cyan-400 font-semibold mb-1">
                  <span>2. Cloud Build</span>
                  <Cpu className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">Compile assets (<code className="text-slate-300">dist</code>) inside isolated worker queues.</p>
              </div>

              <div className="border border-[#1A202C] bg-[#06080D] p-3 rounded">
                <div className="flex items-center justify-between text-[#F6821F] font-semibold mb-1">
                  <span>3. Multi-Push</span>
                  <UploadCloud className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">Wrangler engine pushes to 10+ Cloudflare accounts in parallel.</p>
              </div>

              <div className="border border-[#1A202C] bg-[#06080D] p-3 rounded">
                <div className="flex items-center justify-between text-[#00E599] font-semibold mb-1">
                  <span>4. CNAME Routing</span>
                  <Globe className="w-3.5 h-3.5" />
                </div>
                <p className="text-[11px] text-slate-400 leading-tight">Auto-bind subdomains (<code className="text-slate-300">sub-01.domain.com</code>) instantaneously.</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* How It Works (User-Facing) */}
      <section className="py-14 border-b border-[#1A202C] bg-[#0C0F17]/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="text-xs font-mono text-[#F6821F] tracking-widest uppercase mb-1">How It Works</h2>
            <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Deploy your fleet in 3 simple steps</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Step 1 */}
            <div className="border border-[#1A202C] bg-[#06080D] p-5 rounded">
              <div className="w-7 h-7 rounded bg-[#0C0F17] border border-[#1A202C] flex items-center justify-center font-mono font-bold text-xs text-[#F6821F] mb-3">
                01
              </div>
              <h4 className="text-sm font-semibold text-white mb-1.5">Sign Up & Connect Repo</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Create your account and paste your GitHub repository URL. Public and private repositories are supported with branch targeting.
              </p>
            </div>

            {/* Step 2 */}
            <div className="border border-[#1A202C] bg-[#06080D] p-5 rounded">
              <div className="w-7 h-7 rounded bg-[#0C0F17] border border-[#1A202C] flex items-center justify-center font-mono font-bold text-xs text-[#00E599] mb-3">
                02
              </div>
              <h4 className="text-sm font-semibold text-white mb-1.5">Bulk Import Cloudflare Accounts</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Paste your Cloudflare Account IDs & API Tokens using our JSON or TSV bulk importer. Tokens are verified live before any build runs.
              </p>
            </div>

            {/* Step 3 */}
            <div className="border border-[#1A202C] bg-[#06080D] p-5 rounded">
              <div className="w-7 h-7 rounded bg-[#0C0F17] border border-[#1A202C] flex items-center justify-center font-mono font-bold text-xs text-cyan-400 mb-3">
                03
              </div>
              <h4 className="text-sm font-semibold text-white mb-1.5">Click Build & Auto-Propagate</h4>
              <p className="text-xs text-slate-400 leading-relaxed">
                Hit <strong>Build Fleet</strong>. GitForge executes simultaneous deployment to all accounts, generates unique subdomains, and updates DNS records.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Feature Grid */}
      <section className="py-14 border-b border-[#1A202C]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-10">
            <h2 className="text-xs font-mono text-[#F6821F] tracking-widest uppercase mb-1">Platform Features</h2>
            <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Everything included right inside your browser</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card 1 */}
            <div className="border border-[#1A202C] bg-[#0C0F17] p-4 rounded hover:border-slate-700 transition">
              <div className="flex items-center gap-2.5 text-[#F6821F] font-semibold text-sm mb-1.5 font-mono">
                <Cloud className="w-4 h-4" />
                <h4>Multi-Account Vault</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Store and live-validate Cloudflare API tokens across multiple projects with quota enforcement and one-click health testing.
              </p>
            </div>

            {/* Card 2 */}
            <div className="border border-[#1A202C] bg-[#0C0F17] p-4 rounded hover:border-slate-700 transition">
              <div className="flex items-center gap-2.5 text-[#00E599] font-semibold text-sm mb-1.5 font-mono">
                <Globe className="w-4 h-4" />
                <h4>DNS CNAME Automation</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automatic generation of subdomain patterns (<code className="text-slate-300">sub-&#123;index&#125;</code>) and CNAME target bindings without manual intervention.
              </p>
            </div>

            {/* Card 3 */}
            <div className="border border-[#1A202C] bg-[#0C0F17] p-4 rounded hover:border-slate-700 transition">
              <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-sm mb-1.5 font-mono">
                <GitPullRequest className="w-4 h-4" />
                <h4>GitHub Commit Sync</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Automatic tracking of repository commits, branches, and build triggers directly from GitHub REST API in real time.
              </p>
            </div>

            {/* Card 4 */}
            <div className="border border-[#1A202C] bg-[#0C0F17] p-4 rounded hover:border-slate-700 transition">
              <div className="flex items-center gap-2.5 text-indigo-400 font-semibold text-sm mb-1.5 font-mono">
                <Terminal className="w-4 h-4" />
                <h4>Wrangler Worker Engine</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Managed child process pool with configurable concurrency throttles (1-10 workers) and streaming live terminal logs.
              </p>
            </div>

            {/* Card 5 */}
            <div className="border border-[#1A202C] bg-[#0C0F17] p-4 rounded hover:border-slate-700 transition">
              <div className="flex items-center gap-2.5 text-cyan-400 font-semibold text-sm mb-1.5 font-mono">
                <ShieldCheck className="w-4 h-4" />
                <h4>Encrypted Persistence</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                PBKDF2/SHA-512 authentication, secure credential storage, project state synchronization, and automated disaster recovery.
              </p>
            </div>

            {/* Card 6 */}
            <div className="border border-[#1A202C] bg-[#0C0F17] p-4 rounded hover:border-slate-700 transition">
              <div className="flex items-center gap-2.5 text-rose-400 font-semibold text-sm mb-1.5 font-mono">
                <Activity className="w-4 h-4" />
                <h4>Live Build Monitoring</h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Real-time percentage progress tracking (0% &rarr; 100%), live error diagnostics, and single-click individual rebuild triggers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-14 bg-[#06080D] border-b border-[#1A202C]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h3 className="text-xl sm:text-3xl font-bold text-white mb-3">Ready to deploy your first multi-account fleet?</h3>
          <p className="text-xs sm:text-sm text-slate-400 mb-6 max-w-xl mx-auto">
            Join for free, add your repository, and automate your Cloudflare Pages distribution in seconds.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleOpenRegister}
              className="px-5 py-2.5 rounded text-xs font-semibold bg-[#F6821F] hover:bg-[#E06B08] text-white transition flex items-center gap-2 shadow-lg shadow-[#F6821F]/20 orange-glow cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" /> Get Started for Free
            </button>
            <button
              onClick={() => onOpenAuth('login')}
              className="px-4 py-2.5 rounded text-xs font-semibold bg-[#0C0F17] border border-[#1A202C] hover:border-slate-600 text-slate-300 transition cursor-pointer"
            >
              Existing User? Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Clean Minimal Footer */}
      <footer className="py-8 bg-[#06080D] text-slate-500 text-xs font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-300">{siteSettings.site_name || 'GitForge'}</span>
            <span>— {siteSettings.site_tagline || 'Multi-Account Cloudflare Fleet Engine'}.</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              onClick={() => onOpenAuth('login')}
              className="hover:text-slate-300 transition cursor-pointer bg-transparent border-0 p-0 text-xs font-mono text-slate-500"
            >
              Sign In
            </button>
            {siteSettings.allow_public_registration && (
              <button
                onClick={handleOpenRegister}
                className="hover:text-slate-300 transition cursor-pointer bg-transparent border-0 p-0 text-xs font-mono text-slate-500"
              >
                Sign Up
              </button>
            )}
            <a href="/vcon" className="hover:text-slate-300 transition">
              vCon Console
            </a>
            {siteSettings.site_support_url ? (
              <a
                href={siteSettings.site_support_url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-300 transition"
              >
                Documentation ↗
              </a>
            ) : (
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-slate-300 transition"
              >
                GitHub
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};
