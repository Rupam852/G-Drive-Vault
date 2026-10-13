import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Image, FileText, Video, Music, MoreHorizontal, Plus, Folder, Archive, RefreshCw, Camera, ExternalLink, Edit2, Share2, Trash2, Star, EyeOff, Move, Download, Cloud, Package, ChevronRight, Info, X, Smartphone, FileArchive, FileQuestion, File, Check, Loader2 } from 'lucide-react';

import { StorageStats, FileItem } from '@/src/types';
import { motion, AnimatePresence } from 'motion/react';
import React, { useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatBytes } from '../utils';
import FileDetails from './FileDetails';
import FileActionBottomSheet from './FileActionBottomSheet';
import { getCloudflareStreamUrl } from '../services/edgeStreamService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://g-drive-vault.onrender.com';



interface DashboardProps {
  user: any;
  tokens: any;
  files: FileItem[];
  storageInfo: any;
  storageBreakdown?: any;
  categorySyncState?: 'syncing' | 'synced' | 'idle';
  onUpload: (file: File, relativePath?: string, targetFolderId?: string) => void;
  onNativeUpload?: (targetFolderId?: string) => void;
  setActiveTab: (tab: string) => void;
  onRefreshStorage?: () => void;
  onCategoryClick?: (type: string) => void;
  onCreateFolder?: (name: string, targetFolderId?: string) => void;
  onRename?: (id: string, name: string) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onHide?: (id: string) => void;
  onMove?: (ids: string | string[], newParentId?: string) => void;
  onStar?: (id: string, starred: boolean) => void;
  onNavigateToFiles?: (targetFolderId?: string, openFile?: FileItem) => void;
  isDownloadEnabled?: boolean;
  onShowInfo?: (file: FileItem) => void;
}

