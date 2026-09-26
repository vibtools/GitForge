import React, { useState, useEffect } from 'react';
import {
  Globe,
  Save,
  RefreshCw,
  ImageIcon,
  Sparkles,
  ShieldCheck,
  Palette,
  RotateCcw,
  Check,
  Upload,
} from 'lucide-react';
import { vconApi } from '../api';
import { SiteSettings } from '../types';
import { useSiteSettings, DEFAULT_SITE_SETTINGS } from '../../context/SiteSettingsContext';

interface VconSiteSettingsControlProps {
  onNotify: (msg: string, isError?: boolean) => void;
}

const COLOR_PRESETS = [
  { name: 'Orange', hex: '#ea580c' },
  { name: 'Blue', hex: '#2563eb' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Cyan', hex: '#0891b2' },
];

export const VconSiteSettingsControl: React.FC<VconSiteSettingsControlProps> = ({ onNotify }) => {
  const { siteSettings: globalSettings, updateSiteSettingsState } = useSiteSettings();
  const [formData, setFormData] = useState<SiteSettings>(globalSettings);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const logoInputRef = React.useRef<HTMLInputElement | null>(null);
  const faviconInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setFormData(globalSettings);
  }, [globalSettings]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await vconApi.getSiteSettings();
      setFormData(data);
      updateSiteSettingsState(data);
      setHasChanges(false);
    } catch (err: any) {
      onNotify(err.message || 'Failed to load site settings', true);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key: keyof SiteSettings, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      setHasChanges(true);
      return next;
    });
  };

  const handleFileUpload = async (type: 'logo' | 'favicon', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      if (type === 'logo') setUploadingLogo(true);
      else setUploadingFavicon(true);

      const res = await vconApi.uploadStorageFile(file);
      if (res.success && res.file_url) {
        if (type === 'logo') {
          handleChange('site_logo_url', res.file_url);
          onNotify(`Logo uploaded to S3: ${res.key}`);
        } else {
          handleChange('site_favicon_url', res.file_url);
          onNotify(`Favicon uploaded to S3: ${res.key}`);
        }
      }
    } catch (err: any) {
      onNotify(err.message || 'Upload to S3 failed', true);
    } finally {
      if (type === 'logo') setUploadingLogo(false);
      else setUploadingFavicon(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const res = await vconApi.updateSiteSettings(formData);
      if (res.success && res.site_settings) {
        setFormData(res.site_settings);
        updateSiteSettingsState(res.site_settings);
        setHasChanges(false);
        onNotify('Site settings saved.');
      }
    } catch (err: any) {
      onNotify(err.message || 'Save failed', true);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset site settings to defaults?')) {
      setFormData(DEFAULT_SITE_SETTINGS);
      setHasChanges(true);
    }
  };

  return (
    <div className="space-y-2.5 max-w-3xl">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800/80 px-3 py-1.5 rounded-lg text-xs">
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-orange-400/90" />
          <span className="font-semibold text-slate-200">Site Settings</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={loadSettings}
            disabled={loading}
            className="p-1 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded border border-slate-700/80 transition"
            title="Reload"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-2 py-0.5 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded transition flex items-center gap-1"
          >
            <RotateCcw className="w-2.5 h-2.5" />
            <span>Defaults</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className="px-2.5 py-0.5 text-[11px] font-medium bg-orange-600/90 hover:bg-orange-600 text-white rounded transition flex items-center gap-1 shadow-xs"
          >
            <Save className="w-2.5 h-2.5" />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-2.5">
        {/* Section: Brand & Identity */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 border-b border-slate-800/70 pb-1.5">
            <Sparkles className="w-3 h-3 text-orange-400/90" />
            <span>Brand Identity</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Site Name</label>
              <input
                type="text"
                value={formData.site_name}
                onChange={(e) => handleChange('site_name', e.target.value)}
                placeholder="GitForge"
                required
                className="w-full bg-slate-950/80 border border-slate-800/80 rounded px-2 py-1 text-slate-200 text-[11px] font-mono focus:outline-none focus:border-orange-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Tagline</label>
              <input
                type="text"
                value={formData.site_tagline}
                onChange={(e) => handleChange('site_tagline', e.target.value)}
                placeholder="Multi-Account Cloudflare Pages Fleet Orchestrator"
                className="w-full bg-slate-950/80 border border-slate-800/80 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Color Palette */}
          <div className="space-y-1 pt-0.5">
            <label className="text-[11px] font-medium text-slate-300 flex items-center gap-1">
              <Palette className="w-3 h-3 text-orange-400/90" />
              <span>Accent Color</span>
            </label>
            <div className="flex flex-wrap items-center gap-1.5">
              {COLOR_PRESETS.map((p) => {
                const isSelected = formData.site_primary_color.toLowerCase() === p.hex.toLowerCase();
                return (
                  <button
                    key={p.hex}
                    type="button"
                    onClick={() => handleChange('site_primary_color', p.hex)}
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono border transition ${
                      isSelected
                        ? 'border-slate-400 text-slate-100 bg-slate-800'
                        : 'border-slate-800 text-slate-400 bg-slate-950/60 hover:bg-slate-800'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: p.hex }}
                    />
                    <span>{p.name}</span>
                    {isSelected && <Check className="w-2 h-2 text-slate-200" />}
                  </button>
                );
              })}
              <div className="flex items-center gap-1 ml-1">
                <input
                  type="color"
                  value={formData.site_primary_color}
                  onChange={(e) => handleChange('site_primary_color', e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer bg-slate-950 border border-slate-800 p-0"
                />
                <input
                  type="text"
                  value={formData.site_primary_color}
                  onChange={(e) => handleChange('site_primary_color', e.target.value)}
                  className="w-18 bg-slate-950/80 border border-slate-800/80 rounded px-1.5 py-0.5 text-slate-300 text-[10px] font-mono focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section: Assets */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 border-b border-slate-800/70 pb-1.5">
            <ImageIcon className="w-3 h-3 text-orange-400/90" />
            <span>Visual Assets</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-slate-300">Logo URL</label>
                <input
                  type="file"
                  ref={logoInputRef}
                  accept=".png,.jpg,.jpeg,.svg,.webp"
                  onChange={(e) => handleFileUpload('logo', e)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className="text-[10px] text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Upload className={`w-2.5 h-2.5 ${uploadingLogo ? 'animate-spin' : ''}`} />
                  <span>{uploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="url"
                  value={formData.site_logo_url}
                  onChange={(e) => handleChange('site_logo_url', e.target.value)}
                  placeholder="https://example.com/logo.png or /file/..."
                  className="flex-1 bg-slate-950/80 border border-slate-800/80 rounded px-2 py-1 text-slate-200 text-[11px] font-mono focus:outline-none focus:border-orange-500"
                />
                {formData.site_logo_url && (
                  <button
                    type="button"
                    onClick={() => handleChange('site_logo_url', '')}
                    className="px-1.5 py-1 text-[10px] font-mono text-slate-400 hover:text-rose-300 bg-slate-800/80 rounded border border-slate-700/80"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-slate-300">Favicon URL</label>
                <input
                  type="file"
                  ref={faviconInputRef}
                  accept=".ico,.png,.svg,.webp"
                  onChange={(e) => handleFileUpload('favicon', e)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => faviconInputRef.current?.click()}
                  disabled={uploadingFavicon}
                  className="text-[10px] text-orange-400 hover:text-orange-300 flex items-center gap-1 cursor-pointer font-medium"
                >
                  <Upload className={`w-2.5 h-2.5 ${uploadingFavicon ? 'animate-spin' : ''}`} />
                  <span>{uploadingFavicon ? 'Uploading...' : 'Upload Favicon'}</span>
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="url"
                  value={formData.site_favicon_url}
                  onChange={(e) => handleChange('site_favicon_url', e.target.value)}
                  placeholder="https://example.com/favicon.ico or /file/..."
                  className="flex-1 bg-slate-950/80 border border-slate-800/80 rounded px-2 py-1 text-slate-200 text-[11px] font-mono focus:outline-none focus:border-orange-500"
                />
                {formData.site_favicon_url && (
                  <button
                    type="button"
                    onClick={() => handleChange('site_favicon_url', '')}
                    className="px-1.5 py-1 text-[10px] font-mono text-slate-400 hover:text-rose-300 bg-slate-800/80 rounded border border-slate-700/80"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section: Access & Maintenance */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 border-b border-slate-800/70 pb-1.5">
            <ShieldCheck className="w-3 h-3 text-orange-400/90" />
            <span>Access & Maintenance</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="bg-slate-950/60 border border-slate-800/70 rounded p-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-300">Public User Registration</span>
              <button
                type="button"
                onClick={() =>
                  handleChange('allow_public_registration', !formData.allow_public_registration)
                }
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${
                  formData.allow_public_registration
                    ? 'bg-emerald-950/50 text-emerald-400/90 border-emerald-800/60'
                    : 'bg-rose-950/40 text-rose-300 border-rose-800/60'
                }`}
              >
                {formData.allow_public_registration ? 'ENABLED' : 'DISABLED'}
              </button>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/70 rounded p-2 flex items-center justify-between">
              <span className="text-[11px] font-medium text-slate-300">Maintenance Mode</span>
              <button
                type="button"
                onClick={() => handleChange('maintenance_mode', !formData.maintenance_mode)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium border transition ${
                  formData.maintenance_mode
                    ? 'bg-amber-950/60 text-amber-300 border-amber-800/60'
                    : 'bg-slate-800/80 text-slate-400 border-slate-700/80'
                }`}
              >
                {formData.maintenance_mode ? 'ACTIVE' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-medium text-slate-300">Announcement Banner</label>
            <input
              type="text"
              value={formData.maintenance_banner}
              onChange={(e) => handleChange('maintenance_banner', e.target.value)}
              placeholder="System announcement text (optional)"
              className="w-full bg-slate-950/80 border border-slate-800/80 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        {/* Section: SEO & Support */}
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 border-b border-slate-800/70 pb-1.5">
            <Globe className="w-3 h-3 text-orange-400/90" />
            <span>SEO & Support</span>
          </div>

          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-slate-300">Meta Description</label>
              <textarea
                rows={2}
                value={formData.site_description}
                onChange={(e) => handleChange('site_description', e.target.value)}
                placeholder="Meta description for search engines and preview cards"
                className="w-full bg-slate-950/80 border border-slate-800/80 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-orange-500 resize-none font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Footer Text</label>
                <input
                  type="text"
                  value={formData.site_footer_text}
                  onChange={(e) => handleChange('site_footer_text', e.target.value)}
                  placeholder="GitForge — Fleet Orchestrator"
                  className="w-full bg-slate-950/80 border border-slate-800/80 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Support Email</label>
                <input
                  type="email"
                  value={formData.site_support_email}
                  onChange={(e) => handleChange('site_support_email', e.target.value)}
                  placeholder="support@gitforge.dev"
                  className="w-full bg-slate-950/80 border border-slate-800/80 rounded px-2 py-1 text-slate-200 text-[11px] font-mono focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-slate-300">Documentation URL</label>
                <input
                  type="url"
                  value={formData.site_support_url}
                  onChange={(e) => handleChange('site_support_url', e.target.value)}
                  placeholder="https://docs.gitforge.dev"
                  className="w-full bg-slate-950/80 border border-slate-800/80 rounded px-2 py-1 text-slate-200 text-[11px] font-mono focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-2 pt-0.5">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-2.5 py-1 text-[11px] text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded transition"
          >
            Reset
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1 bg-orange-600/90 hover:bg-orange-600 text-white text-[11px] font-medium rounded transition flex items-center gap-1 shadow-xs"
          >
            <Save className="w-3 h-3" />
            <span>{saving ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
