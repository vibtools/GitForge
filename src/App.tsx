/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderGit2,
  Upload,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  Layers,
  Trash2,
} from 'lucide-react';
import { Project, Account, DeploymentViewData, User } from './types';
import { TopNav } from './components/TopNav';
import { ProjectHeader } from './components/ProjectHeader';
import { AccountTable } from './components/AccountTable';
import { ViewModal } from './components/ViewModal';
import { BulkAccountModal } from './components/BulkAccountModal';
import { AddProjectModal } from './components/AddProjectModal';
import { LandingPage } from './components/LandingPage';
import { UserAuthModal } from './components/UserAuthModal';
import { VconAdminApp } from './vcon';
import { UserSidebar, UserNavTab } from './components/UserSidebar';
import { UserHeader } from './components/UserHeader';
import { UserDashboardView } from './components/UserDashboardView';
import { UserProfileSettingsView } from './components/UserProfileSettingsView';
import { UserProjectsCatalogView } from './components/UserProjectsCatalogView';
import { ProjectWorkplaceView } from './components/ProjectWorkplaceView';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [hasUsers, setHasUsers] = useState<boolean>(true);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // vCon Admin Routing State (/vcon URL support)
  const [isAdminRoute, setIsAdminRoute] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.location.pathname.startsWith('/vcon') ||
      window.location.hash === '#vcon'
    );
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeTab, setActiveTab] = useState<UserNavTab>('dashboard');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [neonConnected, setNeonConnected] = useState<boolean>(true);

  // Modals state
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [viewData, setViewData] = useState<DeploymentViewData | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [isAddProjectOpen, setIsAddProjectOpen] = useState<boolean>(false);

  // Table filters & selection
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'building' | 'pending'>('all');
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const projectCacheRef = useRef<Record<string, { project: Project; accounts: Account[]; is_building: boolean }>>({});

  const getAuthHeaders = () => {
    const token = localStorage.getItem('cf_bulk_token') || '';
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Check authentication status
  const checkAuth = async () => {
    try {
      setIsAuthLoading(true);
      const token = localStorage.getItem('cf_bulk_token') || '';
      const res = await fetch('/api/auth/me', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setHasUsers(data.has_users);
        if (data.user) {
          loadProjects();
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  };

  // Check Neon DB health
  const checkHealth = async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        setNeonConnected(true);
      }
    } catch {
      setNeonConnected(false);
    }
  };

  // Load projects list
  const loadProjects = async (selectProjectId?: string) => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/projects', {
        headers: getAuthHeaders(),
      });
      if (res.status === 401) {
        setUser(null);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      setProjects(data);

      if (data.length > 0) {
        const toSelect = selectProjectId
          ? data.find((p: Project) => p.id === selectProjectId) || data[0]
          : activeProject
          ? data.find((p: Project) => p.id === activeProject.id) || data[0]
          : data[0];
        setActiveProject(toSelect);
        loadProjectDetails(toSelect.id);
      } else {
        setActiveProject(null);
        setAccounts([]);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Error fetching projects:', err);
      setIsLoading(false);
    }
  };

  // Load project accounts and deployments with instant SWR cache
  const loadProjectDetails = async (projectId: string) => {
    try {
      const cached = projectCacheRef.current[projectId];
      if (cached) {
        // Immediate instant UI update
        setActiveProject(cached.project);
        setAccounts(cached.accounts);
        setIsBuilding(cached.is_building);
      } else {
        setIsLoading(true);
      }

      const res = await fetch(`/api/projects/${projectId}`, {
        headers: getAuthHeaders(),
      });
      if (res.status === 401) {
        setUser(null);
        return;
      }
      if (!res.ok) throw new Error('Failed to fetch project details');
      const data = await res.json();

      // Update cache and state seamlessly
      projectCacheRef.current[projectId] = {
        project: data.project,
        accounts: data.accounts || [],
        is_building: data.is_building,
      };
      setActiveProject(data.project);
      setAccounts(data.accounts || []);
      setIsBuilding(data.is_building);
    } catch (err) {
      console.error('Error loading project details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Poll project status if building
  const pollStatus = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/status`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return;
      const data = await res.json();

      setIsBuilding(data.is_building);

      setAccounts((prev) =>
        prev.map((acc) => {
          const dep = data.deployments.find((d: any) => d.account_id === acc.id);
          if (dep) {
            return {
              ...acc,
              deployment_id: dep.deployment_id,
              build_status: dep.build_status,
              progress_percent: dep.progress_percent,
              current_step: dep.current_step,
              error_message: dep.error_message !== undefined ? dep.error_message : acc.error_message,
              pages_dev_domain: dep.pages_dev_domain || acc.pages_dev_domain,
              custom_domain: dep.custom_domain || acc.custom_domain,
              logs: dep.logs !== undefined ? dep.logs : acc.logs,
            };
          }
          return acc;
        })
      );

      if (!data.is_building && isBuilding) {
        loadProjectDetails(projectId);
        showToast('Build finished.');
      }
    } catch (err) {
      console.warn('Polling error:', err);
    }
  }, [isBuilding]);

  useEffect(() => {
    checkHealth();
    checkAuth();

    const handleLocationChange = () => {
      const isVcon =
        window.location.pathname.startsWith('/vcon') ||
        window.location.hash === '#vcon';
      setIsAdminRoute(isVcon);
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  const handleOpenVconAdmin = () => {
    setIsAdminRoute(true);
    window.history.pushState(null, '', '/vcon');
  };

  const handleExitVconAdmin = () => {
    setIsAdminRoute(false);
    window.history.pushState(null, '', '/');
    loadProjects();
  };

  useEffect(() => {
    if (isBuilding && activeProject && user) {
      pollingRef.current = setInterval(() => {
        pollStatus(activeProject.id);
      }, 1200);
    } else {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [isBuilding, activeProject, pollStatus, user]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
    } catch {
      // ignore
    } finally {
      localStorage.removeItem('cf_bulk_token');
      setUser(null);
    }
  };

  // Cancel Active Build
  const handleCancelBuild = async () => {
    if (!activeProject) return;
    try {
      showToast('Canceling build...');
      const res = await fetch(`/api/projects/${activeProject.id}/cancel`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setIsBuilding(false);
        loadProjectDetails(activeProject.id);
        showToast('Build canceled.');
      }
    } catch {
      showToast('Failed to cancel build');
    }
  };

  // Fleet or subset account build trigger
  const handleTriggerBuild = async (accountIds?: string[]) => {
    if (!activeProject) return;
    try {
      setIsBuilding(true);
      const isSubset = Array.isArray(accountIds) && accountIds.length > 0;
      showToast(isSubset ? `Building ${accountIds.length} account(s)...` : 'Fleet build started.');
      const res = await fetch(`/api/projects/${activeProject.id}/build`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: isSubset ? JSON.stringify({ accountIds }) : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to start build');
      }
    } catch (err: any) {
      showToast(err.message || 'Build trigger failed');
      setIsBuilding(false);
    }
  };

  // Rebuild Selected
  const handleRebuildSelected = async () => {
    if (!activeProject || selectedAccountIds.length === 0) return;
    handleTriggerBuild(selectedAccountIds);
  };

  // View Account
  const handleViewAccount = async (account: Account) => {
    if (!account.deployment_id) {
      showToast('No deployment record yet. Trigger a build first.');
      return;
    }
    try {
      const res = await fetch(`/api/deployments/${account.deployment_id}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to fetch deployment details');
      const data = await res.json();
      setViewData(data);
      setIsViewModalOpen(true);
    } catch (err: any) {
      showToast(err.message || 'Error opening deployment view');
    }
  };

  // Single Account Rebuild (handles deployment ID or account ID)
  const handleRebuildSingle = async (deploymentOrAccountId: string) => {
    try {
      setIsBuilding(true);
      showToast('Rebuilding account...');
      const res = await fetch(`/api/deployments/${deploymentOrAccountId}/rebuild`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        // Fallback to direct account build
        const fbRes = await fetch(`/api/accounts/${deploymentOrAccountId}/build`, {
          method: 'POST',
          headers: getAuthHeaders(),
        });
        if (!fbRes.ok) {
          const errData = await fbRes.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to start rebuild');
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Error triggering rebuild');
      setIsBuilding(false);
    }
  };

  // Delete Account
  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Remove this Cloudflare account?')) {
      return;
    }
    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete account');
      showToast('Account removed.');
      if (activeProject) loadProjectDetails(activeProject.id);
    } catch (err: any) {
      showToast(err.message || 'Error deleting account');
    }
  };

  // Bulk Delete Selected Accounts
  const handleBulkDeleteAccounts = async () => {
    if (!activeProject || selectedAccountIds.length === 0) return;
    if (
      !confirm(
        `Are you sure you want to remove ${selectedAccountIds.length} selected Cloudflare account(s)?`
      )
    ) {
      return;
    }
    try {
      const res = await fetch(`/api/projects/${activeProject.id}/accounts/bulk-delete`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ account_ids: selectedAccountIds }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to remove accounts');
      }
      setSelectedAccountIds([]);
      showToast(`Removed ${selectedAccountIds.length} accounts.`);
      loadProjectDetails(activeProject.id);
    } catch (err: any) {
      showToast(err.message || 'Error removing accounts');
    }
  };

  // Delete Project
  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error('Failed to delete project');
      showToast('Project deleted.');
      loadProjects();
    } catch (err: any) {
      showToast(err.message || 'Error deleting project');
    }
  };

  // Filter accounts
  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch =
      acc.alias.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.subdomain.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.account_id.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'success') return acc.build_status === 'success';
    if (statusFilter === 'building')
      return acc.build_status === 'building' || acc.build_status === 'queued';
    if (statusFilter === 'pending')
      return acc.build_status === 'idle' || !acc.build_status;

    return true;
  });

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin text-orange-500" />
      </div>
    );
  }

  // If user requested or navigated to /vcon, render the separate Admin Panel
  if (isAdminRoute) {
    return (
      <VconAdminApp
        onExitToApp={handleExitVconAdmin}
        userEmail={user?.email}
        onLogout={handleLogout}
      />
    );
  }

  // If user is not authenticated, show the compact professional landing page
  if (!user) {
    return (
      <>
        <LandingPage
          onOpenAuth={(mode) => {
            setAuthMode(mode);
            setIsAuthModalOpen(true);
          }}
        />
        <UserAuthModal
          isOpen={isAuthModalOpen}
          initialMode={authMode}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={(authedUser) => {
            setUser(authedUser);
            loadProjects();
          }}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 bg-slate-900 border border-slate-700 text-slate-100 text-xs px-3 py-1.5 rounded shadow-xl flex items-center gap-1.5 animate-in fade-in">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Compact User Header */}
      <UserHeader
        projects={projects}
        activeProject={activeProject}
        onSelectProject={(p) => {
          setActiveProject(p);
          loadProjectDetails(p.id);
        }}
        onOpenNewProject={() => setIsAddProjectOpen(true)}
        user={user}
        onLogout={handleLogout}
        onSelectTab={setActiveTab}
        isBuilding={isBuilding}
      />

      {/* Main Workspace Layout with Compact Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        <UserSidebar
          currentTab={activeTab}
          onSelectTab={setActiveTab}
          projects={projects}
          activeProject={activeProject}
          onSelectProject={(p) => {
            setActiveProject(p);
            loadProjectDetails(p.id);
          }}
          onOpenNewProject={() => setIsAddProjectOpen(true)}
          user={user}
          onLogout={handleLogout}
          isBuilding={isBuilding}
        />

        <main className={`flex-1 bg-slate-950 overflow-hidden flex flex-col ${activeTab === 'builder' ? 'p-0' : 'p-3 overflow-y-auto'}`}>
          {activeTab === 'dashboard' && (
            <UserDashboardView
              projects={projects}
              activeProject={activeProject}
              onSelectProject={(p) => {
                setActiveProject(p);
                loadProjectDetails(p.id);
              }}
              onOpenNewProject={() => setIsAddProjectOpen(true)}
              onGoToBuilder={() => setActiveTab('builder')}
              user={user}
            />
          )}

          {activeTab === 'projects' && (
            <UserProjectsCatalogView
              projects={projects}
              activeProject={activeProject}
              onSelectProject={(p) => {
                setActiveProject(p);
                loadProjectDetails(p.id);
              }}
              onOpenNewProject={() => setIsAddProjectOpen(true)}
              onOpenProjectWorkplace={(p) => {
                setActiveProject(p);
                loadProjectDetails(p.id);
                setActiveTab('builder');
              }}
              onProjectUpdated={(updated) => {
                setActiveProject(updated);
                setProjects((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
              }}
              onDeleteProject={handleDeleteProject}
            />
          )}

          {activeTab === 'settings' && (
            <UserProfileSettingsView
              user={user}
              onUpdateUser={(updated) => {
                if (user) {
                  setUser({ ...user, ...updated });
                }
              }}
              onNotify={(msg) => showToast(msg)}
            />
          )}

          {activeTab === 'builder' && (
            <>
              {isLoading && !activeProject ? (
                <div className="flex flex-col items-center justify-center flex-1 py-20 text-slate-500 space-y-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-orange-500" />
                </div>
              ) : !activeProject ? (
                <div className="flex-1 flex items-center justify-center p-4">
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-6 text-center max-w-sm w-full space-y-3">
                    <div className="w-10 h-10 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-orange-400">
                      <FolderGit2 className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-semibold text-slate-100">
                      No Project Selected
                    </div>
                    <button
                      onClick={() => setIsAddProjectOpen(true)}
                      className="px-3 py-1.5 text-xs font-medium text-white bg-orange-600 hover:bg-orange-500 rounded transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Project</span>
                    </button>
                  </div>
                </div>
              ) : (
                <ProjectWorkplaceView
                  project={activeProject}
                  accounts={accounts}
                  isBuilding={isBuilding}
                  onUpdateProject={(updated) => {
                    setActiveProject(updated);
                    setProjects((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
                  }}
                  onRefreshProject={() => {
                    if (activeProject) loadProjectDetails(activeProject.id);
                  }}
                  onOpenBulkModal={() => setIsBulkModalOpen(true)}
                  onViewAccount={handleViewAccount}
                  onRebuildAccount={handleRebuildSingle}
                  onDeleteAccount={handleDeleteAccount}
                  onTriggerBuild={handleTriggerBuild}
                  onCancelBuild={handleCancelBuild}
                  onNotify={(msg) => showToast(msg)}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* View Modal */}
      <ViewModal
        isOpen={isViewModalOpen}
        data={viewData}
        onClose={() => setIsViewModalOpen(false)}
        onRebuild={(depId) => {
          handleRebuildSingle(depId);
          setIsViewModalOpen(false);
        }}
      />

      {/* Bulk Account Import Modal */}
      <BulkAccountModal
        project={activeProject}
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        onAccountsAdded={() => {
          showToast('Accounts added.');
          if (activeProject) loadProjectDetails(activeProject.id);
        }}
      />

      {/* Add Project Modal */}
      <AddProjectModal
        isOpen={isAddProjectOpen}
        onClose={() => setIsAddProjectOpen(false)}
        onProjectCreated={(newProj) => {
          showToast('Project created.');
          loadProjects(newProj.id);
        }}
      />
    </div>
  );
}
