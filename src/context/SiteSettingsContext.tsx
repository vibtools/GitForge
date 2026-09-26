import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export interface SiteSettings {
  site_name: string;
  site_tagline: string;
  site_description: string;
  site_logo_url: string;
  site_favicon_url: string;
  site_primary_color: string;
  site_footer_text: string;
  site_support_email: string;
  site_support_url: string;
  allow_public_registration: boolean;
  maintenance_mode: boolean;
  maintenance_banner: string;
}

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  site_name: 'GitForge',
  site_tagline: 'Multi-Account Cloudflare Pages Fleet Orchestrator',
  site_description: 'High-Performance Git Repository Multi-Account Cloudflare Pages Deployment Orchestrator & vCon Forensic Command Console',
  site_logo_url: '',
  site_favicon_url: '',
  site_primary_color: '#ea580c',
  site_footer_text: 'GitForge — Multi-Account Cloudflare Pages Fleet Orchestrator',
  site_support_email: 'support@gitforge.dev',
  site_support_url: '',
  allow_public_registration: true,
  maintenance_mode: false,
  maintenance_banner: '',
};

interface SiteSettingsContextValue {
  siteSettings: SiteSettings;
  isLoading: boolean;
  reloadSiteSettings: () => Promise<void>;
  updateSiteSettingsState: (updated: Partial<SiteSettings>) => void;
}

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  siteSettings: DEFAULT_SITE_SETTINGS,
  isLoading: true,
  reloadSiteSettings: async () => {},
  updateSiteSettingsState: () => {},
});

export const SiteSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [siteSettings, setSiteSettings] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sync settings to browser document head (title, favicon, meta description, og tags)
  const applyHeadMetadata = useCallback((settings: SiteSettings) => {
    if (typeof document === 'undefined') return;

    // 1. Browser Title
    const titleText = settings.site_tagline
      ? `${settings.site_name} — ${settings.site_tagline}`
      : settings.site_name;
    document.title = titleText;

    // 2. Meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', settings.site_description || settings.site_tagline);

    // 3. OpenGraph tags
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', titleText);

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', settings.site_description || settings.site_tagline);

    // 4. Dynamic Favicon
    if (settings.site_favicon_url && settings.site_favicon_url.trim()) {
      let faviconLink = document.querySelector("link[rel*='icon']") as HTMLLinkElement | null;
      if (!faviconLink) {
        faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        document.head.appendChild(faviconLink);
      }
      faviconLink.href = settings.site_favicon_url.trim();
    }
  }, []);

  const reloadSiteSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/site-settings');
      if (res.ok) {
        const data = await res.json();
        const merged: SiteSettings = {
          ...DEFAULT_SITE_SETTINGS,
          ...data,
        };
        setSiteSettings(merged);
        applyHeadMetadata(merged);
      }
    } catch (err) {
      console.warn('Failed to load site settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [applyHeadMetadata]);

  const updateSiteSettingsState = useCallback((updated: Partial<SiteSettings>) => {
    setSiteSettings((prev) => {
      const next = { ...prev, ...updated };
      applyHeadMetadata(next);
      return next;
    });
  }, [applyHeadMetadata]);

  useEffect(() => {
    reloadSiteSettings();
  }, [reloadSiteSettings]);

  return (
    <SiteSettingsContext.Provider
      value={{
        siteSettings,
        isLoading,
        reloadSiteSettings,
        updateSiteSettingsState,
      }}
    >
      {children}
    </SiteSettingsContext.Provider>
  );
};

export const useSiteSettings = () => useContext(SiteSettingsContext);
