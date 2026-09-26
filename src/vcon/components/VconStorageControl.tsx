import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Save,
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
  ExternalLink,
  Copy,
  Check,
  Upload,
  Trash2,
  Link as LinkIcon,
  ShieldCheck,
  Server,
  FileText,
} from 'lucide-react';
import { vconApi } from '../api';
import { StorageConfig, StorageReport } from '../types';

interface VconStorageControlProps {
  onNotify: (msg: string, isError?: boolean) => void;
}

export const VconStorageControl: React.FC<VconStorageControlProps> = ({ onNotify }) => {
  const [config, setConfig] = useState<StorageConfig>({
    s3_access_key_id: '',
    s3_secret_access_key: '',
    s3_bucket_name: 'gitforgedev',
    s3_endpoint: 'https://s3.us-west-004.backblazeb2.com',
    s3_region: 'us-west-004',
  });

  const [showSecret, setShowSecret] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success: boolean;
    latency_ms: number;
    message?: string;
  } | null>(null);

  const [report, setReport] = useState<StorageReport | null>(null);
  const [testFileName, setTestFileName] = useState('sample-file.txt');
  const [generatedLink, setGeneratedLink] = useState<{
    signedUrl: string;
    access_route: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const filePickerRef = React.useRef<HTMLInputElement | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [cfg, rep] = await Promise.all([
        vconApi.getStorageConfig(),
        vconApi.getStorageReport(),
      ]);

      setConfig({
        s3_access_key_id: cfg.s3_access_key_id || '',
        s3_secret_access_key: '',
        s3_bucket_name: cfg.s3_bucket_name || 'gitforgedev',
        s3_endpoint: cfg.s3_endpoint || 'https://s3.us-west-004.backblazeb2.com',
        s3_region: cfg.s3_region || 'us-west-004',
        has_secret_key: cfg.has_secret_key,
        masked_secret_key: cfg.masked_secret_key,
      });

      setReport(rep);
      if (rep.connected) {
        setConnectionStatus({
          tested: true,
          success: true,
          latency_ms: rep.latency_ms,
          message: 'Connected to Backblaze S3',
        });
      }
    } catch (err: any) {
      onNotify(err.message || 'Failed to load storage details', true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSaving(true);
      const res = await vconApi.updateStorageConfig(config);
      if (res.success) {
        onNotify('Storage configuration saved.');
        await loadData();
      }
    } catch (err: any) {
      onNotify(err.message || 'Save failed', true);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      const res = await vconApi.testStorageConnection({
        s3_access_key_id: config.s3_access_key_id,
        s3_secret_access_key: config.s3_secret_access_key,
        s3_bucket_name: config.s3_bucket_name,
        s3_endpoint: config.s3_endpoint,
        s3_region: config.s3_region,
      });

      setConnectionStatus({
        tested: true,
        success: res.success,
        latency_ms: res.latency_ms,
        message: res.message || res.error,
      });

      if (res.success) {
        onNotify(`S3 Connection OK (${res.latency_ms}ms)`);
        const rep = await vconApi.getStorageReport();
        setReport(rep);
      } else {
        onNotify(res.error || 'Connection failed', true);
      }
    } catch (err: any) {
      setConnectionStatus({
        tested: true,
        success: false,
        latency_ms: 0,
        message: err.message,
      });
      onNotify(err.message || 'Connection test failed', true);
    } finally {
      setTesting(false);
    }
  };

  const handleUploadProbe = async () => {
    try {
      setUploading(true);
      const fileName = `probe_${Date.now()}.txt`;
      const res = await vconApi.uploadTestStorageFile({
        fileName,
        content: `GitForge Backblaze S3 Storage Verification Probe\nGenerated: ${new Date().toISOString()}\nBucket: ${config.s3_bucket_name}\nEndpoint: ${config.s3_endpoint}\n`,
      });

      if (res.success) {
        onNotify(`Probe file uploaded: ${res.key}`);
        setTestFileName(res.key);
        const rep = await vconApi.getStorageReport();
        setReport(rep);
      }
    } catch (err: any) {
      onNotify(err.message || 'Probe upload failed', true);
    } finally {
      setUploading(false);
    }
  };

  const handleDirectFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const res = await vconApi.uploadStorageFile(file);
      if (res.success) {
        onNotify(`Uploaded ${file.name} to S3 (${res.key})`);
        setTestFileName(res.key);
        // Automatically generate pre-signed link
        const linkRes = await vconApi.generateStoragePresignedUrl(res.key, 3600);
        if (linkRes.success) {
          setGeneratedLink({
            signedUrl: linkRes.signedUrl,
            access_route: linkRes.access_route,
          });
        }
        const rep = await vconApi.getStorageReport();
        setReport(rep);
      }
    } catch (err: any) {
      onNotify(err.message || 'File upload failed', true);
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleGenerateLink = async () => {
    if (!testFileName.trim()) {
      onNotify('Enter a file name or object key first', true);
      return;
    }
    try {
      const res = await vconApi.generateStoragePresignedUrl(testFileName.trim(), 3600);
      if (res.success) {
        setGeneratedLink({
          signedUrl: res.signedUrl,
          access_route: res.access_route,
        });
        onNotify('Pre-signed URL generated (valid for 1 hour)');
      }
    } catch (err: any) {
      onNotify(err.message || 'Link generation failed', true);
    }
  };

  const handleDeleteObject = async (fileName: string) => {
    if (!window.confirm(`Delete ${fileName} from S3 bucket?`)) return;
    try {
      const res = await vconApi.deleteStorageObject(fileName);
      if (res.success) {
        onNotify(`Deleted ${fileName}`);
        const rep = await vconApi.getStorageReport();
        setReport(rep);
      }
    } catch (err: any) {
      onNotify(err.message || 'Delete failed', true);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    onNotify('Copied to clipboard');
  };

  return (
    <div className="space-y-2.5 max-w-4xl">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800/80 px-3 py-1.5 rounded-lg text-xs">
        <div className="flex items-center gap-2">
          <HardDrive className="w-3.5 h-3.5 text-orange-400/90" />
          <span className="font-semibold text-slate-200">S3 Storage (Backblaze B2)</span>
          {connectionStatus && connectionStatus.tested && (
            <span
              className={`px-1.5 py-0.2 rounded text-[9px] font-mono border ${
                connectionStatus.success
                  ? 'bg-emerald-950/50 text-emerald-400/90 border-emerald-800/60'
                  : 'bg-rose-950/40 text-rose-300 border-rose-800/60'
              }`}
            >
              {connectionStatus.success ? `CONNECTED (${connectionStatus.latency_ms}ms)` : 'OFFLINE'}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-1 text-slate-400 hover:text-slate-200 bg-slate-800/80 hover:bg-slate-800 rounded border border-slate-700/80 transition"
            title="Reload storage data"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-orange-400' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded transition flex items-center gap-1"
          >
            <Zap className={`w-3 h-3 text-amber-400/90 ${testing ? 'animate-spin' : ''}`} />
            <span>{testing ? 'Testing...' : 'Check Connection'}</span>
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

      {/* KPI Cards: Storage Report */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5 font-medium uppercase tracking-wider">
            <span>Bucket Status</span>
            <Server className="w-3.5 h-3.5 text-sky-400/90" />
          </div>
          <div className="text-sm font-bold font-mono text-slate-200 truncate">
            {report?.connected ? 'Online' : 'Not Connected'}
          </div>
          <div className="text-[10px] font-mono text-slate-400 truncate">
            {report?.bucket || config.s3_bucket_name}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5 font-medium uppercase tracking-wider">
            <span>Total Objects</span>
            <FileText className="w-3.5 h-3.5 text-orange-400/90" />
          </div>
          <div className="text-sm font-bold font-mono text-slate-200">
            {report?.total_objects ?? 0}
          </div>
          <div className="text-[10px] font-mono text-slate-400">Stored Files</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5 font-medium uppercase tracking-wider">
            <span>Used Storage</span>
            <HardDrive className="w-3.5 h-3.5 text-emerald-400/90" />
          </div>
          <div className="text-sm font-bold font-mono text-emerald-400/90">
            {report?.total_size_formatted || '0 B'}
          </div>
          <div className="text-[10px] font-mono text-slate-400">Private Bucket</div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5">
          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-0.5 font-medium uppercase tracking-wider">
            <span>S3 Latency</span>
            <Clock className="w-3.5 h-3.5 text-amber-400/90" />
          </div>
          <div className="text-sm font-bold font-mono text-slate-200">
            {report?.connected ? `${report.latency_ms}ms` : '--'}
          </div>
          <div className="text-[10px] font-mono text-slate-400 truncate">
            {config.s3_region || 'us-west-004'}
          </div>
        </div>
      </div>

      {/* S3 Credentials Form */}
      <form onSubmit={handleSave} className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800/70 pb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-orange-400/90" />
            <span>S3 Credentials & Endpoint</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setConfig((prev) => ({
                ...prev,
                s3_endpoint: 'https://s3.us-west-004.backblazeb2.com',
                s3_region: 'us-west-004',
                s3_bucket_name: 'gitforgedev',
              }));
              onNotify('Backblaze B2 defaults filled');
            }}
            className="text-[10px] font-mono text-orange-400/90 hover:text-orange-300"
          >
            Default Format
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[11px]">
          {/* Access Key ID */}
          <div className="space-y-1">
            <label className="font-medium text-slate-300">S3_ACCESS_KEY_ID (keyID)</label>
            <input
              type="text"
              value={config.s3_access_key_id}
              onChange={(e) => setConfig({ ...config, s3_access_key_id: e.target.value })}
              placeholder="004ed10a50959920000000001"
              required
              className="w-full bg-slate-950/80 border border-slate-800/80 rounded px-2 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Secret Access Key */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-medium text-slate-300">S3_SECRET_ACCESS_KEY (applicationKey)</label>
              {config.has_secret_key && !config.s3_secret_access_key && (
                <span className="text-[9px] font-mono text-emerald-400/90">Key Saved</span>
              )}
            </div>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={config.s3_secret_access_key}
                onChange={(e) => setConfig({ ...config, s3_secret_access_key: e.target.value })}
                placeholder={config.masked_secret_key || 'K004B8TNGPOMzZgWT4LVAxkrsRvKj10'}
                className="w-full bg-slate-950/80 border border-slate-800/80 rounded px-2 py-1 pr-8 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
              />
              <button
                type="button"
                onClick={() => setShowSecret(!showSecret)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
          </div>

          {/* Bucket Name */}
          <div className="space-y-1">
            <label className="font-medium text-slate-300">S3_BUCKET_NAME</label>
            <input
              type="text"
              value={config.s3_bucket_name}
              onChange={(e) => setConfig({ ...config, s3_bucket_name: e.target.value })}
              placeholder="gitforgedev"
              required
              className="w-full bg-slate-950/80 border border-slate-800/80 rounded px-2 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Endpoint */}
          <div className="space-y-1">
            <label className="font-medium text-slate-300">S3_ENDPOINT</label>
            <input
              type="text"
              value={config.s3_endpoint}
              onChange={(e) => setConfig({ ...config, s3_endpoint: e.target.value })}
              placeholder="https://s3.us-west-004.backblazeb2.com"
              required
              className="w-full bg-slate-950/80 border border-slate-800/80 rounded px-2 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
            />
          </div>

          {/* Region */}
          <div className="space-y-1 sm:col-span-2">
            <label className="font-medium text-slate-300">S3_REGION</label>
            <input
              type="text"
              value={config.s3_region}
              onChange={(e) => setConfig({ ...config, s3_region: e.target.value })}
              placeholder="us-west-004"
              required
              className="w-full bg-slate-950/80 border border-slate-800/80 rounded px-2 py-1 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-orange-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/70">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testing}
            className="px-2.5 py-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded transition flex items-center gap-1"
          >
            <Zap className={`w-3 h-3 text-amber-400/90 ${testing ? 'animate-spin' : ''}`} />
            <span>Test Connection</span>
          </button>

          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1 bg-orange-600/90 hover:bg-orange-600 text-white text-[11px] font-medium rounded transition flex items-center gap-1 shadow-xs"
          >
            <Save className="w-3 h-3" />
            <span>{saving ? 'Saving...' : 'Save Storage Config'}</span>
          </button>
        </div>
      </form>

      {/* Pre-signed URL Gateway & Probe Tester */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg p-2.5 space-y-2.5">
        <div className="flex items-center justify-between border-b border-slate-800/70 pb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <LinkIcon className="w-3.5 h-3.5 text-orange-400/90" />
            <span>Pre-signed URL & File Access Gateway</span>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="file"
              ref={filePickerRef}
              onChange={handleDirectFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => filePickerRef.current?.click()}
              disabled={uploading}
              className="px-2 py-0.5 text-[10px] font-medium text-white bg-orange-600/90 hover:bg-orange-600 rounded transition flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Upload className={`w-2.5 h-2.5 ${uploading ? 'animate-spin' : ''}`} />
              <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
            </button>

            <button
              type="button"
              onClick={handleUploadProbe}
              disabled={uploading}
              className="px-2 py-0.5 text-[10px] font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded transition flex items-center gap-1"
            >
              <FileText className="w-2.5 h-2.5 text-sky-400/90" />
              <span>Probe</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px]">
          <div className="flex-1 flex items-center bg-slate-950/80 border border-slate-800/80 rounded overflow-hidden">
            <span className="px-2 py-1 bg-slate-900 border-r border-slate-800/80 text-slate-400 font-mono text-[10px]">
              /file/
            </span>
            <input
              type="text"
              value={testFileName}
              onChange={(e) => setTestFileName(e.target.value)}
              placeholder="sample-file.txt"
              className="flex-1 px-2 py-1 text-slate-200 font-mono text-[11px] focus:outline-none bg-transparent"
            />
          </div>

          <button
            type="button"
            onClick={handleGenerateLink}
            className="px-2.5 py-1 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700/80 rounded text-[11px] font-medium transition shrink-0 flex items-center gap-1"
          >
            <Zap className="w-3 h-3 text-orange-400/90" />
            <span>Generate Link</span>
          </button>

          <a
            href={`/file/${testFileName.replace(/^\/+/, '')}`}
            target="_blank"
            rel="noreferrer"
            className="px-2.5 py-1 bg-orange-600/90 hover:bg-orange-600 text-white rounded text-[11px] font-medium transition shrink-0 flex items-center gap-1 shadow-xs"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open /file</span>
          </a>
        </div>

        {/* Output Pre-signed Result */}
        {generatedLink && (
          <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 space-y-1.5 text-[10px] font-mono">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-emerald-400/90 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                Temporary S3 Pre-Signed Ticket (1 Hour Expiry)
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(generatedLink.signedUrl)}
                className="text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                {copiedLink ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="p-1.5 rounded bg-slate-900 border border-slate-800/70 text-slate-300 break-all select-all">
              {generatedLink.signedUrl}
            </div>
          </div>
        )}
      </div>

      {/* Bucket Objects List / Storage Explorer */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-slate-950/80 border-b border-slate-800/80 flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400/90" />
            <span>Bucket Files ({report?.objects?.length ?? 0})</span>
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {report?.bucket || config.s3_bucket_name}
          </span>
        </div>

        {report?.objects && report.objects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] font-mono">
              <thead className="bg-slate-950/40 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800/70">
                <tr>
                  <th className="py-1.5 px-2.5">Object Key</th>
                  <th className="py-1.5 px-2.5">Size</th>
                  <th className="py-1.5 px-2.5">Last Modified</th>
                  <th className="py-1.5 px-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {report.objects.map((obj) => (
                  <tr key={obj.key} className="hover:bg-slate-800/30 transition">
                    <td className="py-1.5 px-2.5 text-slate-200 font-medium">
                      <div className="flex items-center gap-1.5 truncate max-w-[280px]">
                        <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="truncate">{obj.key}</span>
                      </div>
                    </td>
                    <td className="py-1.5 px-2.5 text-slate-300">{obj.size_formatted}</td>
                    <td className="py-1.5 px-2.5 text-slate-400 text-[10px]">
                      {new Date(obj.last_modified).toLocaleString()}
                    </td>
                    <td className="py-1.5 px-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setTestFileName(obj.key);
                            handleGenerateLink();
                          }}
                          className="px-1.5 py-0.5 text-[10px] text-slate-300 hover:text-white bg-slate-800/80 rounded border border-slate-700/60"
                          title="Generate Pre-signed URL"
                        >
                          Ticket
                        </button>

                        <a
                          href={`/file/${obj.key}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-1.5 py-0.5 text-[10px] text-sky-400 hover:text-sky-300 bg-slate-800/80 rounded border border-slate-700/60 flex items-center gap-0.5"
                          title="Open via /file gateway redirect"
                        >
                          <ExternalLink className="w-2.5 h-2.5" />
                          <span>View</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => handleDeleteObject(obj.key)}
                          className="p-1 text-slate-400 hover:text-rose-300 hover:bg-slate-800 rounded transition"
                          title="Delete object"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 text-center text-[11px] font-mono text-slate-400">
            {report?.connected
              ? 'No objects found in bucket. Click "Upload Test Probe" to verify write access.'
              : 'Storage offline or credentials not configured.'}
          </div>
        )}
      </div>
    </div>
  );
};
