import React, { useState, useEffect, useRef } from 'react';
import {
  FolderGit2,
  GitBranch,
  Globe,
  Cloud,
  Layers,
  Terminal,
  History as HistoryIcon,
  Settings,
  KeyRound,
  LayoutDashboard,
  Play,
  RotateCw,
  Plus,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Database,
  Cpu,
  ArrowRight,
  Code2,
  Copy,
  Trash2,
  Save,
  RefreshCw,
  Eye,
  Check,
  Network,
  HelpCircle,
  Clock,
  ArrowDown,
  Ban,
  Activity,
  Zap,
  CheckCheck,
} from 'lucide-react';
import { Project, Account, ProjectScanReport } from '../types';
import { AccountTable } from './AccountTable';

interface ProjectWorkplaceViewProps {
  project: Project;
  accounts: Account[];
  isBuilding: boolean;
  onUpdateProject: (updated: Project) => void;
  onRefreshProject: () => void;
  onOpenBulkModal: () => void;
  onViewAccount: (account: Account) => void;
  onRebuildAccount: (deploymentId: string) => void;
  onDeleteAccount: (accountId: string) => void;
  onTriggerBuild: (accountIds?: string[]) => void;
  onCancelBuild: () => void;
  onNotify: (msg: string) => void;
}

export type WorkplaceSubTab =
  | 'overview'
  | 'general'
  | 'environment'
  | 'domain'
  | 'cloudflare'
  | 'logs'
  | 'history';

// Helper to generate meaningful demo values for environment keys
function getDemoValueForKey(key: string, framework = ''): string {
  const upper = key.toUpperCase();
  if (upper.includes('URL') || upper.includes('HOST') || upper.includes('ENDPOINT') || upper.includes('DOMAIN')) {
    return 'https://api.example.com';
  }
  if (upper.includes('KEY') || upper.includes('SECRET') || upper.includes('TOKEN') || upper.includes('AUTH') || upper.includes('PASSWORD')) {
    return `your_${key.toLowerCase()}_here`;
  }
  if (upper.includes('PORT')) {
    return '3000';
  }
  if (upper.includes('ENV') || upper.includes('MODE')) {
    return 'production';
  }
  if (upper.includes('DB') || upper.includes('DATABASE')) {
    return 'postgresql://user:password@ep-demo.aws.neon.tech/neondb';
  }
  if (upper.includes('TITLE') || upper.includes('NAME') || upper.includes('APP')) {
    return 'My Application';
  }
  if (upper.includes('ENABLE') || upper.includes('DISABLE') || upper.includes('DEBUG') || upper.includes('FLAG')) {
    return 'true';
  }
  return `demo_${key.toLowerCase()}`;
}