export default function Dashboard({ user, tokens, files, storageInfo, storageBreakdown, categorySyncState: propCategorySyncState, onUpload, onNativeUpload, setActiveTab, onRefreshStorage, onCategoryClick, onCreateFolder, onRename, onDelete, onShare, onHide, onMove, onStar, onNavigateToFiles, isDownloadEnabled, onShowInfo }: DashboardProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [localSyncState, setLocalSyncState] = useState<'syncing' | 'synced' | 'idle'>('idle');
  const [isFabExpanded, setIsFabExpanded] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [actionMenuFile, setActionMenuFile] = useState<FileItem | null>(null);
  const [renameFile, setRenameFile] = useState<FileItem | null>(null);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [showStorageDetails, setShowStorageDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dashFolderInputRef = useRef<HTMLInputElement>(null);
  const [showDashUploadSheet, setShowDashUploadSheet] = useState(false);
  const [activeDownloads, setActiveDownloads] = useState<{
    id: string; name: string; progress: number; controller: AbortController;
  }[]>([]);

  // CENTRAL BACK GESTURE HANDLING
  useEffect(() => {
    const handleVaultBack = (e: any) => {
      if (isFabExpanded) { e.preventDefault(); setIsFabExpanded(false); return; }
      if (selectedFile) { e.preventDefault(); setSelectedFile(null); return; }
      if (actionMenuFile) { e.preventDefault(); setActionMenuFile(null); return; }
      if (isNewFolderOpen) { e.preventDefault(); setIsNewFolderOpen(false); return; }
      if (isRenameOpen) { e.preventDefault(); setIsRenameOpen(false); return; }
      if (showStorageDetails) { e.preventDefault(); setShowStorageDetails(false); return; }
    };

    window.addEventListener('vault-back', handleVaultBack);
    return () => window.removeEventListener('vault-back', handleVaultBack);
  }, [isFabExpanded, selectedFile, actionMenuFile, isNewFolderOpen, isRenameOpen, showStorageDetails]);

  // Set webkitdirectory via setAttribute — required for Android WebView folder picker
  useEffect(() => {
    if (dashFolderInputRef.current) {
      dashFolderInputRef.current.setAttribute('webkitdirectory', '');
      dashFolderInputRef.current.setAttribute('directory', '');
      dashFolderInputRef.current.setAttribute('multiple', '');
    }
  }, []);

  const currentSyncState: 'syncing' | 'synced' | 'idle' = (propCategorySyncState && propCategorySyncState !== 'idle')
    ? propCategorySyncState
    : (localSyncState !== 'idle' ? localSyncState : (storageBreakdown ? 'idle' : 'syncing'));

  const handleRefresh = async () => {
    if (onRefreshStorage) {
      setIsRefreshing(true);
      setLocalSyncState('syncing');
      try {
        await onRefreshStorage();
        toast.success('Storage & files synced with Google Drive');
        setLocalSyncState('synced');
        setTimeout(() => setLocalSyncState('idle'), 1100);
      } catch (err) {
        toast.error('Failed to sync storage');
        setLocalSyncState('idle');
      } finally {
        setTimeout(() => setIsRefreshing(false), 700);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      Array.from(selectedFiles).forEach((file: File) => {
        // Dashboard always uploads to My Drive root
        onUpload(file, (file as any).webkitRelativePath || undefined, 'root');
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (dashFolderInputRef.current) dashFolderInputRef.current.value = '';
    }
    setShowDashUploadSheet(false);
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim() && onCreateFolder) {
      onCreateFolder(newFolderName.trim(), 'root');
      setNewFolderName('');
      setIsNewFolderOpen(false);
    }
  };

  const handleRename = () => {
    if (renameValue.trim() && renameFile && onRename) {
      onRename(renameFile.id, renameValue.trim());
      setIsRenameOpen(false);
      setRenameFile(null);
    }
  };

  const openRenameDialog = (file: FileItem) => {
    setRenameFile(file);
    setRenameValue(file.name);
    setIsRenameOpen(true);
  };

  const stats: StorageStats = React.useMemo(() => {
    return {
      used: storageInfo ? parseInt(storageInfo.usage) : files.reduce((acc, f) => acc + f.sizeBytes, 0),
      total: storageInfo ? parseInt(storageInfo.limit) : 15 * 1024 * 1024 * 1024, // Default to 15GB if unknown
      categories: [
        { 
          name: 'Images', 
          size: storageBreakdown ? formatBytes(storageBreakdown.image.size) : formatBytes(files.filter(f => f.type === 'image').reduce((acc, f) => acc + f.sizeBytes, 0)), 
          color: 'bg-blue-500', 
          count: storageBreakdown ? storageBreakdown.image.count : files.filter(f => f.type === 'image').length, 
          type: 'image' 
        },
        { 
          name: 'Videos', 
          size: storageBreakdown ? formatBytes(storageBreakdown.video.size) : formatBytes(files.filter(f => f.type === 'video').reduce((acc, f) => acc + f.sizeBytes, 0)), 
          color: 'bg-purple-500', 
          count: storageBreakdown ? storageBreakdown.video.count : files.filter(f => f.type === 'video').length, 
          type: 'video' 
        },
        { 
          name: 'Documents', 
          size: storageBreakdown ? formatBytes(storageBreakdown.document.size) : formatBytes(files.filter(f => f.type === 'document').reduce((acc, f) => acc + f.sizeBytes, 0)), 
          color: 'bg-orange-500', 
          count: storageBreakdown ? storageBreakdown.document.count : files.filter(f => f.type === 'document').length, 
          type: 'document' 
        },
        { 
          name: 'Audio', 
          size: storageBreakdown ? formatBytes(storageBreakdown.audio.size) : formatBytes(files.filter(f => f.type === 'audio').reduce((acc, f) => acc + f.sizeBytes, 0)), 
          color: 'bg-green-500', 
          count: storageBreakdown ? storageBreakdown.audio.count : files.filter(f => f.type === 'audio').length, 
          type: 'audio' 
        },
        { 
          name: 'APKs & Apps', 
          size: storageBreakdown ? formatBytes(storageBreakdown.apk.size) : formatBytes(files.filter(f => f.type === 'apk').reduce((acc, f) => acc + f.sizeBytes, 0)), 
          color: 'bg-teal-500', 
          count: storageBreakdown ? storageBreakdown.apk.count : files.filter(f => f.type === 'apk').length, 
          type: 'apk' 
        },
        { 
          name: 'Folders', 
          size: '--', 
          color: 'bg-yellow-500', 
          count: files.filter(f => f.type === 'folder').length, 
          type: 'folder' 
        },
        { 
          name: 'Archives', 
          size: storageBreakdown ? formatBytes(storageBreakdown.archive.size) : formatBytes(files.filter(f => f.type === 'archive').reduce((acc, f) => acc + f.sizeBytes, 0)), 
          color: 'bg-red-500', 
          count: storageBreakdown ? storageBreakdown.archive.count : files.filter(f => f.type === 'archive').length, 
          type: 'archive' 
        },
        { 
          name: 'Other Files', 
          size: storageBreakdown ? formatBytes(storageBreakdown.other.size) : formatBytes(files.filter(f => f.type === 'other').reduce((acc, f) => acc + f.sizeBytes, 0)), 
          color: 'bg-slate-500', 
          count: storageBreakdown ? storageBreakdown.other.count : files.filter(f => f.type === 'other').length, 
          type: 'other' 
        },
      ]
    };
  }, [storageInfo, storageBreakdown, files]);

  const handleDownload = async (file: FileItem) => {
    if (!file || !tokens) return;

    if (isDownloadEnabled === false) {
      toast.error('Download Error: File Permission is disabled in Settings.');
      return;
    }

    const dlId = Math.random().toString(36).substring(7);
    const controller = new AbortController();
    
    const isFolder = file.type === 'folder';
    const finalFilename = isFolder ? (file.name.endsWith('.zip') ? file.name : `${file.name}.zip`) : file.name;

    setActiveDownloads(prev => [...prev, { id: dlId, name: finalFilename, progress: 0, controller }]);

    try {
      const ticketRes = await fetch(`${API_BASE_URL}/api/drive/download/ticket`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens }), signal: controller.signal,
      });
      if (!ticketRes.ok) throw new Error('Ticket failed');
      const { ticketId } = await ticketRes.json();

      const isNative = Capacitor.isNativePlatform();
      const isAndroid = isNative && Capacitor.getPlatform() === 'android';

      const cfUrl = !isFolder ? getCloudflareStreamUrl(file.id, tokens) : null;
      const downloadUrl = (cfUrl && !isAndroid)
        ? cfUrl
        : `${API_BASE_URL}/api/drive/download/${file.id}?ticket=${ticketId}`;

      if (isAndroid) {
        try {
          const UploadNotification = Capacitor.registerPlugin<any>('UploadNotification');
          
          let progressListener: any;
          UploadNotification.addListener('onDownloadProgress', (data: any) => {
            if (data.id === dlId) {
              setActiveDownloads(prev => prev.map(d => d.id === dlId ? {
                ...d,
                progress: data.progress,
                speed: data.speedText,
                eta: data.etaText,
                sizeText: data.sizeText
              } : d));
            }
          }).then(l => progressListener = l);

          UploadNotification.downloadFileNatively({
            url: downloadUrl,
            filename: finalFilename,
            id: dlId,
            size: file.sizeBytes || 0
          }).then(() => {
            setActiveDownloads(prev => prev.filter(d => d.id !== dlId));
            if (progressListener) progressListener.remove();
            toast.success(`🎉 Download Completed: ${finalFilename}`);
          }).catch((e: any) => {
            console.error('Native download failed asynchronously:', e);
            setActiveDownloads(prev => prev.filter(d => d.id !== dlId));
            if (progressListener) progressListener.remove();
            toast.error(`❌ Download Failed: ${e.message || e}`);
          });

          toast.success(`⬇️ Download Started: ${finalFilename}\nCheck notifications for progress!`);
          return;
        } catch (e: any) {
          console.warn('Native download failed, falling back to chunked downloader...', e);
        }
      }

      let res: Response;
      try {
        res = await fetch(downloadUrl, { signal: controller.signal });
        if (!res.ok && downloadUrl !== `${API_BASE_URL}/api/drive/download/${file.id}?ticket=${ticketId}`) {
          console.warn('Edge download returned non-200, retrying standard server...');
          res = await fetch(`${API_BASE_URL}/api/drive/download/${file.id}?ticket=${ticketId}`, { signal: controller.signal });
        }
      } catch (fetchErr: any) {
        if (downloadUrl !== `${API_BASE_URL}/api/drive/download/${file.id}?ticket=${ticketId}`) {
          console.warn('Edge download failed, retrying standard server...', fetchErr);
          res = await fetch(`${API_BASE_URL}/api/drive/download/${file.id}?ticket=${ticketId}`, { signal: controller.signal });
        } else {
          throw fetchErr;
        }
      }
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Download failed (${res.status})`);
      }

      if (!res.body) throw new Error('Download stream is unavailable');
      
      // Default native Android to Directory.External (App's private storage on SD card, 100% permission-free and EACCES-free)
      let directoryUsed = Directory.ExternalStorage;
      let finalPath = 'Download/' + finalFilename;
      let isFallbackUsed = false;

      // Request permissions on native platform & do pre-flight directory check
      if (isNative) {
        try {
          await Filesystem.requestPermissions();
        } catch (e) {
          console.warn('requestPermissions ignored/failed:', e);
        }

        // Pre-flight check: test if Directory.ExternalStorage/Download is writable
        try {
          const testPath = 'Download/.vault_test_temp';
          await Filesystem.writeFile({
            path: testPath,
            data: 'a',
            directory: Directory.ExternalStorage,
            recursive: true
          });
          await Filesystem.deleteFile({
            path: testPath,
            directory: Directory.ExternalStorage
          });
        } catch (e) {
          console.warn('Direct Download directory restricted. Switching to app-private External directory:', e);
          directoryUsed = Directory.External;
          finalPath = finalFilename; // write to root of Directory.External
          isFallbackUsed = true;
        }

        // Delete old file if exists to prevent corrupt appending
        try {
          await Filesystem.deleteFile({
            path: finalPath,
            directory: directoryUsed
          });
        } catch (e) {
          // File did not exist, which is fine
        }
      }

      const contentLength = res.headers.get('Content-Length');
      let total = contentLength ? parseInt(contentLength) : 0;
      if (total <= 0 && file.sizeBytes > 0) {
        total = file.sizeBytes;
      }
      
      const reader = res.body!.getReader();
      
      let received = 0;
      let accumulatedChunks: Uint8Array[] = [];
      let accumulatedSize = 0;
      let isFirstWrite = true;
      const CHUNK_SIZE_THRESHOLD = 8 * 1024 * 1024; // 8MB optimal threshold to prevent OOM and bridge latency

      const startTime = Date.now();
      let lastNotificationTime = 0;

      const formatBytes = (bytes: number, decimals = 1) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
      };

      const writeAccumulatedToNative = async () => {
        if (accumulatedChunks.length === 0) return;
        const blob = new Blob(accumulatedChunks as BlobPart[]);
        const base64 = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onloadend = () => {
            const resStr = fr.result as string;
            resolve(resStr.split(',')[1]);
          };
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });

        if (isFirstWrite) {
          await Filesystem.writeFile({
            path: finalPath,
            data: base64,
            directory: directoryUsed,
            recursive: true
          });
          isFirstWrite = false;
        } else {
          await Filesystem.appendFile({
            path: finalPath,
            data: base64,
            directory: directoryUsed
          });
        }
        accumulatedChunks = [];
        accumulatedSize = 0;
      };

      const webChunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          received += value.length;
          const pct = total > 0 ? Math.min(99, Math.round((received / total) * 100)) : -1;
          setActiveDownloads(prev => prev.map(d => d.id === dlId ? { ...d, progress: pct } : d));

          if (isNative) {
            // Update custom notification with app logo, progress speed, growing size/total size, and bacha hua time
            const now = Date.now();
            if (now - lastNotificationTime > 800) {
              const elapsedSeconds = (now - startTime) / 1000;
              const speed = elapsedSeconds > 0 ? received / elapsedSeconds : 0;
              const remainingBytes = total > 0 ? Math.max(0, total - received) : 0;
              const remainingSeconds = speed > 0 ? remainingBytes / speed : 0;
              
              const speedText = speed > 1048576 ? `${(speed / 1048576).toFixed(1)} MB/s` : `${(speed / 1024).toFixed(0)} KB/s`;
              const etaText = remainingSeconds > 60 ? `${Math.floor(remainingSeconds/60)}m left` : `${Math.round(remainingSeconds)}s left`;
              const progressSizeText = total > 0 ? `${formatBytes(received)} / ${formatBytes(total)}` : formatBytes(received);
              const speedDetails = total > 0 ? `${progressSizeText} • ${speedText} • ${etaText}` : `${progressSizeText} • ${speedText}`;

              try {
                const UploadNotification = Capacitor.registerPlugin<any>('UploadNotification');
                await UploadNotification.showProgressNotification({
                  id: dlId,
                  title: `Downloading ${finalFilename}`,
                  progress: pct,
                  speedText: speedDetails,
                  isPaused: false
                });
              } catch (e) {
                console.warn('Failed to update native download notification:', e);
              }
              lastNotificationTime = now;
            }

            accumulatedChunks.push(value);
            accumulatedSize += value.length;
            if (accumulatedSize >= CHUNK_SIZE_THRESHOLD) {
              await writeAccumulatedToNative();
            }
          } else {
            webChunks.push(value);
          }
        }
      }

      if (isNative) {
        await writeAccumulatedToNative();
        setActiveDownloads(prev => prev.map(d => d.id === dlId ? { ...d, progress: 100 } : d));
        
        // Custom success notification
        try {
          const UploadNotification = Capacitor.registerPlugin<any>('UploadNotification');
          await UploadNotification.showSuccessNotification({
            id: dlId,
            notificationTitle: 'Download Successful',
            title: `Downloaded ${finalFilename}`
          });
        } catch (e) {
          console.warn('Failed to show native download success notification:', e);
        }

        if (isFallbackUsed) {
          toast.success(`✅ Saved to App Private folder:\nAndroid/data/com.rupam.drivevault/files/${finalFilename}`, { duration: 6000 });
        } else {
          toast.success(`✅ Saved to Downloads: ${finalFilename}`);
        }
      } else {
        setActiveDownloads(prev => prev.map(d => d.id === dlId ? { ...d, progress: 100 } : d));
        const blob = new Blob(webChunks as BlobPart[]);
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = blobUrl; a.download = finalFilename; a.click();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        toast.success(`Downloaded: ${finalFilename}`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') toast.info(`Cancelled: ${file.name}`);
      else { 
        console.error('Download error:', err); 
        toast.error(`Error: ${err.message || 'Failed to download file'}`);
      }
      
      // Cancel notification if failed/cancelled
      if (Capacitor.isNativePlatform()) {
        try {
          const UploadNotification = Capacitor.registerPlugin<any>('UploadNotification');
          await UploadNotification.cancelNotification({ id: dlId });
        } catch (e) {}
      }
    } finally {
      setTimeout(() => setActiveDownloads(prev => prev.filter(d => d.id !== dlId)), 1200);
    }
  };

  const handleCopyShareLink = (file: FileItem) => {
    const link = file.webViewLink ||
      (file.type === 'folder'
        ? `https://drive.google.com/drive/folders/${file.id}?usp=sharing`
        : `https://drive.google.com/file/d/${file.id}/view?usp=sharing`);
    navigator.clipboard.writeText(link)
      .then(() => toast.success('🔗 Link copied! Anyone with the link can view in Google Drive.'))
      .catch(() => toast.error('Failed to copy link'));
  };

  const handleOpenFile = (file: FileItem) => {
    if (file.type === 'folder') {
      if (onNavigateToFiles) onNavigateToFiles(file.id);
    } else {
      if (onNavigateToFiles) {
        onNavigateToFiles(undefined, file);
      } else {
        setSelectedFile(file);
      }
    }
  };

  const iconMap = {
    image: Image,
    video: Video,
    document: FileText,
    audio: Music,
    apk: Smartphone,
    folder: Folder,
    archive: FileArchive,
    other: FileQuestion,
  };

  const categoryThemeMap: Record<string, { textColor: string; countBadge: string }> = {
    image: { textColor: 'text-blue-500 dark:text-blue-400', countBadge: 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-300' },
    video: { textColor: 'text-purple-500 dark:text-purple-400', countBadge: 'bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-300' },
    document: { textColor: 'text-amber-500 dark:text-amber-400', countBadge: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300' },
    audio: { textColor: 'text-emerald-500 dark:text-emerald-400', countBadge: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300' },
    apk: { textColor: 'text-teal-500 dark:text-teal-400', countBadge: 'bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-300' },
    folder: { textColor: 'text-amber-500 dark:text-amber-400', countBadge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
    archive: { textColor: 'text-rose-500 dark:text-rose-400', countBadge: 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300' },
    other: { textColor: 'text-slate-500 dark:text-slate-400', countBadge: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
  };

  return (
    <div className="flex-1 p-4 pb-6 md:pb-8 md:p-10 space-y-6 md:space-y-10 max-w-7xl mx-auto w-full">
      <header className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 md:hidden">
            <Cloud size={24} />
          </div>
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight">DriveVault</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Welcome back, {user?.name.split(' ')[0]}</p>
          </div>
        </div>

        {/* ── Live Drive Sync Button (matches Android HomeScreen) ── */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all border shadow-sm ${
              isRefreshing
                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/50'
                : 'bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700/60 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 active:scale-95'
            }`}
            title="Sync Drive"
          >
            <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-blue-600' : 'text-slate-500 dark:text-slate-400'} />
            <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync Drive'}</span>
          </button>
        </div>
      </header>

      <Card 
        onClick={() => setShowStorageDetails(true)}
        className="bg-white dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-700/60 shadow-sm hover:shadow-md hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer transition-all duration-200 group"
      >
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Storage Used</p>
                <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                {isRefreshing ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[10px] font-semibold border border-blue-200 dark:border-blue-800/50 animate-pulse">
                    <RefreshCw size={10} className="animate-spin" />
                    Syncing Drive...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Synced
                  </span>
                )}
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatBytes(stats.used)} <span className="text-sm font-normal text-slate-400">/ {formatBytes(stats.total, 0)}</span></p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">{((stats.used / stats.total) * 100).toFixed(1)}% Full</p>
            </div>
          </div>
          <Progress value={(stats.used / stats.total) * 100} className="h-2 bg-slate-200 dark:bg-slate-700" />
        </CardContent>
      </Card>

      <Dialog open={showStorageDetails} onOpenChange={setShowStorageDetails}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-none rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold dark:text-white flex items-center gap-2">
              <Info className="text-blue-500" size={20} />
              Storage Details
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-slate-500">Total Capacity</span>
                <span className="text-slate-900 dark:text-white">{formatBytes(stats.total)}</span>
              </div>
              <div className="flex justify-between text-sm font-medium">
                <span className="text-slate-500">Space Used</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">{formatBytes(stats.used)}</span>
              </div>
              <Progress value={(stats.used / stats.total) * 100} className="h-3 bg-slate-100 dark:bg-slate-800" />
              <p className="text-[10px] text-slate-400 text-center uppercase tracking-widest pt-1">
                {formatBytes(stats.total - stats.used)} Available
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Breakdown by Category</h4>
              <div className="grid gap-3">
                {stats.categories.filter(c => c.size !== '--').map(cat => (
                  <div key={cat.name} className="flex items-center gap-4 group">
                    <div className={`w-10 h-10 rounded-xl ${cat.color} bg-opacity-10 flex items-center justify-center text-${cat.color.split('-')[1]}-600 dark:text-${cat.color.split('-')[1]}-400 shrink-0`}>
                      {React.createElement(iconMap[cat.type] || File, { size: 18 })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{cat.name}</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{cat.size}</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className={`h-full ${cat.color} rounded-full`}
                          style={{ width: `${(cat.count > 0 ? (parseFloat(cat.size) / (stats.total / (1024*1024*1024)) * 100) : 0) || 1}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowStorageDetails(false)} className="w-full rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 h-11 text-md font-bold">
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
        {stats.categories.map((cat, idx) => {
          const Icon = iconMap[cat.type] || File;
          const theme = categoryThemeMap[cat.type] || categoryThemeMap.other;
          return (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.25 }}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onCategoryClick ? onCategoryClick(cat.type) : setActiveTab('files')}
              className="group cursor-pointer p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-lg dark:hover:shadow-slate-900/40 hover:border-slate-200 dark:hover:border-slate-600 transition-all duration-200 flex flex-col justify-between min-h-[114px]"
            >
              {/* Header: Clean floating icon (No inner box) + smooth Syncing -> Synced -> Count animated badge */}
              <div className="flex items-start justify-between">
                <div className="transition-transform duration-200 group-hover:scale-110 origin-left">
                  <Icon size={28} className={`${theme.textColor} transition-colors`} />
                </div>
                
                {/* Modern Pill Badge for Count / Syncing / Synced */}
                <AnimatePresence mode="wait">
                  {currentSyncState === 'syncing' ? (
                    <motion.div
                      key="syncing"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.18 }}
                      className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${theme.countBadge}`}
                    >
                      <Loader2 size={10} className="animate-spin shrink-0" />
                      <span>Syncing</span>
                    </motion.div>
                  ) : currentSyncState === 'synced' ? (
                    <motion.div
                      key="synced"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.18 }}
                      className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                    >
                      <Check size={11} strokeWidth={2.5} className="shrink-0" />
                      <span>Synced</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="count"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ duration: 0.18 }}
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${theme.countBadge}`}
                    >
                      {cat.count}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Category Info */}
              <div className="mt-3">
                <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {cat.name}
                </h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
                  {currentSyncState === 'syncing' && (!storageBreakdown || cat.size === '0 B') ? (
                    <span className="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500 animate-pulse">
                      <span className="w-1 h-1 rounded-full bg-blue-500 animate-ping inline-block" />
                      Syncing...
                    </span>
                  ) : (
                    cat.size === '--' ? 'Directories' : cat.size
                  )}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Files</h2>
          <button 
            onClick={() => setActiveTab('files')} 
            className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer active:scale-95 transition-all"
          >
            View All
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {files.slice(0, 6).map((file, idx) => {
            const Icon = iconMap[file.type] || FileText;
            const theme = categoryThemeMap[file.type] || categoryThemeMap.other;
            return (
              <div 
                key={idx} 
                onClick={() => handleOpenFile(file)}
                className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60 hover:shadow-md hover:border-slate-200 dark:hover:border-slate-600 transition-all cursor-pointer group"
              >
                <div className="shrink-0 transition-transform duration-200 group-hover:scale-110">
                  <Icon size={26} className={theme.textColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {file.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                    {file.size} {file.date ? `• ${file.date}` : ''}
                  </p>
                </div>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActionMenuFile(file);
                  }}
                  className="text-slate-300 dark:text-slate-600 hover:text-blue-500 transition-colors p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50"
                >
                  <MoreHorizontal size={18} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Hidden inputs */}
      <input type="file" ref={fileInputRef} className="hidden" multiple accept="*/*" onChange={handleFileChange} />
      <input type="file" ref={dashFolderInputRef} className="hidden" webkitdirectory="" directory="" onChange={handleFileChange} />

      {/* ── EXPANDABLE SPEED DIAL FAB (matches Android ExpandableSpeedDialFab.kt) ── */}
      {/* Backdrop when speed dial is open */}
      <AnimatePresence>
        {isFabExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
            onClick={() => setIsFabExpanded(false)}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-24 right-4 md:bottom-10 md:right-10 z-50 flex flex-col items-end gap-3">
        {/* Expanded Speed Dial Action Items */}
        <AnimatePresence>
          {isFabExpanded && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="flex flex-col items-end gap-3"
            >
              {/* Option 1: Camera */}
              <div className="flex items-center gap-2.5">
                <span className="bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg border border-slate-200/60 dark:border-slate-800 pointer-events-none select-none">
                  Camera
                </span>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    setIsFabExpanded(false);
                    const i = document.createElement('input');
                    i.type = 'file';
                    i.accept = 'image/*';
                    (i as any).capture = 'environment';
                    i.onchange = (e: any) => handleFileChange(e);
                    i.click();
                  }}
                  className="w-12 h-12 bg-purple-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-purple-600/30 hover:bg-purple-700 transition-colors"
                  title="Take Photo"
                >
                  <Camera size={20} />
                </motion.button>
              </div>

              {/* Option 2: Upload Files */}
              <div className="flex items-center gap-2.5">
                <span className="bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg border border-slate-200/60 dark:border-slate-800 pointer-events-none select-none">
                  Upload Files
                </span>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    setIsFabExpanded(false);
                    if (Capacitor.isNativePlatform() && onNativeUpload) {
                      onNativeUpload();
                    } else {
                      fileInputRef.current?.click();
                    }
                  }}
                  className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-600/30 hover:bg-blue-700 transition-colors"
                  title="Upload Files"
                >
                  <Plus size={22} />
                </motion.button>
              </div>

              {/* Option 3: Upload Folder */}
              <div className="flex items-center gap-2.5">
                <span className="bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg border border-slate-200/60 dark:border-slate-800 pointer-events-none select-none">
                  Upload Folder
                </span>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    setIsFabExpanded(false);
                    if (Capacitor.isNativePlatform()) {
                      toast.info("ℹ️ Android limitation: Folder selection is not natively supported by WebViews. Please use 'Upload Files' to select multiple files!", { duration: 5000 });
                    } else {
                      dashFolderInputRef.current?.click();
                    }
                  }}
                  className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-orange-500/30 hover:bg-orange-600 transition-colors"
                  title="Upload Folder"
                >
                  <Archive size={20} />
                </motion.button>
              </div>

              {/* Option 4: New Folder */}
              <div className="flex items-center gap-2.5">
                <span className="bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 text-xs font-semibold px-3 py-1.5 rounded-xl shadow-lg border border-slate-200/60 dark:border-slate-800 pointer-events-none select-none">
                  New Folder
                </span>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => {
                    setIsFabExpanded(false);
                    setIsNewFolderOpen(true);
                  }}
                  className="w-12 h-12 bg-teal-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-teal-600/30 hover:bg-teal-700 transition-colors"
                  title="New Folder"
                >
                  <Folder size={20} />
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary FAB Button (rotates + to ×) */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsFabExpanded(prev => !prev)}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-2xl transition-all duration-300 ${
            isFabExpanded 
              ? 'bg-slate-800 dark:bg-slate-700 shadow-slate-900/40 ring-4 ring-white/20' 
              : 'bg-blue-600 shadow-blue-500/40 hover:bg-blue-700'
          }`}
          aria-label={isFabExpanded ? "Close menu" : "Create or Upload"}
        >
          <motion.div
            animate={{ rotate: isFabExpanded ? 135 : 0 }}
            transition={{ type: 'spring', damping: 15, stiffness: 220 }}
          >
            <Plus size={30} strokeWidth={2.5} />
          </motion.div>
        </motion.button>
      </div>

      {/* ── DOWNLOAD PROGRESS OVERLAY (fixed top) ── */}
      {activeDownloads.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[999] space-y-1 p-3 pointer-events-none">
          {activeDownloads.map(dl => (
            <div key={dl.id} className="bg-slate-900/97 backdrop-blur-md rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl border border-slate-700/60 pointer-events-auto">
              <div className="w-8 h-8 rounded-lg bg-blue-900/40 flex items-center justify-center shrink-0">
                <Download size={16} className="text-blue-400 animate-bounce" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate mb-1.5">{dl.name}</p>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  {dl.progress >= 0 ? (
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-300"
                      style={{ width: `${dl.progress}%` }}
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-full animate-[shimmer_1.5s_infinite]" />
                  )}
                </div>
              </div>
              <span className="text-[11px] font-bold text-blue-400 shrink-0 w-8 text-right">
                {dl.progress >= 0 ? `${dl.progress}%` : ''}
              </span>
              <button
                onClick={() => dl.controller.abort()}
                className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-red-500/80 flex items-center justify-center text-slate-400 hover:text-white transition-all shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-none rounded-3xl">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg font-bold dark:text-white">Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <Input 
              placeholder="Folder name" 
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="h-12 bg-slate-50 dark:bg-slate-800 border-2 border-blue-500 rounded-xl text-sm focus-visible:ring-0"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleCreateFolder}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-base font-semibold"
            >Create</Button>
            <Button
              variant="ghost"
              onClick={() => setIsNewFolderOpen(false)}
              className="w-full h-11 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-sm bg-white dark:bg-slate-900 border-none rounded-3xl px-6 pb-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg font-bold dark:text-white">
              Rename {renameFile?.type === 'folder' ? 'Folder' : 'File'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <Input
              placeholder="New name"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="h-12 bg-slate-50 dark:bg-slate-800 border-2 border-blue-500 rounded-xl text-sm focus-visible:ring-0"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleRename}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-base font-semibold"
            >Rename</Button>
            <Button
              variant="ghost"
              onClick={() => setIsRenameOpen(false)}
              className="w-full h-11 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── RICH FILE/FOLDER ACTION BOTTOM SHEET (matches Android FileActionBottomSheet.kt) ── */}
      <FileActionBottomSheet
        file={actionMenuFile}
        isOpen={!!actionMenuFile}
        onClose={() => setActionMenuFile(null)}
        onOpen={handleOpenFile}
        onDownload={handleDownload}
        onRename={openRenameDialog}
        onMove={(f) => {
          if (onMove) onMove(f.id);
        }}
        onStar={onStar}
        onShare={onShare}
        onShowInfo={onShowInfo}
        onHide={onHide}
        onDelete={onDelete}
      />

      <FileDetails 
        file={selectedFile}
        isOpen={!!selectedFile}
        tokens={tokens}
        onClose={() => setSelectedFile(null)}
        onDelete={onDelete || (() => {})}
        onShare={onShare}
        onDownload={handleDownload}
      />

      {/* ── DOWNLOAD PROGRESS OVERLAY (fixed top) ── */}
      {activeDownloads.length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[999] space-y-1 p-3 pointer-events-none">
          {activeDownloads.map(dl => (
            <div key={dl.id} className="bg-slate-900/97 backdrop-blur-md rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl border border-slate-700/60 pointer-events-auto">
              <div className="w-8 h-8 rounded-lg bg-blue-900/40 flex items-center justify-center shrink-0">
                <Download size={16} className="text-blue-400 animate-bounce" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white truncate mb-1.5">{dl.name}</p>
                <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                  {dl.progress >= 0 ? (
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-300"
                      style={{ width: `${dl.progress}%` }}
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-r from-transparent via-blue-500 to-transparent rounded-full animate-[shimmer_1.5s_infinite]" />
                  )}
                </div>
              </div>
              <span className="text-[11px] font-bold text-blue-400 shrink-0 min-w-[42px] text-right">
                {dl.progress >= 0 ? `${dl.progress}%` : ''}
              </span>
              <button
                onClick={() => dl.controller.abort()}
                className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-red-500/80 flex items-center justify-center text-slate-400 hover:text-white transition-all shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

