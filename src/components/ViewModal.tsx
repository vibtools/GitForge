import React, { useState } from 'react';
import {
  X,
  ExternalLink,
  Copy,
  Check,
  Globe,
  Server,
  ShieldCheck,
  Terminal,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { DeploymentViewData } from '../types';

interface ViewModalProps {
  data: DeploymentViewData | null;
  isOpen: boolean;
  onClose: () => void;
  onRebuild: (deploymentId: string) => void;
}

export const ViewModal: React.FC<ViewModalProps> = ({
  data,
  isOpen,
  onClose,
  onRebuild,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dns' | 'logs'>('dns');

  if (!isOpen || !data) return null;

  const { deployment, dns } = data;

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-100">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-900">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-orange-400" />
            <h2 className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
              <span>{deployment.alias}</span>
              {deployment.cf_pages_project_name && (
                <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {deployment.cf_pages_project_name}
                </span>
              )}
            </h2>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onRebuild(deployment.id)}
              className="px-2 py-0.5 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Rebuild</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3 overflow-y-auto space-y-2 text-[11px]">
          {/* Domains Overview Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Free Pages Domain */}
            <div className="bg-slate-950 border border-slate-800 rounded p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-blue-400" />
                  Free Pages Domain
                </span>
                <span className="px-1 py-0.2 text-[9px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/40 rounded">
                  Live
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                <a
                  href={deployment.pages_dev_domain}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[10px] text-blue-400 hover:underline truncate"
                >
                  {deployment.pages_dev_domain || `${deployment.cf_pages_project_name}.pages.dev`}
                </a>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() =>
                      copyToClipboard(
                        deployment.pages_dev_domain || `https://${deployment.cf_pages_project_name}.pages.dev`,
                        'free_domain'
                      )
                    }
                    className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                  >
                    {copiedKey === 'free_domain' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                  <a
                    href={deployment.pages_dev_domain}
                    target="_blank"
                    rel="noreferrer"
                    className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>

            {/* Custom Subdomain */}
            <div className="bg-slate-950 border border-slate-800 rounded p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-slate-400 flex items-center gap-1">
                  <Server className="w-3 h-3 text-orange-400" />
                  Custom Subdomain
                </span>
                <span className="px-1 py-0.2 text-[9px] font-mono text-orange-400 bg-orange-950/50 border border-orange-800/40 rounded">
                  Mapped
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 bg-slate-900 px-2 py-1 rounded border border-slate-800">
                <a
                  href={deployment.custom_domain}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[10px] text-orange-400 hover:underline truncate"
                >
                  {deployment.custom_domain || `${deployment.cname_host}.${deployment.root_domain}`}
                </a>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() =>
                      copyToClipboard(
                        deployment.custom_domain || `https://${deployment.cname_host}.${deployment.root_domain}`,
                        'custom_domain'
                      )
                    }
                    className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                  >
                    {copiedKey === 'custom_domain' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                  <a
                    href={deployment.custom_domain}
                    target="_blank"
                    rel="noreferrer"
                    className="p-0.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Selector: DNS Configuration vs Build Logs */}
          <div className="flex items-center border-b border-slate-800 gap-3 pt-0.5">
            <button
              onClick={() => setActiveTab('dns')}
              className={`pb-1 text-xs transition-colors border-b-2 flex items-center gap-1 ${
                activeTab === 'dns'
                  ? 'text-orange-400 border-orange-500 font-medium'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              <span>DNS Records</span>
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`pb-1 text-xs transition-colors border-b-2 flex items-center gap-1 ${
                activeTab === 'logs'
                  ? 'text-orange-400 border-orange-500 font-medium'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3 h-3" />
              <span>Logs</span>
            </button>
          </div>

          {activeTab === 'dns' ? (
            <div className="space-y-1.5">
              <div className="flex justify-end">
                <button
                  onClick={() =>
                    copyToClipboard(
                      `Type: CNAME\nName: ${dns.name}\nTarget: ${dns.content}\nTTL: Auto`,
                      'all_dns'
                    )
                  }
                  className="px-1.5 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition inline-flex items-center gap-1"
                >
                  {copiedKey === 'all_dns' ? (
                    <>
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-2.5 h-2.5" />
                      <span>Copy DNS</span>
                    </>
                  )}
                </button>
              </div>

              {/* DNS Table */}
              <div className="border border-slate-800 rounded overflow-hidden bg-slate-950">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead className="bg-slate-900 text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-2 py-1">Type</th>
                      <th className="px-2 py-1">Name</th>
                      <th className="px-2 py-1">Target</th>
                      <th className="px-2 py-1">TTL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    <tr>
                      <td className="px-2 py-1 font-bold text-amber-400">
                        {dns.type || 'CNAME'}
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <span className="text-white">{dns.name}</span>
                          <button
                            onClick={() => copyToClipboard(dns.name, 'name')}
                            className="text-slate-400 hover:text-white p-0.5"
                          >
                            {copiedKey === 'name' ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <span className="text-blue-400 truncate max-w-[170px]">{dns.content}</span>
                          <button
                            onClick={() => copyToClipboard(dns.content, 'content')}
                            className="text-slate-400 hover:text-white p-0.5"
                          >
                            {copiedKey === 'content' ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-2 py-1 text-slate-400">Auto</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* BIND Format Snippet */}
              <div className="p-1.5 bg-slate-950 rounded border border-slate-800 space-y-0.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>BIND Format:</span>
                  <button
                    onClick={() => copyToClipboard(dns.bind_format, 'bind')}
                    className="text-slate-400 hover:text-white flex items-center gap-1 transition text-[10px]"
                  >
                    {copiedKey === 'bind' ? (
                      <Check className="w-2.5 h-2.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-2.5 h-2.5" />
                    )}
                    <span>Copy BIND</span>
                  </button>
                </div>
                <pre className="font-mono text-[10px] text-slate-300 bg-slate-900 p-1 rounded border border-slate-800 overflow-x-auto select-all">
                  {dns.bind_format}
                </pre>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex justify-end">
                <button
                  onClick={() => copyToClipboard(deployment.logs || 'No logs', 'logs')}
                  className="text-slate-400 hover:text-white flex items-center gap-1 transition text-[10px]"
                >
                  {copiedKey === 'logs' ? (
                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-2.5 h-2.5" />
                  )}
                  <span>Copy Logs</span>
                </button>
              </div>
              <div className="bg-slate-950 p-2 rounded border border-slate-800 font-mono text-[10px] text-slate-300 whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed">
                {deployment.logs || 'No build logs recorded yet.'}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 border-t border-slate-800 bg-slate-900 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-2.5 py-0.5 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