export const ProjectWorkplaceView: React.FC<ProjectWorkplaceViewProps> = ({
  project,
  accounts,
  isBuilding,
  onUpdateProject,
  onRefreshProject,
  onOpenBulkModal,
  onViewAccount,
  onRebuildAccount,
  onDeleteAccount,
  onTriggerBuild,
  onCancelBuild,
  onNotify,
}) => {
  const [activeTab, setActiveTab] = useState<WorkplaceSubTab>('overview');

  // Blank Project / Scan Setup State
  const [isImportFormOpen, setIsImportFormOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState(project.github_repo || '');
  const [branch, setBranch] = useState(project.github_branch || 'main');
  const [githubToken, setGithubToken] = useState(project.github_token || '');
  const [isScanning, setIsScanning] = useState(false);
  const [scanStepIndex, setScanStepIndex] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanReport, setScanReport] = useState<ProjectScanReport | null>(project.scan_report || null);
  const [isScanReportVisible, setIsScanReportVisible] = useState(false);

  // General Settings State
  const [generalName, setGeneralName] = useState(project.name || '');
  const [generalDesc, setGeneralDesc] = useState(project.description || '');
  const [generalRepo, setGeneralRepo] = useState(project.github_repo || '');
  const [generalBranch, setGeneralBranch] = useState(project.github_branch || 'main');
  const [generalBuildCmd, setGeneralBuildCmd] = useState(project.build_command || 'npm run build');
  const [generalOutputDir, setGeneralOutputDir] = useState(project.output_dir || 'dist');
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);

  // Domain Page State
  const [domainRoot, setDomainRoot] = useState(project.root_domain || '');
  const [domainSubPattern, setDomainSubPattern] = useState(project.subdomain_pattern || 'site-{index}');
  const [isSavingDomain, setIsSavingDomain] = useState(false);
  const [copiedRecordKey, setCopiedRecordKey] = useState<string | null>(null);

  // Cloudflare Zones & Automated DNS State
  const [cfZones, setCfZones] = useState<Array<{
    id: string;
    name: string;
    status: string;
    plan: string;
    account: { id: string; name: string };
  }>>([]);
  const [isLoadingZones, setIsLoadingZones] = useState(false);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [isProxied, setIsProxied] = useState(true);
  const [syncSubdomains, setSyncSubdomains] = useState(true);
  const [isAutoProvisioning, setIsAutoProvisioning] = useState(false);
  const [autoProvisionReport, setAutoProvisionReport] = useState<any | null>(null);
  const [isVerifyingDns, setIsVerifyingDns] = useState(false);
  const [dnsVerificationData, setDnsVerificationData] = useState<any | null>(null);

  // Initial Environment Variables with scanned detected keys & demo values
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(() => {
    if (project.env_vars && typeof project.env_vars === 'object' && Object.keys(project.env_vars).length > 0) {
      return Object.entries(project.env_vars).map(([k, v]) => ({ key: k, value: String(v) }));
    }
    // Pre-populate with scanned detected environment variables with smart demo values
    if (project.scan_report?.detected_env_vars?.length) {
      const defaults = project.scan_report.detected_env_defaults || {};
      return project.scan_report.detected_env_vars.map((k) => ({
        key: k,
        value: defaults[k] || getDemoValueForKey(k, project.scan_report?.framework),
      }));
    }
    // Sensible framework preset
    return [
      { key: 'VITE_API_URL', value: 'https://api.example.com' },
      { key: 'VITE_APP_TITLE', value: project.name || 'My App' },
    ];
  });

  const [bulkEnvText, setBulkEnvText] = useState('');
  const [isBulkEnvModalOpen, setIsBulkEnvModalOpen] = useState(false);
  const [isSavingEnv, setIsSavingEnv] = useState(false);

  // Table selection & search
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [accountSearch, setAccountSearch] = useState('');
  const [logFilterAccountId, setLogFilterAccountId] = useState<string>('all');
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(true);
  const [isLogsCleared, setIsLogsCleared] = useState(false);

  const logEndRef = useRef<HTMLDivElement | null>(null);

  // Automatically switch to 'logs' tab when build starts
  const prevIsBuildingRef = useRef(isBuilding);
  useEffect(() => {
    if (!prevIsBuildingRef.current && isBuilding) {
      setActiveTab('logs');
      setIsLogsCleared(false);
    }
    prevIsBuildingRef.current = isBuilding;
  }, [isBuilding]);

  // Handler: Trigger build and automatically jump to Logs tab
  const handleTriggerBuildWithAutoSwitch = (accountIds?: string[]) => {
    setActiveTab('logs');
    setIsLogsCleared(false);
    onTriggerBuild(accountIds);
  };

  // Handler: Single account rebuild and automatically jump to Logs tab
  const handleRebuildAccountWithAutoSwitch = (deploymentId: string) => {
    setActiveTab('logs');
    setIsLogsCleared(false);
    onRebuildAccount(deploymentId);
  };

  // Cloudflare 1-Click Auth App Connect State & Handler
  const [isConnectingOAuth, setIsConnectingOAuth] = useState(false);
  const [isOAuthConfigured, setIsOAuthConfigured] = useState<boolean | null>(null);

  // Check if administrator has configured Cloudflare OAuth App in /vcon Settings
  const checkOAuthConfigStatus = async () => {
    try {
      const res = await fetch('/api/auth/cloudflare/config-status');
      if (res.ok) {
        const data = await res.json();
        setIsOAuthConfigured(Boolean(data.configured));
      }
    } catch {
      setIsOAuthConfigured(false);
    }
  };

  useEffect(() => {
    checkOAuthConfigStatus();
  }, [project.id]);

  const handleConnectOAuth = async () => {
    if (isOAuthConfigured === false) {
      onNotify('Cloudflare OAuth App is not configured in Admin panel (/vcon Settings). You can add accounts via API Token / Bulk import.');
      if (onOpenBulkModal) {
        onOpenBulkModal();
      }
      return;
    }

    setIsConnectingOAuth(true);
    try {
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch(`/api/auth/cloudflare/url?project_id=${project.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setIsOAuthConfigured(false);
        throw new Error(
          errData.error || 'Cloudflare OAuth App is not configured. Administrator must set OAuth Client ID and Secret in /vcon Settings.'
        );
      }

      const data = await res.json();
      if (!data.url) throw new Error('Authorization URL missing from server');

      const popup = window.open(
        data.url,
        'cf_oauth_popup',
        'width=600,height=750,menubar=no,status=no,toolbar=no,scrollbars=yes'
      );

      if (!popup) {
        throw new Error('Popup blocked by browser. Please allow popups for this site to connect Cloudflare.');
      }
    } catch (err: any) {
      onNotify(err.message || 'Failed to open Cloudflare authorization popup');
      setIsConnectingOAuth(false);
    }
  };

  // Listen for OAuth postMessage from popup window
  useEffect(() => {
    const handleOAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'CF_OAUTH_SUCCESS') {
        setIsConnectingOAuth(false);
        setIsOAuthConfigured(true);
        onNotify(`Cloudflare account "${event.data.accountName || 'Connected'}" authorized successfully!`);
        if (onRefreshProject) {
          onRefreshProject();
        }
        // Auto-refresh Cloudflare zones so they immediately show in the Domain page selector
        fetchCloudflareZones();
      } else if (event.data?.type === 'CF_OAUTH_ERROR') {
        setIsConnectingOAuth(false);
        onNotify(event.data.error || 'Cloudflare authorization failed.');
      }
    };

    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, [onRefreshProject, onNotify]);

  // Auto-scroll build logs on update
  useEffect(() => {
    if (activeTab === 'logs' && isAutoScrollEnabled && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeTab, isAutoScrollEnabled, accounts]);

  // Synchronize form state on project updates
  useEffect(() => {
    setGeneralName(project.name || '');
    setGeneralDesc(project.description || '');
    setGeneralRepo(project.github_repo || '');
    setGeneralBranch(project.github_branch || 'main');
    setGeneralBuildCmd(project.build_command || 'npm run build');
    setGeneralOutputDir(project.output_dir || 'dist');
    setDomainRoot(project.root_domain || '');
    setDomainSubPattern(project.subdomain_pattern || 'site-{index}');
    setRepoUrl(project.github_repo || '');
    if (project.scan_report) {
      setScanReport(project.scan_report);
    }
    if (project.env_vars && typeof project.env_vars === 'object' && Object.keys(project.env_vars).length > 0) {
      setEnvVars(Object.entries(project.env_vars).map(([k, v]) => ({ key: k, value: String(v) })));
    } else if (project.scan_report?.detected_env_vars?.length) {
      const defaults = project.scan_report.detected_env_defaults || {};
      setEnvVars(
        project.scan_report.detected_env_vars.map((k) => ({
          key: k,
          value: defaults[k] || getDemoValueForKey(k, project.scan_report?.framework),
        }))
      );
    }
  }, [project]);

  const hasConfiguredRepo = Boolean(project.github_repo && project.github_repo.trim());

  // Step-03: Execute Scan & Clone
  const handleStartScan = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setScanError(null);
    if (!repoUrl.trim()) {
      setScanError('Please enter a valid GitHub repository URL');
      return;
    }

    setIsScanning(true);
    setScanStepIndex(0);

    const scanStepsInterval = setInterval(() => {
      setScanStepIndex((prev) => (prev < 7 ? prev + 1 : prev));
    }, 500);

    try {
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch(`/api/projects/${project.id}/scan-repo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          github_repo: repoUrl.trim(),
          github_branch: branch.trim() || 'main',
          github_token: githubToken.trim(),
        }),
      });

      clearInterval(scanStepsInterval);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Repository scan failed');
      }

      const data = await res.json();
      setScanReport(data.scan_report);
      setIsScanReportVisible(true);
      setIsImportFormOpen(false);

      if (data.project) {
        onUpdateProject({ ...data.project, scan_report: data.scan_report });
      }

      // Pre-fill detected env vars with smart demo values
      const detected = data.scan_report?.detected_env_vars || [];
      const defaults = data.scan_report?.detected_env_defaults || {};
      if (detected.length > 0) {
        setEnvVars((prev) => {
          const existingMap = new Map(prev.map((p) => [p.key, p.value]));
          for (const k of detected) {
            if (!existingMap.has(k) || !existingMap.get(k)) {
              existingMap.set(k, defaults[k] || getDemoValueForKey(k, data.scan_report?.framework));
            }
          }
          return Array.from(existingMap.entries()).map(([key, value]) => ({ key, value }));
        });
      }

      onNotify('Repository cloned and scanned.');
    } catch (err: any) {
      clearInterval(scanStepsInterval);
      setScanError(err.message || 'Error during repository scan');
    } finally {
      setIsScanning(false);
    }
  };

  // Step-04: Open Project / Complete Setup
  const handleConfirmAndOpenProject = () => {
    setIsScanReportVisible(false);
    setIsImportFormOpen(false);
    setActiveTab('overview');
    onRefreshProject();
    onNotify(`Project "${project.name}" ready.`);
  };

  // Step-05: General Settings Update
  const handleSaveGeneral = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingGeneral(true);
    try {
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: generalName.trim(),
          description: generalDesc.trim(),
          github_repo: generalRepo.trim(),
          github_branch: generalBranch.trim(),
          build_command: generalBuildCmd.trim(),
          output_dir: generalOutputDir.trim(),
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update settings');
      }

      const updated = await res.json();
      onUpdateProject(updated);
      onNotify('Settings saved.');
    } catch (err: any) {
      onNotify(err.message || 'Error updating settings');
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // Step-05: Domain Settings Update
  const handleSaveDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDomain(true);
    try {
      const token = localStorage.getItem('cf_bulk_token') || '';
      const cleanRoot = domainRoot.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          root_domain: cleanRoot,
          subdomain_pattern: domainSubPattern.trim() || 'site-{index}',
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to update domain settings');
      }

      const updated = await res.json();
      onUpdateProject(updated);
      onNotify('Domain settings saved.');
    } catch (err: any) {
      onNotify(err.message || 'Error updating domain settings');
    } finally {
      setIsSavingDomain(false);
    }
  };

  // Fetch Cloudflare Zones for connected accounts
  const fetchCloudflareZones = async () => {
    setIsLoadingZones(true);
    try {
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch(`/api/auth/cloudflare/zones?project_id=${project.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.zones && Array.isArray(data.zones)) {
          setCfZones(data.zones);
          if (project.root_domain) {
            const matched = data.zones.find((z: any) => z.name.toLowerCase() === project.root_domain.toLowerCase());
            if (matched) {
              setSelectedZoneId(matched.id);
            }
          } else if (data.zones.length > 0 && !selectedZoneId) {
            setSelectedZoneId(data.zones[0].id);
            setDomainRoot(data.zones[0].name);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load CF zones:', err);
    } finally {
      setIsLoadingZones(false);
    }
  };

  // Auto-fetch zones when domain tab is opened or accounts change
  useEffect(() => {
    if (activeTab === 'domain' && accounts.length > 0) {
      fetchCloudflareZones();
    }
  }, [activeTab, accounts.length, project.id]);

  // 1-Click Automated DNS Provisioning
  const handleAutoProvisionDNS = async () => {
    if (!domainRoot.trim()) {
      onNotify('Please select or enter a root domain first.');
      return;
    }
    setIsAutoProvisioning(true);
    setAutoProvisionReport(null);
    try {
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch('/api/auth/cloudflare/dns/auto-provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          project_id: project.id,
          zone_id: selectedZoneId,
          root_domain: domainRoot.trim(),
          proxied: isProxied,
          sync_subdomains: syncSubdomains,
          create_wildcard: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to auto-provision DNS records');
      }

      setAutoProvisionReport(data);
      if (data.root_domain) {
        setDomainRoot(data.root_domain);
        onUpdateProject({ ...project, root_domain: data.root_domain });
      }
      onNotify(`DNS CNAME & Custom Domains provisioned for ${data.root_domain}!`);
      if (onRefreshProject) {
        onRefreshProject();
      }
    } catch (err: any) {
      onNotify(err.message || 'DNS auto-provision failed');
    } finally {
      setIsAutoProvisioning(false);
    }
  };

  // Live DNS & SSL verification tester
  const handleVerifyDnsLive = async () => {
    setIsVerifyingDns(true);
    try {
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch(`/api/auth/cloudflare/dns/verify-status?project_id=${project.id}&domain=${domainRoot.trim()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setDnsVerificationData(data);
        if (data.zone_found) {
          onNotify(`Live DNS verified: ${data.records?.length || 0} Cloudflare records active.`);
        } else {
          onNotify('Domain active on Cloudflare, propagation in progress.');
        }
      }
    } catch (err: any) {
      onNotify(err.message || 'DNS verification failed');
    } finally {
      setIsVerifyingDns(false);
    }
  };

  // Step-05: Save Environment Variables
  const handleSaveEnvVars = async () => {
    setIsSavingEnv(true);
    try {
      const token = localStorage.getItem('cf_bulk_token') || '';
      const envMap: Record<string, string> = {};
      for (const item of envVars) {
        if (item.key.trim()) {
          envMap[item.key.trim()] = item.value;
        }
      }

      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          env_vars: envMap,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save environment variables');
      }

      const updated = await res.json();
      onUpdateProject({ ...project, env_vars: envMap, ...updated });
      onNotify('Environment variables saved.');
    } catch (err: any) {
      onNotify(err.message || 'Error saving environment variables');
    } finally {
      setIsSavingEnv(false);
    }
  };

  // 1-Click Auto-Fill Scanned Keys with smart demo values
  const handleAutoFillScannedKeys = () => {
    const detected = scanReport?.detected_env_vars || project.scan_report?.detected_env_vars || [];
    const defaults = scanReport?.detected_env_defaults || project.scan_report?.detected_env_defaults || {};
    const framework = scanReport?.framework || project.scan_report?.framework || '';

    if (detected.length === 0) {
      // Provide standard framework keys
      const presets = [
        { key: 'VITE_API_URL', value: 'https://api.example.com' },
        { key: 'VITE_APP_TITLE', value: project.name || 'My Application' },
        { key: 'NODE_ENV', value: 'production' },
      ];
      setEnvVars(presets);
      onNotify('Loaded recommended environment keys.');
      return;
    }

    setEnvVars((prev) => {
      const existingMap = new Map(prev.map((p) => [p.key, p.value]));
      for (const k of detected) {
        if (!existingMap.has(k) || !existingMap.get(k)) {
          existingMap.set(k, defaults[k] || getDemoValueForKey(k, framework));
        }
      }
      return Array.from(existingMap.entries()).map(([key, value]) => ({ key, value }));
    });
    onNotify('Auto-filled scanned environment keys.');
  };

  const handleBulkEnvParse = () => {
    const lines = bulkEnvText.split('\n');
    const parsed: Array<{ key: string; value: string }> = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim().toUpperCase();
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (key) parsed.push({ key, value });
      }
    }
    setEnvVars((prev) => {
      const existingMap = new Map(prev.map((i) => [i.key, i.value]));
      for (const p of parsed) {
        existingMap.set(p.key, p.value);
      }
      return Array.from(existingMap.entries()).map(([key, value]) => ({ key, value }));
    });
    setIsBulkEnvModalOpen(false);
    setBulkEnvText('');
    onNotify('Environment variables imported.');
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRecordKey(key);
    setTimeout(() => setCopiedRecordKey(null), 2000);
    onNotify('Copied.');
  };

  // Compile full logs across accounts
  const allLogsCombined = accounts
    .map((a) => {
      if (!a.logs) return '';
      return `[Account: ${a.alias} / Domain: ${a.subdomain}.${project.root_domain || 'pages.dev'}]\n${a.logs}\n`;
    })
    .filter(Boolean)
    .join('\n----------------------------------------\n\n');

  // Filtered logs based on logFilterAccountId
  const displayedLogs = React.useMemo(() => {
    if (isLogsCleared) return '';
    if (logFilterAccountId === 'all') {
      return allLogsCombined;
    }
    const acc = accounts.find((a) => a.id === logFilterAccountId);
    if (!acc) return allLogsCombined;
    return acc.logs || `[Account: ${acc.alias} / Domain: ${acc.subdomain}.${project.root_domain || 'pages.dev'}]\nNo build output recorded for this account.`;
  }, [logFilterAccountId, allLogsCombined, accounts, project.root_domain, isLogsCleared]);

  // Derived build debug metrics
  const activeDeployments = accounts.filter((a) => a.build_status === 'building' || a.build_status === 'queued');
  const failedDeployments = accounts.filter((a) => a.build_status === 'failed');
  const successDeployments = accounts.filter((a) => a.build_status === 'success');

  const currentStepMessage = accounts.find((a) => a.current_step && (a.build_status === 'building' || a.build_status === 'queued'))?.current_step ||
    (isBuilding ? 'Processing build pipeline...' : project.status === 'completed' ? 'All accounts live & deployed' : project.status === 'failed' ? 'Build halted on error' : 'Ready to deploy');

  const avgProgress = accounts.length > 0
    ? Math.round(accounts.reduce((sum, a) => sum + (a.progress_percent || 0), 0) / accounts.length)
    : (isBuilding ? 20 : 0);

  // Filter accounts
  const filteredAccounts = accounts.filter(
    (a) =>
      a.alias.toLowerCase().includes(accountSearch.toLowerCase()) ||
      a.subdomain.toLowerCase().includes(accountSearch.toLowerCase()) ||
      (a.account_id && a.account_id.toLowerCase().includes(accountSearch.toLowerCase()))
  );

  const detectedScannedKeys = scanReport?.detected_env_vars || project.scan_report?.detected_env_vars || [];

  const primaryPagesTargetHost = (accounts.length > 0 && accounts[0].pages_dev_domain)
    ? accounts[0].pages_dev_domain.replace(/^https?:\/\//, '').replace(/\/+$/, '')
    : `${project.name.toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'project'}.pages.dev`;

  // -------------------------------------------------------------
  // RENDER: Step-02, Step-03, Step-04 (Blank Repo / Import Form / Scan Report)
  // -------------------------------------------------------------
  if (!hasConfiguredRepo || isScanReportVisible) {
    return (
      <div className="flex-1 h-full w-full overflow-y-auto p-3 flex flex-col justify-start bg-slate-950 font-['Plus_Jakarta_Sans',sans-serif]">
        <div className="w-full max-w-3xl mx-auto space-y-2.5">
          {/* Top Compact Breadcrumb */}
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400">
                <FolderGit2 className="w-3 h-3" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-100">{project.name}</span>
                <span className="text-[9px] font-mono text-amber-400 bg-amber-950/80 border border-amber-800 px-1 rounded">
                  {scanReport && isScanReportVisible ? 'Scan Completed' : 'Blank Project'}
                </span>
              </div>
            </div>
          </div>

          {/* Step-04: Scan Report Card */}
          {scanReport && isScanReportVisible ? (
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2.5 shadow-lg animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-slate-100">Project Scan Report</h3>
                  <span className="text-[10px] font-mono text-slate-400">({repoUrl})</span>
                </div>

                <span className="text-[9px] font-mono text-emerald-300 bg-emerald-950 border border-emerald-800 px-1.5 py-0.2 rounded font-bold">
                  Cloudflare Compatible
                </span>
              </div>

              {/* Scan Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] font-mono">
                <div className="bg-slate-950 border border-slate-800 rounded p-2 space-y-0.5">
                  <span className="text-[10px] text-slate-400 block uppercase">Framework</span>
                  <span className="font-bold text-orange-400 truncate block">{scanReport.framework}</span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded p-2 space-y-0.5">
                  <span className="text-[10px] text-slate-400 block uppercase">Language</span>
                  <span className="font-bold text-sky-400 truncate block">{scanReport.language}</span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded p-2 space-y-0.5">
                  <span className="text-[10px] text-slate-400 block uppercase">Architecture</span>
                  <span className="font-bold text-emerald-400 truncate block">{scanReport.architecture}</span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded p-2 space-y-0.5">
                  <span className="text-[10px] text-slate-400 block uppercase">Nature</span>
                  <span className="font-bold text-purple-400 truncate block">{scanReport.page_nature}</span>
                </div>
              </div>

              {/* Specs */}
              <div className="bg-slate-950 border border-slate-800 rounded p-2.5 space-y-1.5 text-[11px] font-mono">
                <div className="flex items-center justify-between text-[10px] border-b border-slate-800/80 pb-1">
                  <span className="text-slate-400">Build Command:</span>
                  <span className="text-orange-300 font-bold bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                    {scanReport.recommended_build_command}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] border-b border-slate-800/80 pb-1">
                  <span className="text-slate-400">Output Directory:</span>
                  <span className="text-emerald-300 font-bold bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">
                    {scanReport.recommended_output_dir}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">Cloudflare Readiness:</span>
                  <span className="text-slate-200">{scanReport.cloudflare_status}</span>
                </div>
              </div>

              {/* Detected ENV and Databases */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono">
                <div className="bg-slate-950 border border-slate-800 rounded p-2 space-y-1">
                  <span className="text-slate-400 font-bold flex items-center gap-1">
                    <KeyRound className="w-3 h-3 text-orange-400" />
                    <span>Environment Keys ({scanReport.detected_env_vars.length})</span>
                  </span>
                  {scanReport.detected_env_vars.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                      {scanReport.detected_env_vars.map((ev) => (
                        <span key={ev} className="bg-slate-900 border border-slate-800 px-1.5 py-0.2 rounded text-slate-300">
                          {ev}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500 italic">None required</span>
                  )}
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded p-2 space-y-1">
                  <span className="text-slate-400 font-bold flex items-center gap-1">
                    <Database className="w-3 h-3 text-sky-400" />
                    <span>Integrations ({scanReport.detected_databases.length})</span>
                  </span>
                  {scanReport.detected_databases.length > 0 ? (
                    <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                      {scanReport.detected_databases.map((db) => (
                        <span key={db} className="bg-slate-900 border border-slate-800 px-1.5 py-0.2 rounded text-sky-300">
                          {db}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-500 italic">None</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsScanReportVisible(false);
                    setIsImportFormOpen(true);
                  }}
                  className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white bg-slate-800 rounded transition cursor-pointer"
                >
                  Reconfigure
                </button>

                <button
                  type="button"
                  onClick={handleConfirmAndOpenProject}
                  className="px-3.5 py-1 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <span>Open Workplace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : isImportFormOpen || isScanning ? (
            /* Step-02 & Step-03 Form */
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 space-y-3 shadow-lg">
              <div className="border-b border-slate-800 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-orange-400" />
                  <h3 className="text-xs font-bold text-slate-100">Add Git Repository</h3>
                </div>
                <button
                  type="button"
                  disabled={isScanning}
                  onClick={() => setIsImportFormOpen(false)}
                  className="text-[10px] text-slate-400 hover:text-slate-200 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {scanError && (
                <div className="p-2 bg-red-950/60 border border-red-800 rounded text-[11px] font-mono text-red-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                  <span>{scanError}</span>
                </div>
              )}

              <form onSubmit={handleStartScan} className="space-y-2.5 text-[11px]">
                <div>
                  <label className="block text-slate-400 mb-0.5">Repository URL *</label>
                  <div className="relative">
                    <GitBranch className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      disabled={isScanning}
                      placeholder="https://github.com/owner/repository"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-2.5 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500 disabled:opacity-50"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-0.5">Branch</label>
                    <input
                      type="text"
                      disabled={isScanning}
                      placeholder="main"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-0.5">GitHub Token (Optional)</label>
                    <input
                      type="password"
                      disabled={isScanning}
                      placeholder="ghp_••••••••••••••••"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500 disabled:opacity-50"
                    />
                  </div>
                </div>

                {/* Step-03 Scan Animation Checklist */}
                {isScanning && (
                  <div className="bg-slate-950 border border-slate-800 rounded p-2.5 space-y-1.5 text-[10px] font-mono">
                    <div className="flex items-center gap-1.5 text-orange-400 font-bold border-b border-slate-800 pb-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Scanning Repository...</span>
                    </div>

                    <div className="space-y-1">
                      {[
                        'Connecting to GitHub & commit metadata',
                        'Cloning repository workspace',
                        'Scanning programming languages',
                        'Detecting framework & architecture',
                        'Auditing Cloudflare Pages build rules',
                        'Extracting environment keys & config',
                        'Inspecting database connectors',
                        'Validating routing structure',
                      ].map((step, idx) => {
                        const isDone = scanStepIndex > idx;
                        const isCurrent = scanStepIndex === idx;
                        return (
                          <div key={step} className="flex items-center gap-2">
                            {isDone ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                            ) : isCurrent ? (
                              <RefreshCw className="w-3 h-3 text-orange-400 animate-spin shrink-0" />
                            ) : (
                              <div className="w-3 h-3 rounded-full border border-slate-700 shrink-0" />
                            )}
                            <span className={isDone ? 'text-slate-300' : isCurrent ? 'text-orange-300 font-bold' : 'text-slate-600'}>
                              {step}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800 flex justify-end gap-1.5">
                  <button
                    type="button"
                    disabled={isScanning}
                    onClick={() => setIsImportFormOpen(false)}
                    className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white bg-slate-800 rounded transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isScanning}
                    className="px-3.5 py-1 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{isScanning ? 'Scanning...' : 'Clone & Scan'}</span>
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Step-02 Blank Project State */
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center space-y-2.5 shadow-lg">
              <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-orange-400 mx-auto border border-slate-700">
                <GitBranch className="w-5 h-5" />
              </div>

              <div className="text-xs font-bold text-slate-100">No Repository Connected</div>

              <button
                type="button"
                onClick={() => setIsImportFormOpen(true)}
                className="px-3.5 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded transition inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Git Repository</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Step-05 Project Workplace Page (Coolify Style Nested Secondary Sidebar)
  // -------------------------------------------------------------
  return (
    <div className="flex-1 h-full w-full flex overflow-hidden bg-slate-950 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Nested Workplace Sub-Sidebar */}
      <aside className="w-40 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 h-full min-h-0 select-none">
        {/* Project Context Header */}
        <div className="p-2 border-b border-slate-800 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <div className="w-4 h-4 rounded bg-orange-600/20 text-orange-400 flex items-center justify-center shrink-0">
              <FolderGit2 className="w-2.5 h-2.5" />
            </div>
            <span className="text-[11px] font-bold text-slate-100 truncate">{project.name}</span>
          </div>
          <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mt-1">
            <span className="truncate">{project.github_repo ? project.github_repo.replace('https://github.com/', '') : 'configured'}</span>
            <span className="text-emerald-400 font-bold shrink-0">{project.github_branch || 'main'}</span>
          </div>
        </div>

        {/* Sub-Sidebar Navigation Items */}
        <nav className="p-1.5 space-y-0.5 flex-1 overflow-y-auto min-h-0">
          {[
            { id: 'overview' as WorkplaceSubTab, label: 'Overview', icon: LayoutDashboard },
            { id: 'general' as WorkplaceSubTab, label: 'General', icon: Settings },
            { id: 'environment' as WorkplaceSubTab, label: 'Environment', icon: KeyRound, count: envVars.length },
            { id: 'domain' as WorkplaceSubTab, label: 'Domain', icon: Globe },
            { id: 'cloudflare' as WorkplaceSubTab, label: 'Cloudflare', icon: Cloud, count: accounts.length },
            { id: 'logs' as WorkplaceSubTab, label: 'Logs', icon: Terminal, pulse: isBuilding },
            { id: 'history' as WorkplaceSubTab, label: 'History', icon: HistoryIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  isActive
                    ? 'bg-orange-600/15 text-orange-400 border border-orange-500/30 font-semibold shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-orange-400' : 'text-slate-500'}`} />
                  <span className="truncate">{tab.label}</span>
                </div>
                {tab.count !== undefined && (
                  <span
                    className={`text-[9px] font-mono px-1 py-0.2 rounded border ${
                      isActive
                        ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
                {tab.pulse && (
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping shrink-0" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Build Action */}
        <div className="p-2 border-t border-slate-800 bg-slate-950/50 shrink-0">
          {isBuilding ? (
            <button
              onClick={onCancelBuild}
              className="w-full py-1 text-[10px] font-semibold text-red-300 bg-red-950/80 hover:bg-red-900 border border-red-800 rounded transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <RotateCw className="w-3 h-3 animate-spin" />
              <span>Cancel Build</span>
            </button>
          ) : (
            <button
              onClick={() => handleTriggerBuildWithAutoSwitch(selectedAccountIds.length > 0 ? selectedAccountIds : undefined)}
              disabled={accounts.length === 0}
              className="w-full py-1 text-[10px] font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center justify-center gap-1 shadow-xs cursor-pointer"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>{selectedAccountIds.length > 0 ? `Deploy (${selectedAccountIds.length})` : 'Deploy Fleet'}</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Workplace Content Area */}
      <main className="flex-1 h-full p-3 overflow-y-auto bg-slate-950 min-h-0">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-2.5 max-w-5xl mx-auto">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1">
                <span className="text-[10px] text-slate-400 block font-mono uppercase">Status</span>
                <span
                  className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded inline-block ${
                    isBuilding
                      ? 'bg-blue-950 text-blue-300 border border-blue-700 animate-pulse'
                      : project.status === 'completed'
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {isBuilding ? 'Building' : project.status || 'Ready'}
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1">
                <span className="text-[10px] text-slate-400 block font-mono uppercase">Commit</span>
                <span className="text-[11px] font-mono font-bold text-slate-200 block truncate">
                  {project.latest_commit_sha ? `#${project.latest_commit_sha}` : 'HEAD'}
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1">
                <span className="text-[10px] text-slate-400 block font-mono uppercase">Root Domain</span>
                <span className="text-[11px] font-mono font-bold text-emerald-400 block truncate">
                  {project.root_domain || 'pages.dev'}
                </span>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-1">
                <span className="text-[10px] text-slate-400 block font-mono uppercase">Accounts</span>
                <span className="text-[11px] font-mono font-bold text-sky-400 block">
                  {accounts.length}
                </span>
              </div>
            </div>

            {/* Scan Summary Banner */}
            {project.scan_report && (
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 flex items-center justify-between text-[11px] font-mono">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-orange-400">
                    <Code2 className="w-3.5 h-3.5" />
                    <span>{project.scan_report.framework}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sky-400">
                    <Cpu className="w-3.5 h-3.5" />
                    <span>{project.scan_report.language}</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-emerald-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>CF Ready</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsScanReportVisible(true)}
                  className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>Scan Report</span>
                </button>
              </div>
            )}

            {/* Fleet Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-orange-400" />
                  <span>Fleet Accounts ({accounts.length})</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleConnectOAuth}
                    disabled={isConnectingOAuth}
                    className="px-2 py-0.5 text-[10px] font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center gap-1 cursor-pointer active:scale-95"
                    title="1-Click Cloudflare Auth App Connect popup"
                  >
                    <Cloud className="w-3 h-3" />
                    <span>{isConnectingOAuth ? 'Connecting...' : 'Connect Auth App'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={onOpenBulkModal}
                    className="px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition flex items-center gap-1 cursor-pointer"
                    title="Add via API Token or Bulk Import"
                  >
                    <KeyRound className="w-3 h-3 text-slate-400" />
                    <span>API Token / Bulk</span>
                  </button>

                  {selectedAccountIds.length > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleTriggerBuildWithAutoSwitch(selectedAccountIds)}
                        disabled={isBuilding}
                        className="px-2.5 py-0.5 text-[10px] font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Play className="w-2.5 h-2.5 fill-current" />
                        <span>Deploy Selected ({selectedAccountIds.length})</span>
                      </button>
                      <button
                        onClick={() => handleTriggerBuildWithAutoSwitch()}
                        disabled={isBuilding}
                        className="px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition flex items-center gap-1 cursor-pointer"
                      >
                        <span>Deploy All</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleTriggerBuildWithAutoSwitch()}
                      disabled={accounts.length === 0 || isBuilding}
                      className="px-2.5 py-0.5 text-[10px] font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Deploy Fleet</span>
                    </button>
                  )}
                </div>
              </div>

              <AccountTable
                project={project}
                accounts={filteredAccounts}
                selectedIds={selectedAccountIds}
                onToggleSelect={(id) => {
                  setSelectedAccountIds((prev) =>
                    prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
                  );
                }}
                onToggleSelectAll={() => {
                  if (selectedAccountIds.length === filteredAccounts.length) {
                    setSelectedAccountIds([]);
                  } else {
                    setSelectedAccountIds(filteredAccounts.map((a) => a.id));
                  }
                }}
                onViewAccount={onViewAccount}
                onRebuildAccount={handleRebuildAccountWithAutoSwitch}
                onDeleteAccount={onDeleteAccount}
                isBuilding={isBuilding}
                onConnectOAuth={handleConnectOAuth}
                onAddManual={onOpenBulkModal}
              />
            </div>
          </div>
        )}

        {/* TAB 2: GENERAL SETTINGS */}
        {activeTab === 'general' && (
          <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2.5">
            <div className="border-b border-slate-800 pb-1.5">
              <h3 className="text-xs font-bold text-slate-100">General Settings</h3>
            </div>

            <form onSubmit={handleSaveGeneral} className="space-y-2.5 text-[11px]">
              <div>
                <label className="block text-slate-400 mb-0.5">Project Name *</label>
                <input
                  type="text"
                  required
                  value={generalName}
                  onChange={(e) => setGeneralName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-0.5">Description</label>
                <textarea
                  rows={2}
                  value={generalDesc}
                  onChange={(e) => setGeneralDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-slate-400 mb-0.5">Repository URL</label>
                  <input
                    type="text"
                    value={generalRepo}
                    onChange={(e) => setGeneralRepo(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-0.5">Branch</label>
                  <input
                    type="text"
                    value={generalBranch}
                    onChange={(e) => setGeneralBranch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-0.5">Build Command</label>
                  <input
                    type="text"
                    value={generalBuildCmd}
                    onChange={(e) => setGeneralBuildCmd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-0.5">Output Directory</label>
                  <input
                    type="text"
                    value={generalOutputDir}
                    onChange={(e) => setGeneralOutputDir(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingGeneral}
                  className="px-3.5 py-1 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center gap-1 cursor-pointer"
                >
                  <Save className="w-3 h-3" />
                  <span>{isSavingGeneral ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: ENVIRONMENT VARIABLES */}
        {activeTab === 'environment' && (
          <div className="max-w-3xl mx-auto bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-2">
                <KeyRound className="w-3.5 h-3.5 text-orange-400" />
                <h3 className="text-xs font-bold text-slate-100">Environment Variables</h3>
                <span className="text-[9px] font-mono bg-slate-950 text-slate-400 border border-slate-800 px-1 py-0.2 rounded">
                  {envVars.length} keys
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAutoFillScannedKeys}
                  className="px-2 py-0.5 text-[10px] font-semibold text-orange-300 hover:text-white bg-orange-950/80 hover:bg-orange-900 border border-orange-800 rounded transition flex items-center gap-1 cursor-pointer"
                  title="Auto-fill detected repository environment variables"
                >
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>Auto-Fill Scanned</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsBulkEnvModalOpen(true)}
                  className="px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition cursor-pointer"
                >
                  Bulk Import
                </button>

                <button
                  type="button"
                  onClick={() => setEnvVars((prev) => [...prev, { key: '', value: '' }])}
                  className="px-2.5 py-0.5 text-[10px] font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Variable</span>
                </button>
              </div>
            </div>

            {/* Detected Scanned Keys Fast-Add Strip */}
            {detectedScannedKeys.length > 0 && (
              <div className="bg-slate-950 border border-slate-800/90 rounded p-2 space-y-1.5 text-[10px] font-mono">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="font-bold flex items-center gap-1 text-[10px] text-slate-300">
                    <Sparkles className="w-3 h-3 text-orange-400" />
                    <span>Scanned Repo Variables ({detectedScannedKeys.length})</span>
                  </span>
                  <span className="text-[9px] text-slate-500">Click to add with smart demo value</span>
                </div>

                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {detectedScannedKeys.map((k) => {
                    const isAdded = envVars.some((ev) => ev.key.trim().toUpperCase() === k.trim().toUpperCase());
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => {
                          if (!isAdded) {
                            const defaults = scanReport?.detected_env_defaults || project.scan_report?.detected_env_defaults || {};
                            const demoVal = defaults[k] || getDemoValueForKey(k, scanReport?.framework || '');
                            setEnvVars((prev) => [...prev, { key: k, value: demoVal }]);
                          }
                        }}
                        className={`px-1.5 py-0.5 rounded text-[9px] border flex items-center gap-1 transition cursor-pointer ${
                          isAdded
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80 cursor-default'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-orange-500 hover:text-orange-300'
                        }`}
                      >
                        {isAdded ? (
                          <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
                        ) : (
                          <Plus className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                        )}
                        <span>{k}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Variable Rows */}
            {envVars.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-[11px] font-mono space-y-2">
                <div>No environment variables configured.</div>
                <button
                  type="button"
                  onClick={handleAutoFillScannedKeys}
                  className="px-2.5 py-1 text-[10px] font-semibold text-orange-400 bg-orange-950/50 hover:bg-orange-900/60 border border-orange-800 rounded transition inline-flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Populate Demo Variables</span>
                </button>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {envVars.map((item, idx) => {
                  const isScannedKey = detectedScannedKeys.some(
                    (dk) => dk.toUpperCase() === item.key.trim().toUpperCase()
                  );

                  return (
                    <div key={idx} className="flex items-center gap-1.5 text-[11px] font-mono">
                      <div className="relative w-2/5 flex items-center">
                        <input
                          type="text"
                          placeholder="KEY"
                          value={item.key}
                          onChange={(e) => {
                            const next = [...envVars];
                            next[idx].key = e.target.value.toUpperCase();
                            setEnvVars(next);
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded pl-2 pr-12 py-1 text-slate-200 focus:outline-none focus:border-orange-500 text-[11px]"
                        />
                        {isScannedKey && (
                          <span className="absolute right-1.5 text-[8px] bg-orange-950/80 text-orange-400 border border-orange-800 px-1 py-0.2 rounded font-bold pointer-events-none">
                            scanned
                          </span>
                        )}
                      </div>

                      <span className="text-slate-600 font-bold">=</span>

                      <input
                        type="text"
                        placeholder="VALUE (Demo value or your custom secret)"
                        value={item.value}
                        onChange={(e) => {
                          const next = [...envVars];
                          next[idx].value = e.target.value;
                          setEnvVars(next);
                        }}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 focus:outline-none focus:border-orange-500 text-[11px]"
                      />

                      <button
                        type="button"
                        onClick={() => copyToClipboard(`${item.key}=${item.value}`, `env_${idx}`)}
                        className="p-1 text-slate-500 hover:text-slate-200 hover:bg-slate-800 rounded transition cursor-pointer"
                        title="Copy variable"
                      >
                        {copiedRecordKey === `env_${idx}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setEnvVars((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition cursor-pointer"
                        title="Delete variable"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-mono">
                Variables are injected into the build workspace during execution
              </span>

              <button
                type="button"
                onClick={handleSaveEnvVars}
                disabled={isSavingEnv}
                className="px-3.5 py-1 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center gap-1 cursor-pointer shadow-xs"
              >
                <Save className="w-3 h-3" />
                <span>{isSavingEnv ? 'Saving...' : 'Save Variables'}</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: DOMAIN MANAGEMENT & 1-CLICK CLOUDFLARE DNS AUTOMATION */}
        {activeTab === 'domain' && (
          <div className="max-w-4xl mx-auto space-y-2.5 font-['Plus_Jakarta_Sans',sans-serif]">
            {/* Main Automation Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2.5">
              <div className="border-b border-slate-800 pb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded bg-emerald-950/80 border border-emerald-800 flex items-center justify-center text-emerald-400 shrink-0">
                    <Globe className="w-3 h-3" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                      <span>Cloudflare Domain & DNS Automation</span>
                      <span className="text-[9px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.2 rounded font-bold">
                        {project.root_domain ? project.root_domain : 'pages.dev'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleConnectOAuth}
                    disabled={isConnectingOAuth}
                    className="px-2.5 py-0.5 text-[10px] font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                    title={
                      isOAuthConfigured
                        ? '1-Click Connect Cloudflare Account (OAuth 2.0 Ready)'
                        : 'Connect Cloudflare Account (Configured in /vcon Settings)'
                    }
                  >
                    <Cloud className="w-3 h-3" />
                    <span>{isConnectingOAuth ? 'Connecting...' : 'Connect Cloudflare'}</span>
                    {isOAuthConfigured && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="1-Click OAuth Active" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={fetchCloudflareZones}
                    disabled={isLoadingZones || accounts.length === 0}
                    className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-700/80 rounded transition cursor-pointer"
                    title="Refresh Cloudflare Zones list"
                  >
                    <RefreshCw className={`w-3 h-3 ${isLoadingZones ? 'animate-spin text-orange-400' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={handleVerifyDnsLive}
                    disabled={isVerifyingDns || !domainRoot}
                    className="px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition flex items-center gap-1 cursor-pointer"
                    title="Query live Cloudflare DNS status"
                  >
                    <Activity className={`w-3 h-3 ${isVerifyingDns ? 'animate-spin text-blue-400' : 'text-slate-400'}`} />
                    <span>{isVerifyingDns ? 'Checking...' : 'Verify DNS'}</span>
                  </button>
                </div>
              </div>

              {/* Cloudflare Zone Picker & Custom Domain Input */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 text-[11px]">
                {/* Cloudflare Detected Zones Dropdown */}
                <div className="md:col-span-6 space-y-1">
                  <div className="flex items-center justify-between text-slate-400">
                    <label className="font-semibold text-slate-300 flex items-center gap-1">
                      <Cloud className="w-3 h-3 text-orange-400" />
                      <span>Cloudflare Zone (Auto-Detected)</span>
                    </label>
                    <span className="text-[9px] font-mono text-slate-500">
                      {cfZones.length} zone{cfZones.length === 1 ? '' : 's'} available
                    </span>
                  </div>

                  {cfZones.length > 0 ? (
                    <select
                      value={selectedZoneId}
                      onChange={(e) => {
                        const zid = e.target.value;
                        setSelectedZoneId(zid);
                        const matched = cfZones.find((z) => z.id === zid);
                        if (matched) {
                          setDomainRoot(matched.name);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500 cursor-pointer"
                    >
                      <option value="">-- Select from your Cloudflare Zones --</option>
                      {cfZones.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.name} ({z.account.name || 'Account'} • {z.plan})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="bg-slate-950 border border-slate-800/80 rounded px-2.5 py-1 text-slate-400 font-mono text-[10px] flex items-center justify-between">
                      <span>{accounts.length === 0 ? (isOAuthConfigured ? 'No CF accounts — click "Connect Cloudflare" above' : 'No CF accounts connected') : 'Click "Connect Cloudflare" or enter domain'}</span>
                      {accounts.length > 0 ? (
                        <button
                          type="button"
                          onClick={fetchCloudflareZones}
                          className="text-orange-400 hover:underline font-bold text-[9px]"
                        >
                          Fetch Zones
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleConnectOAuth}
                          className="text-orange-400 hover:underline font-bold text-[9px]"
                        >
                          {isOAuthConfigured ? '+ 1-Click Connect' : '+ Add Account'}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Root Domain Input */}
                <div className="md:col-span-3 space-y-1">
                  <label className="block text-slate-300 font-semibold">Root Domain</label>
                  <div className="relative">
                    <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="example.com"
                      value={domainRoot}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDomainRoot(val);
                        // Try matching with zones
                        const matched = cfZones.find((z) => z.name.toLowerCase() === val.trim().toLowerCase());
                        if (matched) {
                          setSelectedZoneId(matched.id);
                        } else {
                          setSelectedZoneId('');
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-2.5 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>

                {/* Subdomain Pattern */}
                <div className="md:col-span-3 space-y-1">
                  <label className="block text-slate-300 font-semibold">Subdomain Pattern</label>
                  <input
                    type="text"
                    placeholder="site-{index}"
                    value={domainSubPattern}
                    onChange={(e) => setDomainSubPattern(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {/* Automation Toggles & 1-Click Provision Bar */}
              <div className="bg-slate-950 border border-slate-800/90 rounded p-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
                    <input
                      type="checkbox"
                      checked={isProxied}
                      onChange={(e) => setIsProxied(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-orange-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                    />
                    <span className="flex items-center gap-1 font-mono text-[10px]">
                      <span className={`w-2 h-2 rounded-full ${isProxied ? 'bg-orange-500 shadow-xs' : 'bg-slate-600'}`} />
                      Cloudflare Proxy (Orange Cloud)
                    </span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white select-none">
                    <input
                      type="checkbox"
                      checked={syncSubdomains}
                      onChange={(e) => setSyncSubdomains(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-orange-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
                    />
                    <span className="font-mono text-[10px] text-slate-400">
                      Auto-Bind Subdomains to Pages ({accounts.length})
                    </span>
                  </label>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSaveDomain}
                    disabled={isSavingDomain}
                    className="px-2.5 py-1 text-[10px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition flex items-center gap-1 cursor-pointer"
                  >
                    <Save className="w-3 h-3" />
                    <span>{isSavingDomain ? 'Saving...' : 'Save Settings'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAutoProvisionDNS}
                    disabled={isAutoProvisioning || accounts.length === 0 || !domainRoot.trim()}
                    className="px-3.5 py-1 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 font-mono"
                  >
                    {isAutoProvisioning ? (
                      <>
                        <RotateCw className="w-3 h-3 animate-spin" />
                        <span>Provisioning DNS...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-3 h-3 fill-current text-amber-300" />
                        <span>Auto-Provision DNS</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Automation Result HUD Banner */}
              {autoProvisionReport && (
                <div className="bg-emerald-950/60 border border-emerald-800/80 rounded p-2 space-y-1 font-mono text-[10px] animate-in fade-in">
                  <div className="flex items-center justify-between text-emerald-300 font-bold">
                    <div className="flex items-center gap-1.5">
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>DNS & Custom Domains Fully Automated!</span>
                    </div>
                    <span className="text-[9px] bg-emerald-900 text-emerald-200 px-1.5 py-0.2 rounded">
                      {autoProvisionReport.zone_name}
                    </span>
                  </div>
                  <div className="text-slate-300 text-[9px] flex flex-wrap gap-x-3 gap-y-1 pt-0.5">
                    <span>• Wildcard CNAME: <span className="text-emerald-400 font-bold">*.{autoProvisionReport.root_domain}</span> → {autoProvisionReport.wildcard_target}</span>
                    <span>• Records Synced: <span className="text-sky-300 font-bold">{autoProvisionReport.provisioned_records?.length || 0}</span></span>
                    <span>• Pages Bound: <span className="text-amber-300 font-bold">{autoProvisionReport.pages_bound_count || 0} accounts</span></span>
                  </div>
                </div>
              )}

              {/* Live Verification Status Pill */}
              {dnsVerificationData && (
                <div className="bg-slate-950 border border-slate-800 rounded p-2 flex items-center justify-between font-mono text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${dnsVerificationData.zone_found ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`} />
                    <span className="text-slate-300">
                      Live DNS Status: <strong className={dnsVerificationData.zone_found ? 'text-emerald-400' : 'text-amber-400'}>{dnsVerificationData.zone_found ? 'Active & Verified' : 'Checking Propagation'}</strong>
                    </span>
                    <span className="text-slate-500">
                      ({dnsVerificationData.records?.length || 0} active records on Cloudflare)
                    </span>
                  </div>
                  <span className="text-slate-500 text-[9px]">
                    Verified: {new Date(dnsVerificationData.verified_at).toLocaleTimeString()}
                  </span>
                </div>
              )}
            </div>

            {/* DNS Records & Subdomain Fleet Mapping */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
              <div className="border-b border-slate-800 pb-1.5 flex items-center justify-between">
                <div className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Network className="w-3.5 h-3.5 text-sky-400" />
                  <span>Configured DNS CNAME Records</span>
                </div>

                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                  <span>Wildcard Routing: <strong className="text-emerald-400">Enabled</strong></span>
                  <span>•</span>
                  <span>SSL: <strong className="text-emerald-400">Cloudflare Universal SSL</strong></span>
                </div>
              </div>

              {/* Primary Wildcard Record */}
              <div className="bg-slate-950 border border-slate-800 rounded p-2 space-y-1.5 text-[11px] font-mono">
                <div className="grid grid-cols-12 gap-2 items-center text-[10px] text-slate-400 border-b border-slate-800/80 pb-1 uppercase font-bold">
                  <div className="col-span-2">Type</div>
                  <div className="col-span-3">Host</div>
                  <div className="col-span-3">Target</div>
                  <div className="col-span-2 text-center">Proxy</div>
                  <div className="col-span-2 text-right">Action</div>
                </div>

                <div className="grid grid-cols-12 gap-2 items-center text-slate-200">
                  <div className="col-span-2">
                    <span className="bg-blue-950 text-blue-300 border border-blue-800 px-1.5 py-0.2 rounded font-bold text-[9px]">
                      CNAME
                    </span>
                  </div>
                  <div className="col-span-3 truncate text-emerald-400 font-bold">
                    {domainRoot ? `*.${domainRoot}` : '*.example.com'}
                  </div>
                  <div className="col-span-3 truncate text-slate-300">
                    {primaryPagesTargetHost}
                  </div>
                  <div className="col-span-2 text-center">
                    <span className="bg-orange-950/80 text-orange-400 border border-orange-800 px-1 py-0.2 rounded font-bold text-[8px] inline-flex items-center gap-1">
                      <Cloud className="w-2.5 h-2.5 fill-current" />
                      <span>Proxied</span>
                    </span>
                  </div>
                  <div className="col-span-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(
                          `*.${domainRoot || 'example.com'} CNAME ${primaryPagesTargetHost}`,
                          'wildcard_cname'
                        )
                      }
                      className="px-2 py-0.5 text-[10px] text-slate-300 hover:text-white bg-slate-800 border border-slate-700 rounded transition inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedRecordKey === 'wildcard_cname' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>Copy</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Connected Subdomain Fleet List */}
              {accounts.length > 0 && (
                <div className="space-y-1 pt-1">
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pb-0.5">
                    <span className="font-bold text-slate-300">
                      Connected Subdomains Fleet ({accounts.length})
                    </span>
                    <span className="text-[9px] text-slate-500">
                      Auto-provisioned & routed to Cloudflare Pages
                    </span>
                  </div>

                  <div className="max-h-52 overflow-y-auto space-y-1">
                    {accounts.map((acc, idx) => {
                      const fullSubdomain = acc.custom_domain ? acc.custom_domain.replace(/^https?:\/\//, '') : `${acc.subdomain}.${project.root_domain || 'pages.dev'}`;
                      return (
                        <div
                          key={acc.id}
                          className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 flex items-center justify-between text-[10px] font-mono hover:border-slate-700 transition"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-slate-500 w-4">{idx + 1}.</span>
                            <span className="font-bold text-slate-200 truncate max-w-[120px]">{acc.alias}</span>
                            <span className="text-slate-600">→</span>
                            <span className="text-emerald-400 font-bold truncate">{fullSubdomain}</span>
                            <span className="bg-emerald-950/80 text-emerald-300 border border-emerald-800 px-1 py-0.1 rounded text-[8px] font-bold">
                              {acc.dns_status || 'connected'}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => copyToClipboard(fullSubdomain, `sub_${acc.id}`)}
                              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition cursor-pointer"
                              title="Copy Subdomain URL"
                            >
                              {copiedRecordKey === `sub_${acc.id}` ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            <a
                              href={`https://${fullSubdomain}`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-slate-400 hover:text-orange-400 hover:bg-slate-800 rounded transition"
                              title="Open Live Subdomain in New Tab"
                            >
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 5: CLOUDFLARE ACCOUNTS */}
        {activeTab === 'cloudflare' && (
          <div className="space-y-2 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                <Cloud className="w-3.5 h-3.5 text-orange-400" />
                <span>Cloudflare Accounts ({accounts.length})</span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleConnectOAuth}
                  disabled={isConnectingOAuth}
                  className="px-2.5 py-0.5 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                  title={
                    isOAuthConfigured
                      ? '1-Click Connect Cloudflare Account (OAuth 2.0 Ready)'
                      : 'Open Cloudflare Auth App popup (Configured in /vcon Settings)'
                  }
                >
                  <Cloud className="w-3.5 h-3.5" />
                  <span>{isConnectingOAuth ? 'Connecting...' : 'Connect Account (Auth App)'}</span>
                  {isOAuthConfigured && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" title="1-Click OAuth Active" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={onOpenBulkModal}
                  className="px-2.5 py-0.5 text-[11px] font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition flex items-center gap-1 cursor-pointer"
                  title="Add via API Token or Bulk Import"
                >
                  <KeyRound className="w-3 h-3 text-slate-400" />
                  <span>API Token / Bulk</span>
                </button>

                {selectedAccountIds.length > 0 ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleTriggerBuildWithAutoSwitch(selectedAccountIds)}
                      disabled={isBuilding}
                      className="px-3 py-0.5 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Deploy Selected ({selectedAccountIds.length})</span>
                    </button>
                    <button
                      onClick={() => handleTriggerBuildWithAutoSwitch()}
                      disabled={isBuilding}
                      className="px-2.5 py-0.5 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition flex items-center gap-1 cursor-pointer"
                    >
                      <span>Deploy All</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleTriggerBuildWithAutoSwitch()}
                    disabled={accounts.length === 0 || isBuilding}
                    className="px-3 py-0.5 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Play className="w-2.5 h-2.5 fill-current" />
                    <span>Deploy All</span>
                  </button>
                )}
              </div>
            </div>

            <AccountTable
              project={project}
              accounts={filteredAccounts}
              selectedIds={selectedAccountIds}
              onToggleSelect={(id) => {
                setSelectedAccountIds((prev) =>
                  prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
                );
              }}
              onToggleSelectAll={() => {
                if (selectedAccountIds.length === filteredAccounts.length) {
                  setSelectedAccountIds([]);
                } else {
                  setSelectedAccountIds(filteredAccounts.map((a) => a.id));
                }
              }}
              onViewAccount={onViewAccount}
              onRebuildAccount={handleRebuildAccountWithAutoSwitch}
              onDeleteAccount={onDeleteAccount}
              isBuilding={isBuilding}
              onConnectOAuth={handleConnectOAuth}
              onAddManual={onOpenBulkModal}
              isOAuthConfigured={isOAuthConfigured}
            />
          </div>
        )}

        {/* TAB 6: FORENSIC DETAILS DEBUG & LIVE LOGS STREAM */}
        {activeTab === 'logs' && (
          <div className="max-w-5xl mx-auto space-y-2 font-mono">
            {/* Top Forensic Debug Vitals HUD */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 space-y-2">
              <div className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2 truncate">
                  <div className="w-5 h-5 rounded bg-orange-600/20 text-orange-400 flex items-center justify-center shrink-0">
                    <Terminal className="w-3 h-3" />
                  </div>
                  <div className="flex items-center gap-1.5 truncate">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0 ${
                        isBuilding
                          ? 'bg-blue-950 text-blue-300 border border-blue-700 animate-pulse'
                          : project.status === 'completed'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : project.status === 'failed'
                          ? 'bg-red-950 text-red-300 border border-red-800'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {isBuilding ? 'BUILDING' : project.status === 'completed' ? 'LIVE & DEPLOYED' : project.status === 'failed' ? 'FAILED' : 'READY'}
                    </span>
                    <span className="text-[11px] text-slate-300 truncate font-mono">
                      {currentStepMessage}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[11px] font-mono font-bold text-orange-400 tabular-nums">
                    {avgProgress}%
                  </span>
                  {isBuilding ? (
                    <button
                      onClick={onCancelBuild}
                      className="px-2 py-0.5 text-[10px] font-semibold text-red-300 bg-red-950/80 hover:bg-red-900 border border-red-800 rounded transition flex items-center gap-1 cursor-pointer"
                    >
                      <Ban className="w-2.5 h-2.5" />
                      <span>Cancel</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleTriggerBuildWithAutoSwitch()}
                      disabled={accounts.length === 0}
                      className="px-2.5 py-0.5 text-[10px] font-semibold text-white bg-orange-600 hover:bg-orange-500 disabled:opacity-50 rounded transition flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Re-deploy</span>
                    </button>
                  )}
                </div>
              </div>

              {/* High-Density Progress Track */}
              <div className="w-full bg-slate-950 rounded-full h-1 overflow-hidden border border-slate-800/80">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    project.status === 'failed'
                      ? 'bg-red-500'
                      : project.status === 'completed'
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-amber-500 via-orange-500 to-emerald-400'
                  }`}
                  style={{ width: `${Math.max(avgProgress, isBuilding ? 8 : 0)}%` }}
                />
              </div>

              {/* 4-Stage Pipeline Tracker & Micro Vitals */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-0.5 text-[10px] text-slate-400">
                <div className="flex items-center gap-1.5">
                  {[
                    { label: 'Git Sync', threshold: 15 },
                    { label: 'Deps & Env', threshold: 35 },
                    { label: 'Compile', threshold: 50 },
                    { label: 'Edge Deploy', threshold: 100 },
                  ].map((stage, sIdx) => {
                    const isDone = avgProgress >= stage.threshold || (!isBuilding && project.status === 'completed');
                    const isActive = isBuilding && avgProgress < stage.threshold && (sIdx === 0 || avgProgress >= [15, 35, 50, 100][sIdx - 1]);
                    return (
                      <span
                        key={stage.label}
                        className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded border text-[9px] ${
                          isDone
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                            : isActive
                            ? 'bg-blue-950/80 text-blue-300 border-blue-700 animate-pulse font-bold'
                            : 'bg-slate-950 text-slate-500 border-slate-800'
                        }`}
                      >
                        {isDone ? (
                          <Check className="w-2.5 h-2.5 text-emerald-400" />
                        ) : isActive ? (
                          <RotateCw className="w-2.5 h-2.5 animate-spin text-blue-400" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                        )}
                        <span>{stage.label}</span>
                      </span>
                    );
                  })}
                </div>

                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="text-slate-500 font-mono">
                    Commit: <span className="text-slate-300 font-bold">#{project.latest_commit_sha ? project.latest_commit_sha.slice(0, 7) : 'HEAD'}</span>
                  </span>
                  <span>•</span>
                  <span className="text-slate-500 font-mono">
                    Workers: <span className="text-emerald-400 font-bold">3 Parallel</span>
                  </span>
                  <span>•</span>
                  <span className="text-slate-500 font-mono">
                    Accounts: <span className="text-sky-400 font-bold">{accounts.length}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Toolbar: Scope Filter & Controls */}
            <div className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 flex items-center justify-between text-xs gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold shrink-0">Filter:</span>
                <select
                  value={logFilterAccountId}
                  onChange={(e) => setLogFilterAccountId(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded px-2 py-0.5 text-[10px] text-slate-200 font-mono focus:outline-none focus:border-orange-500 max-w-xs truncate"
                >
                  <option value="all">All Accounts (Fleet Stream Combined)</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.alias} ({a.subdomain}.{project.root_domain || 'pages.dev'})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setIsAutoScrollEnabled((prev) => !prev)}
                  className={`px-2 py-0.5 text-[10px] rounded border transition flex items-center gap-1 cursor-pointer ${
                    isAutoScrollEnabled
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                  title="Toggle continuous auto-scroll to latest log output"
                >
                  <ArrowDown className={`w-2.5 h-2.5 ${isAutoScrollEnabled ? 'text-emerald-400' : ''}`} />
                  <span>Auto-scroll</span>
                </button>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsLogsCleared(true)}
                  className="px-2 py-0.5 text-[10px] text-slate-400 hover:text-slate-200 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded transition cursor-pointer"
                >
                  Clear View
                </button>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(displayedLogs || 'No build logs recorded yet.');
                    onNotify('Logs copied to clipboard.');
                  }}
                  className="px-2.5 py-0.5 text-[10px] text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Logs</span>
                </button>
              </div>
            </div>

            {/* High-Performance Terminal View */}
            <div className="bg-[#06080D] border border-slate-800 rounded-lg overflow-hidden flex flex-col shadow-2xl">
              {/* Terminal Titlebar Chrome */}
              <div className="bg-[#0C0F17] px-3 py-1.5 border-b border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 select-none">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500/80 inline-block" />
                    <span className="w-2 h-2 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block" />
                  </div>
                  <span className="text-slate-300 font-mono font-semibold">
                    gitforge-engine:~/deploy-pipeline
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isBuilding && (
                    <span className="inline-flex items-center gap-1 text-[9px] text-blue-400 animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      Streaming
                    </span>
                  )}
                  <span className="text-slate-500">
                    {displayedLogs ? `${displayedLogs.split('\n').filter(Boolean).length} lines` : '0 lines'}
                  </span>
                </div>
              </div>

              {/* Terminal Content Stream */}
              <div className="min-h-96 max-h-[32rem] overflow-y-auto p-2.5 space-y-0.5 select-text font-mono text-[11px] leading-relaxed">
                {displayedLogs ? (
                  displayedLogs.split('\n').map((line, idx) => {
                    const isError = /error|fatal|failed|exception|err:/i.test(line);
                    const isSuccess = /deployed|success|verified|active|ready/i.test(line);
                    const isHeader = line.startsWith('[Account:') || line.startsWith('------');
                    const isCommand = line.startsWith('[npm') || line.startsWith('[wrangler') || line.startsWith('[git');
                    const isNotice = /notice|warning|queued|assigned/i.test(line);

                    let lineStyle = 'text-slate-300';
                    let lineBg = '';
                    if (isError) {
                      lineStyle = 'text-red-400 font-semibold';
                      lineBg = 'bg-red-950/25 px-1 rounded';
                    } else if (isSuccess) {
                      lineStyle = 'text-emerald-400 font-semibold';
                    } else if (isHeader) {
                      lineStyle = 'text-orange-300 font-bold';
                      lineBg = 'bg-slate-900/80 border-y border-slate-800/80 py-0.5 my-1 text-xs';
                    } else if (isCommand) {
                      lineStyle = 'text-amber-300 font-semibold';
                    } else if (isNotice) {
                      lineStyle = 'text-sky-300';
                    }

                    // Check for URLs in line to make them highlighted
                    const hasUrl = line.match(/(https?:\/\/[^\s]+)/g);

                    return (
                      <div
                        key={idx}
                        className={`flex items-start gap-2 px-1 hover:bg-slate-900/50 rounded transition-colors ${lineBg}`}
                      >
                        <span className="text-slate-600 select-none text-[10px] tabular-nums shrink-0 pt-0.5 w-6 text-right">
                          {String(idx + 1).padStart(3, '0')}
                        </span>
                        <div className={`flex-1 break-all ${lineStyle}`}>
                          {hasUrl ? (
                            <span>
                              {line.split(/(https?:\/\/[^\s]+)/g).map((part, pIdx) => {
                                if (part.startsWith('http://') || part.startsWith('https://')) {
                                  return (
                                    <a
                                      key={pIdx}
                                      href={part}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-cyan-400 underline hover:text-cyan-300 inline-flex items-center gap-0.5"
                                    >
                                      <span>{part}</span>
                                      <ExternalLink className="w-2.5 h-2.5 inline" />
                                    </a>
                                  );
                                }
                                return part;
                              })}
                            </span>
                          ) : (
                            line
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-2">
                    <Terminal className="w-6 h-6 text-slate-600" />
                    <span className="text-xs">No build output available yet.</span>
                    <button
                      onClick={() => handleTriggerBuildWithAutoSwitch()}
                      disabled={accounts.length === 0}
                      className="px-3 py-1 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded transition cursor-pointer"
                    >
                      Trigger Deploy Now
                    </button>
                  </div>
                )}

                {/* Animated active terminal cursor when build is running */}
                {isBuilding && (
                  <div className="flex items-center gap-2 pt-1 text-slate-400 text-[11px] animate-pulse">
                    <span className="text-orange-500 font-bold">&gt;</span>
                    <span className="text-slate-300">Processing child worker pipelines...</span>
                    <span className="inline-block w-2 h-3.5 bg-orange-500/80 animate-ping ml-1" />
                  </div>
                )}

                <div ref={logEndRef} />
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: HISTORY */}
        {activeTab === 'history' && (
          <div className="max-w-5xl mx-auto space-y-2">
            <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HistoryIcon className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-xs font-bold text-slate-100">Build History</span>
              </div>
              <button
                onClick={onRefreshProject}
                className="px-2 py-0.5 text-[10px] text-slate-300 hover:text-white bg-slate-800 rounded transition flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            <div className="space-y-1">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="bg-slate-900 border border-slate-800 rounded p-2 flex items-center justify-between text-[11px] font-mono"
                >
                  <div className="space-y-0.5 truncate">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="font-bold text-slate-200">{acc.alias}</span>
                      <span className="text-slate-500">→</span>
                      <span className="text-emerald-400 truncate">{acc.custom_domain || `${acc.subdomain}.${project.root_domain || 'pages.dev'}`}</span>
                    </div>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 truncate">
                      <span>#{acc.commit_hash || project.latest_commit_sha || 'HEAD'}</span>
                      <span>•</span>
                      <span className="truncate">{acc.commit_message || project.latest_commit_message || 'Sync'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        acc.build_status === 'success'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : acc.build_status === 'building'
                          ? 'bg-blue-950 text-blue-300 border border-blue-700 animate-pulse'
                          : 'bg-red-950 text-red-300 border border-red-800'
                      }`}
                    >
                      {acc.build_status || 'idle'}
                    </span>

                    <button
                      onClick={() => handleRebuildAccountWithAutoSwitch(acc.deployment_id || acc.id)}
                      disabled={isBuilding}
                      className="px-2 py-0.5 text-[10px] font-semibold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 rounded transition cursor-pointer"
                    >
                      Rebuild
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Bulk Environment Modal */}
      {isBulkEnvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs font-['Plus_Jakarta_Sans',sans-serif]">
          <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 max-w-md w-full space-y-2.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <h3 className="text-xs font-bold text-slate-100">Import .env Configuration</h3>
              <span className="text-[10px] font-mono text-slate-400">KEY=value format</span>
            </div>

            <textarea
              rows={8}
              value={bulkEnvText}
              onChange={(e) => setBulkEnvText(e.target.value)}
              placeholder="VITE_API_URL=https://api.example.com&#10;VITE_APP_TITLE=Production App&#10;DATABASE_URL=postgresql://user:pass@localhost:5432/db"
              className="w-full bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
            />

            <div className="flex justify-end gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setIsBulkEnvModalOpen(false)}
                className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-white bg-slate-800 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkEnvParse}
                className="px-3 py-1 text-[11px] font-semibold text-white bg-orange-600 hover:bg-orange-500 rounded cursor-pointer"
              >
                Import Variables
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
