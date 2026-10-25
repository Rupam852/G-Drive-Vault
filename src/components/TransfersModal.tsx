import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ArrowUpDown, ArrowUp, ArrowDown, X, Pause, Play, Trash2, CheckCircle2, BatteryCharging } from 'lucide-react';
import { formatBytes } from '../utils';
import { TransferState } from './TransferManager';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';

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
  const [showSpeedBoostBanner, setShowSpeedBoostBanner] = useState(false);

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
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android') {
        const boostEnabled = localStorage.getItem('drive_vault_speed_boost') === 'true';
        setShowSpeedBoostBanner(!boostEnabled);
      }
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
  const currentActiveDownloads = activeDownloads.filter(d => !d.status || d.status === 'downloading' || d.status === 'paused');
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
      <DialogContent className="w-full sm:max-w-2xl max-h-[88vh] sm:max-h-[85vh] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-t-[28px] sm:rounded-3xl p-0 overflow-hidden shadow-2xl flex flex-col [&>button.absolute]:hidden max-sm:fixed max-sm:bottom-0 max-sm:left-0 max-sm:right-0 max-sm:top-auto max-sm:translate-x-0 max-sm:translate-y-0 max-sm:border-b-0 max-sm:rounded-b-none">
        
        {/* ── Mobile Drag Handle (matches Android ModalBottomSheet) ── */}
        <div className="w-full pt-3 pb-1 flex justify-center sm:hidden shrink-0">
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* ── Top Header (matches Android TransfersBottomSheet) ── */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800/60 flex items-center justify-between shrink-0 bg-white dark:bg-slate-900">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">Transfers</h2>
            {totalActiveCount > 0 ? (
              <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-0.5">
                {totalActiveCount} active{formattedActiveSpeed ? ` • ${formattedActiveSpeed}` : ''}
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Uploads & Downloads history
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {hasCompletedItems && (
              <button
                onClick={handleClearCompleted}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl text-blue-600 hover:text-rose-600 dark:text-blue-400 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                title="Clear all completed records"
              >
                <Trash2 size={13} />
                <span>Clear Completed</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition active:scale-95 cursor-pointer shrink-0"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Filter Chips: All, Uploads, Downloads (matches Android shape & icons) ── */}
        <div className="px-5 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/50 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              selectedFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            All ({totalAllCount})
          </button>
          <button
            onClick={() => setSelectedFilter('uploads')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              selectedFilter === 'uploads'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowUp size={14} strokeWidth={2.5} />
            Uploads ({totalUploadsCount})
          </button>
          <button
            onClick={() => setSelectedFilter('downloads')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              selectedFilter === 'downloads'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowDown size={14} strokeWidth={2.5} />
            Downloads ({totalDownloadsCount})
          </button>
        </div>

        {/* ── Background Speed Boost Hint (matches Android) ── */}
        {totalActiveCount > 0 && showSpeedBoostBanner && (
          <div className="mx-5 sm:mx-6 mt-3 p-3 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <BatteryCharging size={18} className="text-blue-600 dark:text-blue-400 shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-300 font-medium truncate">
                Prevent phone sleep mode from slowing background speed
              </p>
            </div>
            <button
              onClick={() => {
                setShowSpeedBoostBanner(false);
                localStorage.setItem('drive_vault_speed_boost', 'true');
                toast.success('Background boost enabled');
              }}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 cursor-pointer"
            >
              Enable
            </button>
          </div>
        )}

        {/* ── Scrollable Transfer Cards List (matches Android TransferItemCard) ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3 no-scrollbar">

          {/* ── ACTIVE UPLOADS ── */}
          {(selectedFilter === 'all' || selectedFilter === 'uploads') && currentActiveUploads.map(upload => {
            const speedStr = upload.speed ? formatSpeed(upload.speed) : '';
            const timeStr = upload.remainingSeconds ? formatETA(upload.remainingSeconds) : '';
            const loadedStr = upload.loaded ? formatBytes(upload.loaded) : '';
            const totalStr = upload.total ? formatBytes(upload.total) : '';
            const progressDetail = (loadedStr && totalStr) ? `${loadedStr} of ${totalStr}` : `${upload.progress}%`;

            return (
              <div
                key={upload.id}
                className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex flex-col gap-2.5 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Direction Icon: Emerald circle with ArrowUpward (matches Android) */}
                    <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <ArrowUp size={18} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{upload.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {upload.status === 'paused'
                          ? 'Paused'
                          : `${progressDetail}${speedStr ? ` • ${speedStr}` : ''}${timeStr ? ` • ${timeStr}` : ''}`}
                      </p>
                    </div>
                  </div>

                  {/* Percentage + Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {upload.progress}%
                    </span>
                    {(upload.status === 'uploading' || upload.status === 'paused') && onPauseUpload && (
                      <button
                        onClick={() => {
                          if (upload.status === 'uploading' && onPauseUpload) onPauseUpload(upload.id);
                          else if (upload.status === 'paused' && onResumeUpload) onResumeUpload(upload.id);
                        }}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition active:scale-95 cursor-pointer"
                        title={upload.status === 'uploading' ? 'Pause' : 'Resume'}
                      >
                        {upload.status === 'uploading' ? <Pause size={12} fill="currentColor" /> : <Play size={12} className="ml-0.5" fill="currentColor" />}
                      </button>
                    )}
                    {onCancelUpload && (
                      <button
                        onClick={() => onCancelUpload(upload.id)}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:text-rose-600 transition active:scale-95 cursor-pointer"
                        title="Cancel upload"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Android Sleek Linear Progress Bar (4dp height) */}
                <div className="w-full bg-emerald-500/20 dark:bg-emerald-950/40 rounded-full h-1 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${upload.status === 'paused' ? 'bg-amber-500' : 'bg-emerald-500 dark:bg-emerald-400'}`}
                    style={{ width: `${Math.max(upload.progress, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}

          {/* ── ACTIVE DOWNLOADS ── */}
          {(selectedFilter === 'all' || selectedFilter === 'downloads') && currentActiveDownloads.map(dl => {
            const dlProgress = typeof dl.progress === 'number' && dl.progress >= 0 ? dl.progress : 0;
            const dlSpeed = dl.speed || (dl as any).speedText || 'Downloading...';
            const dlSize = dl.sizeText || '';
            const dlEta = dl.eta || '';
            const dlDetails = [
              dlSize,
              dlSpeed,
              dlEta
            ].filter(Boolean).join(' • ');

            return (
              <div
                key={dl.id}
                className="p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex flex-col gap-2.5 transition"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Direction Icon: Indigo circle with ArrowDownward (matches Android) */}
                    <div className="w-10 h-10 rounded-full bg-indigo-500/15 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <ArrowDown size={18} strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{dl.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                        {dl.status === 'paused' ? 'Paused' : `${dlProgress}% • ${dlDetails || dlSpeed}`}
                      </p>
                    </div>
                  </div>

                  {/* Percentage + Action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                      {dlProgress}%
                    </span>
                    {(dl.status === 'downloading' || dl.status === 'paused') && onPauseDownload && (
                      <button
                        onClick={() => {
                          if (dl.status === 'downloading' && onPauseDownload) onPauseDownload(dl.id);
                          else if (dl.status === 'paused' && onResumeDownload) onResumeDownload(dl.id);
                        }}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-indigo-600 transition active:scale-95 cursor-pointer"
                        title={dl.status === 'downloading' ? 'Pause' : 'Resume'}
                      >
                        {dl.status === 'downloading' ? <Pause size={12} fill="currentColor" /> : <Play size={12} className="ml-0.5" fill="currentColor" />}
                      </button>
                    )}
                    {onCancelDownload && (
                      <button
                        onClick={() => onCancelDownload(dl.id)}
                        className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-400 hover:text-rose-600 transition active:scale-95 cursor-pointer"
                        title="Cancel download"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Android Sleek Linear Progress Bar (4dp height) */}
                <div className="w-full bg-indigo-500/20 dark:bg-indigo-950/40 rounded-full h-1 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${dl.status === 'paused' ? 'bg-amber-500' : 'bg-indigo-500 dark:bg-indigo-400'}`}
                    style={{ width: `${Math.max(dlProgress, 2)}%` }}
                  />
                </div>
              </div>
            );
          })}

          {/* ── COMPLETED UPLOADS ── */}
          {(selectedFilter === 'all' || selectedFilter === 'uploads') && uploadHistory.map(item => (
            <div
              key={item.id}
              className="p-3 rounded-2xl bg-slate-50/40 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 hover:border-slate-200 dark:hover:border-slate-700 transition"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <ArrowUp size={16} strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                    Completed {item.size ? `• ${formatBytes(item.size)}` : ''} {item.date ? `• ${formatRelativeDate(item.date)}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <CheckCircle2 size={18} className="text-emerald-500" strokeWidth={2.5} />
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

          {/* ── COMPLETED DOWNLOADS ── */}
          {(selectedFilter === 'all' || selectedFilter === 'downloads') && downloadHistory.map(item => (
            <div
              key={item.id}
              className="p-3 rounded-2xl bg-slate-50/40 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 hover:border-slate-200 dark:hover:border-slate-700 transition"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-9 h-9 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <ArrowDown size={16} strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{item.name}</p>
                  <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                    Completed {item.size ? `• ${formatBytes(item.size)}` : ''} {item.date ? `• ${formatRelativeDate(item.date)}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <CheckCircle2 size={18} className="text-indigo-500" strokeWidth={2.5} />
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
                    : 'Uploaded and downloaded files will appear here'}
                </p>
              </div>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
