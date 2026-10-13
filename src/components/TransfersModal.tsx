import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ArrowUpDown, ArrowUp, ArrowDown, X, Pause, Play, Trash2, CheckCircle2, AlertCircle, Loader2, Cloud, Download, Folder } from 'lucide-react';
import { formatBytes } from '../utils';
import { TransferState } from './TransferManager';
import { toast } from 'sonner';

interface UploadHistoryItem {
  id: string;
  name: string;
  folderId?: string;
  folderName?: string;
  date: string;
  size?: number;
}

interface DownloadHistoryItem {
  id: string;
  name: string;
  date: string;
  size?: number;
}

interface TransfersModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUploads: TransferState[];
  activeDownloads: any[];
  onPauseUpload?: (id: string) => void;
  onResumeUpload?: (id: string) => void;
  onCancelUpload?: (id: string) => void;
  onPauseDownload?: (id: string) => void;
  onResumeDownload?: (id: string) => void;
  onCancelDownload?: (id: string) => void;
  onClearCompletedTransfers?: () => void;
}

const formatSpeed = (bytesPerSec?: number) => {
  if (!bytesPerSec || bytesPerSec <= 0) return '';
  if (bytesPerSec > 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1024).toFixed(0)} KB/s`;
};

const formatETA = (seconds?: number) => {
  if (seconds === undefined || seconds <= 0) return '';
  if (seconds > 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m left`;
  if (seconds > 60) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s left`;
  return `${Math.round(seconds)}s left`;
};

const formatRelativeDate = (dateStr: string) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / (60 * 1000));
    const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export default function TransfersModal({
  isOpen,
  onClose,
  activeUploads,
  activeDownloads,
  onPauseUpload,
  onResumeUpload,
  onCancelUpload,
  onPauseDownload,
  onResumeDownload,
  onCancelDownload,
  onClearCompletedTransfers
}: TransfersModalProps) {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'uploads' | 'downloads'>('all');
  const [uploadHistory, setUploadHistory] = useState<UploadHistoryItem[]>([]);
  const [downloadHistory, setDownloadHistory] = useState<DownloadHistoryItem[]>([]);

  // Load history from localStorage
  const loadHistory = () => {
    try {
      const up = JSON.parse(localStorage.getItem('drive_vault_upload_history') || '[]');
      setUploadHistory(Array.isArray(up) ? up : []);
    } catch {
      setUploadHistory([]);
    }
    try {
      const down = JSON.parse(localStorage.getItem('drive_vault_download_history') || '[]');
      setDownloadHistory(Array.isArray(down) ? down : []);
    } catch {
      setDownloadHistory([]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleSync = () => loadHistory();
    window.addEventListener('vault-transfers-synced', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('vault-transfers-synced', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Filter lists
  const currentActiveUploads = activeUploads.filter(t => t.status === 'uploading' || t.status === 'pending' || t.status === 'paused');
  const currentActiveDownloads = activeDownloads.filter(d => d.status === 'downloading' || d.status === 'paused');
  const totalActiveCount = currentActiveUploads.length + currentActiveDownloads.length;

  // Calculate live transfer speeds
  const totalSpeed = currentActiveUploads.reduce((acc, t) => acc + (t.speed || 0), 0);
  const formattedActiveSpeed = totalSpeed > 0 ? formatSpeed(totalSpeed) : '';

  // Clear completed history
  const handleClearCompleted = () => {
    localStorage.removeItem('drive_vault_upload_history');
    localStorage.removeItem('drive_vault_download_history');
    setUploadHistory([]);
    setDownloadHistory([]);
    if (onClearCompletedTransfers) {
      onClearCompletedTransfers();
    }
    window.dispatchEvent(new CustomEvent('vault-transfers-synced'));
    toast.success('Cleared completed transfers log');
  };

  // Remove individual upload history item
  const handleRemoveUploadHistory = (id: string) => {
    const next = uploadHistory.filter(h => h.id !== id);
    setUploadHistory(next);
    localStorage.setItem('drive_vault_upload_history', JSON.stringify(next));
  };

  // Remove individual download history item
  const handleRemoveDownloadHistory = (id: string) => {
    const next = downloadHistory.filter(h => h.id !== id);
    setDownloadHistory(next);
    localStorage.setItem('drive_vault_download_history', JSON.stringify(next));
  };

  // Counts for filter pills
  const totalUploadsCount = currentActiveUploads.length + uploadHistory.length;
  const totalDownloadsCount = currentActiveDownloads.length + downloadHistory.length;
  const totalAllCount = totalUploadsCount + totalDownloadsCount;

  const hasCompletedItems = uploadHistory.length > 0 || downloadHistory.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[85vh] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-slate-200/80 dark:border-slate-800/80 rounded-3xl p-0 overflow-hidden shadow-2xl flex flex-col [&>button.absolute]:hidden">
        
        {/* ── Top Header (matches Android TransfersBottomSheet) ── */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between shrink-0 bg-white/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 shadow-xs">
              <ArrowUpDown size={20} className={totalActiveCount > 0 ? "animate-pulse" : ""} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-tight">Transfers</h2>
                {totalActiveCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold shadow-xs shadow-blue-500/30">
                    {totalActiveCount} Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {totalActiveCount > 0 
                  ? `${totalActiveCount} in progress${formattedActiveSpeed ? ` • ${formattedActiveSpeed}` : ''}`
                  : 'Completed uploads & downloads log'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {hasCompletedItems && (
              <button
                onClick={handleClearCompleted}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                title="Clear all completed records"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Clear Completed</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition active:scale-95 cursor-pointer shrink-0"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Filter Chips (All, Uploads, Downloads) ── */}
        <div className="px-5 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-900/30 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-2xs ${
              selectedFilter === 'all'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                : 'bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            All ({totalAllCount})
          </button>
          <button
            onClick={() => setSelectedFilter('uploads')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-2xs flex items-center gap-1.5 ${
              selectedFilter === 'uploads'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                : 'bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowUp size={13} strokeWidth={2.5} />
            Uploads ({totalUploadsCount})
          </button>
          <button
            onClick={() => setSelectedFilter('downloads')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer shadow-2xs flex items-center gap-1.5 ${
              selectedFilter === 'downloads'
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
                : 'bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowDown size={13} strokeWidth={2.5} />
            Downloads ({totalDownloadsCount})
          </button>
        </div>

        {/* ── Scrollable Content Area ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 no-scrollbar">

          {/* ── 1. ACTIVE UPLOADS ── */}
          {(selectedFilter === 'all' || selectedFilter === 'uploads') && currentActiveUploads.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                Active Uploads ({currentActiveUploads.length})
              </h3>
              {currentActiveUploads.map(upload => {
                const speedStr = upload.speed ? formatSpeed(upload.speed) : 'Calculating...';
                const timeStr = upload.remainingSeconds ? formatETA(upload.remainingSeconds) : '';
                return (
                  <div
                    key={upload.id}
                    className="p-4 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40 shadow-xs flex flex-col gap-2.5 relative group"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Cloud size={19} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{upload.name}</p>
                          <p className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                            {upload.status === 'paused' ? 'Paused' : `${upload.progress}% • ${speedStr}${timeStr ? ` • ${timeStr}` : ''}`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {(upload.status === 'uploading' || upload.status === 'paused') && (
                          <button
                            onClick={() => {
                              if (upload.status === 'uploading' && onPauseUpload) onPauseUpload(upload.id);
                              else if (upload.status === 'paused' && onResumeUpload) onResumeUpload(upload.id);
                            }}
                            className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-blue-600 transition active:scale-95 cursor-pointer"
                            title={upload.status === 'uploading' ? 'Pause' : 'Resume'}
                          >
                            {upload.status === 'uploading' ? <Pause size={14} fill="currentColor" /> : <Play size={14} className="ml-0.5" fill="currentColor" />}
                          </button>
                        )}
                        {onCancelUpload && (
                          <button
                            onClick={() => onCancelUpload(upload.id)}
                            className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-600 transition active:scale-95 cursor-pointer"
                            title="Cancel upload"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200/80 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-300 ${upload.status === 'paused' ? 'bg-amber-500' : 'bg-blue-600 dark:bg-blue-500'}`}
                        style={{ width: `${Math.max(upload.progress, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── 2. ACTIVE DOWNLOADS ── */}
          {(selectedFilter === 'all' || selectedFilter === 'downloads') && currentActiveDownloads.length > 0 && (
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                Active Downloads ({currentActiveDownloads.length})
              </h3>
              {currentActiveDownloads.map(dl => (
                <div
                  key={dl.id}
                  className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 shadow-xs flex flex-col gap-2.5 relative group"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                        <Download size={19} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{dl.name}</p>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          {dl.status === 'paused' ? 'Paused' : `${dl.progress || 0}% • ${dl.speed || 'Downloading...'}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {(dl.status === 'downloading' || dl.status === 'paused') && (
                        <button
                          onClick={() => {
                            if (dl.status === 'downloading' && onPauseDownload) onPauseDownload(dl.id);
                            else if (dl.status === 'paused' && onResumeDownload) onResumeDownload(dl.id);
                          }}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:text-emerald-600 transition active:scale-95 cursor-pointer"
                          title={dl.status === 'downloading' ? 'Pause' : 'Resume'}
                        >
                          {dl.status === 'downloading' ? <Pause size={14} fill="currentColor" /> : <Play size={14} className="ml-0.5" fill="currentColor" />}
                        </button>
                      )}
                      {onCancelDownload && (
                        <button
                          onClick={() => onCancelDownload(dl.id)}
                          className="w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-600 transition active:scale-95 cursor-pointer"
                          title="Cancel download"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-slate-200/80 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${dl.status === 'paused' ? 'bg-amber-500' : 'bg-emerald-600 dark:bg-emerald-500'}`}
                      style={{ width: `${Math.max(dl.progress || 0, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── 3. COMPLETED UPLOADS ── */}
          {(selectedFilter === 'all' || selectedFilter === 'uploads') && uploadHistory.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 pt-1">
                Completed Uploads ({uploadHistory.length})
              </h3>
              {uploadHistory.map(item => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800/80 shadow-xs flex items-center justify-between gap-3 hover:border-slate-200 dark:hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Cloud size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {item.size ? <span>{formatBytes(item.size)}</span> : null}
                        {item.size ? <span>•</span> : null}
                        <span className="truncate">To: {item.folderName || 'My Drive'}</span>
                        {item.date ? <span>•</span> : null}
                        <span>{formatRelativeDate(item.date)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                      <CheckCircle2 size={11} strokeWidth={2.5} />
                      Uploaded
                    </span>
                    <button
                      onClick={() => handleRemoveUploadHistory(item.id)}
                      className="p-1 text-slate-300 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-300 rounded-lg transition"
                      title="Remove from history"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── 4. COMPLETED DOWNLOADS ── */}
          {(selectedFilter === 'all' || selectedFilter === 'downloads') && downloadHistory.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1 pt-1">
                Completed Downloads ({downloadHistory.length})
              </h3>
              {downloadHistory.map(item => (
                <div
                  key={item.id}
                  className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-800/80 shadow-xs flex items-center justify-between gap-3 hover:border-slate-200 dark:hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Download size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {item.size ? <span>{formatBytes(item.size)}</span> : null}
                        {item.size && item.date ? <span>•</span> : null}
                        {item.date ? <span>{formatRelativeDate(item.date)}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
                      <CheckCircle2 size={11} strokeWidth={2.5} />
                      Downloaded
                    </span>
                    <button
                      onClick={() => handleRemoveDownloadHistory(item.id)}
                      className="p-1 text-slate-300 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-300 rounded-lg transition"
                      title="Remove from history"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── EMPTY STATE (matches Android) ── */}
          {((selectedFilter === 'all' && totalAllCount === 0) ||
            (selectedFilter === 'uploads' && totalUploadsCount === 0) ||
            (selectedFilter === 'downloads' && totalDownloadsCount === 0)) && (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <ArrowUpDown size={28} className="stroke-[1.6]" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {selectedFilter === 'uploads' ? 'No uploads recorded' : selectedFilter === 'downloads' ? 'No downloads recorded' : 'No transfers yet'}
                </h4>
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
                  {selectedFilter === 'uploads'
                    ? 'Uploaded files will appear here.'
                    : selectedFilter === 'downloads'
                    ? 'Downloaded files will appear here.'
                    : 'Your active uploads, downloads and history will appear here.'}
                </p>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
