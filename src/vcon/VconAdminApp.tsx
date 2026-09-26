import React, { useState, useEffect, useCallback, useRef } from 'react';
import { VconTab, AdminOverview, AdminUser } from './types';
import { vconApi } from './api';
import { VconHeader } from './components/VconHeader';
import { VconSidebar } from './components/VconSidebar';
import { VconOverview } from './components/VconOverview';
import { VconProjectsControl } from './components/VconProjectsControl';
import { VconCloudflareControl } from './components/VconCloudflareControl';
import { VconDeploymentsControl } from './components/VconDeploymentsControl';
import { VconUsersControl } from './components/VconUsersControl';
import { VconSiteSettingsControl } from './components/VconSiteSettingsControl';
import { VconStorageControl } from './components/VconStorageControl';
import { VconSettingsControl } from './components/VconSettingsControl';
import { VconDatabaseControl } from './components/VconDatabaseControl';
import { VconAuditLogs } from './components/VconAuditLogs';
import { VconSetup } from './components/VconSetup';
import { VconLogin } from './components/VconLogin';
import { RefreshCw } from 'lucide-react';

interface VconAdminAppProps {
  onExitToApp: () => void;
  userEmail?: string;
  onLogout: () => void;
}

export const VconAdminApp: React.FC<VconAdminAppProps> = ({
  onExitToApp,
  onLogout,
}) => {
  const [authStatus, setAuthStatus] = useState<{
    has_admin: boolean;
    is_admin: boolean;
    user: AdminUser | null;
  } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<VconTab>('overview');
  const [visitedTabs, setVisitedTabs] = useState<Set<VconTab>>(() => new Set<VconTab>(['overview']));
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAborting, setIsAborting] = useState(false);
  const [toast, setToast] = useState<{ message: string; isError?: boolean } | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSelectTab = useCallback((tab: VconTab) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  const showToast = (message: string, isError = false) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, isError });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3800);
  };

  const checkAdminAuth = async () => {
    try {
      setAuthLoading(true);
      const status = await vconApi.getAuthStatus();
      setAuthStatus(status);
    } catch {
      setAuthStatus({ has_admin: true, is_admin: false, user: null });
    } finally {
      setAuthLoading(false);
    }
  };

  const loadOverview = useCallback(async () => {
    if (!authStatus?.is_admin) return;
    try {
      setIsLoading(true);
      const data = await vconApi.getOverview();
      setOverview(data);
    } catch (err: any) {
      console.warn('Overview telemetry fetch failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authStatus?.is_admin]);

  useEffect(() => {
    checkAdminAuth();
  }, []);

  useEffect(() => {
    if (authStatus?.is_admin) {
      loadOverview();
      const interval = setInterval(() => {
        loadOverview();
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [authStatus?.is_admin, loadOverview]);

  const handleEmergencyAbort = async () => {
    try {
      setIsAborting(true);
      const res = await vconApi.emergencyAbort();
      showToast(res.message);
      loadOverview();
    } catch (err: any) {
      showToast(err.message || 'Emergency abort failed', true);
    } finally {
      setIsAborting(false);
    }
  };

  const handleToggleMaintenance = async (enabled: boolean) => {
    try {
      await vconApi.updateSettings({ maintenance_mode: enabled ? 'true' : 'false' });
      showToast(`Maintenance mode ${enabled ? 'ENABLED' : 'DISABLED'}.`);
      loadOverview();
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle maintenance mode', true);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400 text-xs font-mono">
        <RefreshCw className="w-4 h-4 animate-spin mr-2 text-orange-500" />
        Checking vCon credentials...
      </div>
    );
  }

  // 1. If no admin exists in database -> Initial Setup Screen
  if (authStatus && !authStatus.has_admin) {
    return (
      <VconSetup
        onSetupComplete={(adminUser) => {
          setAuthStatus({ has_admin: true, is_admin: true, user: adminUser });
          showToast('Master Administrator initialized.');
        }}
        onExit={onExitToApp}
      />
    );
  }

  // 2. If admin exists but current user is not logged in as admin -> Lock Screen
  if (authStatus && !authStatus.is_admin) {
    return (
      <VconLogin
        onLoginSuccess={(adminUser) => {
          setAuthStatus({ has_admin: true, is_admin: true, user: adminUser });
          showToast('Administrator unlocked.');
        }}
        onExit={onExitToApp}
      />
    );
  }

  // 3. Fully authenticated Administrator -> Full Command Console
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Header */}
      <VconHeader
        overview={overview}
        onExitToApp={onExitToApp}
        onEmergencyAbort={handleEmergencyAbort}
        onLogout={() => {
          setAuthStatus({ has_admin: true, is_admin: false, user: null });
          onLogout();
        }}
        userEmail={authStatus?.user?.email}
        isAborting={isAborting}
      />

      {/* Main Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <VconSidebar
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          overview={overview}
        />

        {/* Content View Area */}
        <main className="flex-1 p-2.5 overflow-y-auto bg-slate-950">
          {visitedTabs.has('overview') && (
            <div className={activeTab === 'overview' ? 'block' : 'hidden'}>
              <VconOverview
                overview={overview}
                onSelectTab={handleSelectTab}
                onEmergencyAbort={handleEmergencyAbort}
                onToggleMaintenance={handleToggleMaintenance}
                onRefresh={loadOverview}
                isLoading={isLoading}
              />
            </div>
          )}

          {visitedTabs.has('projects') && (
            <div className={activeTab === 'projects' ? 'block' : 'hidden'}>
              <VconProjectsControl onNotify={showToast} />
            </div>
          )}

          {visitedTabs.has('accounts') && (
            <div className={activeTab === 'accounts' ? 'block' : 'hidden'}>
              <VconCloudflareControl onNotify={showToast} />
            </div>
          )}

          {visitedTabs.has('deployments') && (
            <div className={activeTab === 'deployments' ? 'block' : 'hidden'}>
              <VconDeploymentsControl onNotify={showToast} />
            </div>
          )}

          {visitedTabs.has('users') && (
            <div className={activeTab === 'users' ? 'block' : 'hidden'}>
              <VconUsersControl onNotify={showToast} />
            </div>
          )}

          {visitedTabs.has('site_settings') && (
            <div className={activeTab === 'site_settings' ? 'block' : 'hidden'}>
              <VconSiteSettingsControl onNotify={showToast} />
            </div>
          )}

          {visitedTabs.has('storage') && (
            <div className={activeTab === 'storage' ? 'block' : 'hidden'}>
              <VconStorageControl onNotify={showToast} />
            </div>
          )}

          {visitedTabs.has('settings') && (
            <div className={activeTab === 'settings' ? 'block' : 'hidden'}>
              <VconSettingsControl onNotify={showToast} />
            </div>
          )}

          {visitedTabs.has('database') && (
            <div className={activeTab === 'database' ? 'block' : 'hidden'}>
              <VconDatabaseControl onNotify={showToast} />
            </div>
          )}

          {visitedTabs.has('audit') && (
            <div className={activeTab === 'audit' ? 'block' : 'hidden'}>
              <VconAuditLogs onNotify={showToast} />
            </div>
          )}
        </main>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-3 right-3 z-50 px-3 py-1.5 rounded text-[11px] font-semibold shadow-xl border transition-all ${
            toast.isError
              ? 'bg-red-950 text-red-200 border-red-800'
              : 'bg-emerald-950 text-emerald-200 border-emerald-800'
          }`}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
};
