import React, { useState, useRef, useEffect } from 'react';
import { Search, Grid, List as ListIcon, MoreVertical, File as FileIcon, Image as ImageIcon, Video, Music, FileText, ArrowUpDown, Plus, Folder, Archive, Camera, User, Star, Trash2, Move, Check, Share2, Edit2, ExternalLink, EyeOff, Download, X, ChevronRight, Info, Smartphone, FileArchive, FileQuestion, CheckSquare, Minus, Loader2 } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { motion } from 'motion/react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileItem } from '../types';
import FileDetails from './FileDetails';
import FileActionBottomSheet from './FileActionBottomSheet';
import { toast } from 'sonner';
import { getCloudflareStreamUrl } from '../services/edgeStreamService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://g-drive-vault.onrender.com';

const truncateFilename = (name: string, maxLen = 30): string => {
  if (!name || name.length <= maxLen) return name;
  const extIndex = name.lastIndexOf('.');
  if (extIndex !== -1 && name.length - extIndex <= 8) {
    const ext = name.substring(extIndex);
    const base = name.substring(0, extIndex);
    const charsToShow = maxLen - ext.length - 3;
    if (charsToShow > 5) {
      return base.substring(0, charsToShow) + '...' + ext;
    }
  }
  return name.substring(0, maxLen - 3) + '...';
};


interface FileExplorerProps {
  files: FileItem[];
  tokens: any;
  breadcrumb: {id: string, name: string}[];
  filterType: string;
  onFilterChange: (type: string) => void;
  onNavigate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onUpload: (file: File, relativePath?: string) => void;
  onNativeUpload?: (targetFolderId?: string) => void;
  onCreateFolder: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onShare: (id: string) => void;
  onTabChange: (tab: string) => void;

  onStar: (id: string, starred: boolean) => void;
  onMove: (ids: string | string[], targetId?: string) => void;
  onHide: (id: string) => void;
  isDownloadEnabled?: boolean;
  activeSubTab: string;
  onShowInfo: (file: FileItem) => void;
  autoOpenFile?: FileItem | null;
  onClearAutoOpenFile?: () => void;
  activeDownloads: any[];
  setActiveDownloads: React.Dispatch<React.SetStateAction<any[]>>;
  onCancelDownload: (id: string) => void;
  isFilesLoading?: boolean;
  activeTransfersCount?: number;
  onTransfersClick?: () => void;
}

const iconMap = {
  image: ImageIcon,
  video: Video,
  document: FileText,
  audio: Music,
  apk: Smartphone,
  folder: Folder,
  archive: FileArchive,
  other: FileQuestion,
};

const categoryThemeMap: Record<string, { textColor: string; bgColor: string }> = {
  image: { textColor: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-900/20' },
  video: { textColor: 'text-purple-500', bgColor: 'bg-purple-50 dark:bg-purple-900/20' },
  document: { textColor: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-900/20' },
  audio: { textColor: 'text-emerald-500', bgColor: 'bg-emerald-50 dark:bg-emerald-900/20' },
  apk: { textColor: 'text-teal-500', bgColor: 'bg-teal-50 dark:bg-teal-900/20' },
  folder: { textColor: 'text-amber-500', bgColor: 'bg-amber-50 dark:bg-amber-900/20' },
  archive: { textColor: 'text-rose-500', bgColor: 'bg-rose-50 dark:bg-rose-900/20' },
  other: { textColor: 'text-slate-500', bgColor: 'bg-slate-100 dark:bg-slate-800' },
};

export default function FileExplorer({ files, tokens, breadcrumb, filterType, onFilterChange, onNavigate, onDelete, onUpload, onNativeUpload, onCreateFolder, onRename, onShare, onTabChange, activeSubTab, onStar, onMove, onHide, isDownloadEnabled, onShowInfo, autoOpenFile, onClearAutoOpenFile, activeDownloads, setActiveDownloads, onCancelDownload, isFilesLoading = false, activeTransfersCount = 0, onTransfersClick }: FileExplorerProps) {
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'date_desc' | 'date_asc' | 'size_desc' | 'size_asc' | 'type'>('date_desc');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [actionMenuFile, setActionMenuFile] = useState<FileItem | null>(null);
  const [renameFile, setRenameFile] = useState<FileItem | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [showUploadSheet, setShowUploadSheet] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const pressTimerRef = useRef<any>(null);
  const isPressingRef = useRef(false);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [moveBrowsePath, setMoveBrowsePath] = useState<{id: string, name: string}[]>([{id: "root", name: "My Drive"}]);
  const [moveBrowseFolders, setMoveBrowseFolders] = useState<FileItem[]>([]);
  const [moveBrowseLoading, setMoveBrowseLoading] = useState(false);

  // CENTRAL BACK GESTURE HANDLING
  useEffect(() => {
    const handleVaultBack = (e: any) => {
      if (selectedFile) { e.preventDefault(); setSelectedFile(null); return; }
      if (actionMenuFile) { e.preventDefault(); setActionMenuFile(null); return; }
      if (isNewFolderOpen) { e.preventDefault(); setIsNewFolderOpen(false); return; }
      if (isRenameOpen) { e.preventDefault(); setIsRenameOpen(false); return; }
      if (isMoveDialogOpen) { e.preventDefault(); setIsMoveDialogOpen(false); return; }
      if (isSelectionMode) { e.preventDefault(); setIsSelectionMode(false); setSelectedIds(new Set()); return; }
    };

    window.addEventListener('vault-back', handleVaultBack);
    return () => window.removeEventListener('vault-back', handleVaultBack);
  }, [selectedFile, actionMenuFile, isNewFolderOpen, isRenameOpen, isMoveDialogOpen, isSelectionMode]);

  // Trigger autoOpenFile if passed from Dashboard
  useEffect(() => {
    if (autoOpenFile) {
      const found = files.find(f => f.id === autoOpenFile.id);
      if (found) {
        setSelectedFile(found);
      } else {
        setSelectedFile(autoOpenFile);
      }
      if (onClearAutoOpenFile) onClearAutoOpenFile();
    }
  }, [autoOpenFile, files]);

  // Push/pop history state for selectedFile preview modal to handle Android back key safely
  useEffect(() => {
    if (selectedFile) {
      const curState = window.history.state;
      if (!curState || curState.modalType !== 'file-details' || curState.fileId !== selectedFile.id) {
        window.history.pushState({ modalType: 'file-details', fileId: selectedFile.id }, '', '');
      }
    } else {
      if (window.history.state && window.history.state.modalType === 'file-details') {
        window.history.back();
      }
    }
  }, [selectedFile]);

  // Popstate event handler for closing the selectedFile modal when back navigation occurs
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (selectedFile && (!e.state || e.state.modalType !== 'file-details')) {
        setSelectedFile(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [selectedFile]);

  // Set webkitdirectory via setAttribute — React JSX does NOT pass unknown attrs to DOM
  // This makes the folder picker show a FOLDER chooser (not individual files) on Android
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
      folderInputRef.current.setAttribute('multiple', '');
    }
  }, []);
  
  // Fetch folders for move browser
  const fetchMoveFolders = async (folderId: string) => {
    setMoveBrowseLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/drive/files?folderId=${folderId}`, {
        credentials: 'include',
        headers: tokens ? { 'x-goog-tokens': JSON.stringify(tokens) } : {}
      });
      const data = await res.json();
      // API returns array directly (not wrapped in { files: [] })
      const list = Array.isArray(data) ? data : (data.files || []);
      const folders = list.filter((f: any) =>
        (f.type === 'folder' || f.mimeType === 'application/vnd.google-apps.folder') &&
        !selectedIds.has(f.id)
      );
      setMoveBrowseFolders(folders);
    } catch { setMoveBrowseFolders([]); }
    finally { setMoveBrowseLoading(false); }
  };


  // Reset browser when dialog opens
  useEffect(() => {
    if (isMoveDialogOpen) {
      setMoveBrowsePath([{id: "root", name: "My Drive"}]);
      fetchMoveFolders("root");
    }
  }, [isMoveDialogOpen]);

  const navigateMoveInto = (folder: FileItem) => {
    setMoveBrowsePath(prev => [...prev, {id: folder.id, name: folder.name}]);
    fetchMoveFolders(folder.id);
  };

  const navigateMoveBack = () => {
    if (moveBrowsePath.length <= 1) return;
    const newPath = moveBrowsePath.slice(0, -1);
    setMoveBrowsePath(newPath);
    fetchMoveFolders(newPath[newPath.length - 1].id);
  };

  // CLEAR MENU/SELECTION IF FILE DISAPPEARS (Deleted)
  useEffect(() => {
    if (actionMenuFile && !files.find(f => f.id === actionMenuFile.id)) {
      setActionMenuFile(null);
    }
    if (selectedFile && !files.find(f => f.id === selectedFile.id)) {
      setSelectedFile(null);
    }
    if (isSelectionMode) {
      const validSelectedIds = new Set([...selectedIds].filter(id => files.find(f => f.id === id)));
      if (validSelectedIds.size !== selectedIds.size) {
        setSelectedIds(validSelectedIds);
        if (validSelectedIds.size === 0) setIsSelectionMode(false);
      }
    }
  }, [files]);


  const filteredFiles = files
    .filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           f.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterType === 'all' || f.type === filterType;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      // 1. Standard Hierarchy: Folders always appear first (unless searching across all files)
      if (!searchQuery.trim()) {
        if (a.type === 'folder' && b.type !== 'folder') return -1;
        if (a.type !== 'folder' && b.type === 'folder') return 1;
      }

      // 2. Multi-Directional Standard Sort
      switch (sortBy) {
        case 'name_asc':
          return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        case 'name_desc':
          return b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: 'base' });
        case 'date_desc': {
          const cmp = b.timestamp - a.timestamp;
          return cmp !== 0 ? cmp : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        }
        case 'date_asc': {
          const cmp = a.timestamp - b.timestamp;
          return cmp !== 0 ? cmp : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        }
        case 'size_desc': {
          const cmp = b.sizeBytes - a.sizeBytes;
          return cmp !== 0 ? cmp : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        }
        case 'size_asc': {
          const cmp = a.sizeBytes - b.sizeBytes;
          return cmp !== 0 ? cmp : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        }
        case 'type': {
          const cmp = a.type.localeCompare(b.type);
          return cmp !== 0 ? cmp : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
        }
        default:
          return b.timestamp - a.timestamp;
      }
    });

  const toggleSelection = (file: FileItem) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(file.id)) next.delete(file.id);
      else next.add(file.id);
      
      const isEmpty = next.size === 0;
      if (isEmpty) setIsSelectionMode(false);
      else setIsSelectionMode(true);
      
      return next;
    });
  };

  const handlePressStart = (file: FileItem) => {
    if (!Capacitor.isNativePlatform()) return; // Disable long-press selection on Website (Mobile-only)
    isPressingRef.current = true;
    pressTimerRef.current = setTimeout(() => {
      if (isPressingRef.current) {
        // Vibrate if on mobile
        try { (window as any).navigator.vibrate?.(40); } catch(e){}
        toggleSelection(file);
      }
    }, 600); // 600ms for long press
  };

  const handlePressEnd = () => {
    isPressingRef.current = false;
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const handleItemClick = (file: FileItem) => {
    if (isSelectionMode) {
      toggleSelection(file);
      return;
    }
    if (file.type === 'folder') {
      onNavigate(file.id, file.name);
    } else {
      setSelectedFile(file);
    }
  };

  const cancelDownload = async (dlId: string, controller: AbortController) => {
    onCancelDownload(dlId);
  };

  const handleDownload = async (file: FileItem) => {
    if (!file || !tokens) return;
    
    let keepActive = false;
    
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
      // Get one-time ticket
      const ticketRes = await fetch(`${API_BASE_URL}/api/drive/download/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens }),
        signal: controller.signal,
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
        keepActive = true;
        try {
          const UploadNotification = Capacitor.registerPlugin<any>('UploadNotification');
          
          // Request POST_NOTIFICATIONS permission first to show progress in Android Status Bar!
          try {
            const permStatus = await UploadNotification.checkPermissions();
            if (permStatus.notifications !== 'granted') {
              await UploadNotification.requestPermissions();
            }
          } catch (e) {
            console.warn('Notification permission check/request failed:', e);
          }
          
          let progressListener: any;
          const startTime = Date.now();
          const totalSizeBytes = file.sizeBytes || 0;

          UploadNotification.addListener('onDownloadProgress', (data: any) => {
            if (data.id === dlId) {
              const now = Date.now();
              const elapsedSeconds = (now - startTime) / 1000;
              const progressPct = data.progress;
              const received = totalSizeBytes > 0 ? (progressPct / 100) * totalSizeBytes : 0;
              const speed = elapsedSeconds > 0 ? received / elapsedSeconds : 0;
              const remainingBytes = totalSizeBytes > 0 ? Math.max(0, totalSizeBytes - received) : 0;
              const remainingSeconds = speed > 0 ? remainingBytes / speed : 0;

              const formatBytesHelper = (bytes: number, decimals = 1) => {
                if (bytes === 0) return '0 B';
                const k = 1024;
                const dm = decimals < 0 ? 0 : decimals;
                const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
              };

              const speedText = speed > 1048576 ? `${(speed / 1048576).toFixed(1)} MB/s` : `${(speed / 1024).toFixed(0)} KB/s`;
              const etaText = remainingSeconds > 60 ? `${Math.floor(remainingSeconds/60)}m left` : `${Math.round(remainingSeconds)}s left`;
              const progressSizeText = totalSizeBytes > 0 ? `${formatBytesHelper(received)} / ${formatBytesHelper(totalSizeBytes)}` : formatBytesHelper(received);

              setActiveDownloads(prev => prev.map(d => d.id === dlId ? {
                ...d,
                progress: progressPct,
                speed: speedText,
                eta: etaText,
                sizeText: progressSizeText
              } : d));
            }
          }).then(l => progressListener = l);

          UploadNotification.downloadFileNatively({
            url: downloadUrl,
            filename: finalFilename,
            id: dlId,
            size: file.sizeBytes || 0
          }).then(() => {
            try {
              const hist = JSON.parse(localStorage.getItem('drive_vault_download_history') || '[]');
              const histEntry = {
                id: dlId,
                name: finalFilename,
                date: new Date().toISOString(),
                size: file.sizeBytes || 0,
                status: 'completed'
              };
              hist.unshift(histEntry);
              localStorage.setItem('drive_vault_download_history', JSON.stringify(hist.slice(0, 200)));
            } catch (e) {
              console.error('Failed to save download history:', e);
            }
            setActiveDownloads(prev => prev.filter(d => d.id !== dlId));
            if (progressListener) progressListener.remove();
            toast.success('Download Completed', { description: truncateFilename(finalFilename, 35) });
          }).catch((e: any) => {
            console.error('Native download failed asynchronously:', e);
            setActiveDownloads(prev => prev.filter(d => d.id !== dlId));
            if (progressListener) progressListener.remove();
            toast.error('Download Failed', { description: `${truncateFilename(finalFilename, 30)} • ${e.message || e}` });
          });

          toast.success('Download Started', { 
            description: `${truncateFilename(finalFilename, 35)} • Check notifications for progress!`,
            duration: 5000
          });
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

      // Stream with progress tracking
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
        const blob = new Blob(accumulatedChunks as any);
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
          const now = Date.now();
          const elapsedSeconds = (now - startTime) / 1000;
          const speed = elapsedSeconds > 0 ? received / elapsedSeconds : 0;
          const remainingBytes = total > 0 ? Math.max(0, total - received) : 0;
          const remainingSeconds = speed > 0 ? remainingBytes / speed : 0;
          
          const speedText = speed > 1048576 ? `${(speed / 1048576).toFixed(1)} MB/s` : `${(speed / 1024).toFixed(0)} KB/s`;
          const etaText = remainingSeconds > 60 ? `${Math.floor(remainingSeconds/60)}m left` : `${Math.round(remainingSeconds)}s left`;
          const progressSizeText = total > 0 ? `${formatBytes(received)} / ${formatBytes(total)}` : formatBytes(received);

          setActiveDownloads(prev => prev.map(d => d.id === dlId ? {
            ...d,
            progress: pct,
            speed: speedText,
            eta: etaText,
            sizeText: progressSizeText
          } : d));

          if (isNative) {
            // Update custom notification with app logo, progress speed, growing size/total size, and bacha hua time
            if (now - lastNotificationTime > 800) {
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
          toast.success('Saved to App Private folder', { description: truncateFilename(finalFilename, 35), duration: 6000 });
        } else {
          toast.success('Saved to Downloads', { description: truncateFilename(finalFilename, 35) });
        }
      } else {
        setActiveDownloads(prev => prev.map(d => d.id === dlId ? { ...d, progress: 100 } : d));
        const blob = new Blob(webChunks as any);
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl; a.download = finalFilename; a.click();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        toast.success('Downloaded successfully', { description: truncateFilename(finalFilename, 35) });
      }

      try {
        const hist = JSON.parse(localStorage.getItem('drive_vault_download_history') || '[]');
        const histEntry = {
          id: dlId,
          name: finalFilename,
          date: new Date().toISOString(),
          size: file.sizeBytes || 0,
          status: 'completed'
        };
        hist.unshift(histEntry);
        localStorage.setItem('drive_vault_download_history', JSON.stringify(hist.slice(0, 200)));
      } catch (e) {
        console.error('Failed to save download history:', e);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.info('Download cancelled', { description: truncateFilename(file.name, 35) });
      } else {
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
      if (!keepActive) {
        setTimeout(() => setActiveDownloads(prev => prev.filter(d => d.id !== dlId)), 1200);
      }
    }
  };

  // Copy share link to clipboard
  const handleCopyShareLink = (file: FileItem) => {
    const link = file.webViewLink ||
      (file.type === 'folder'
        ? `https://drive.google.com/drive/folders/${file.id}?usp=sharing`
        : `https://drive.google.com/file/d/${file.id}/view?usp=sharing`);
    navigator.clipboard.writeText(link).then(() => {
      toast.success('🔗 Link copied! Anyone with the link can view in Google Drive.');
    }).catch(() => toast.error('Failed to copy link'));
  };



  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      Array.from(selectedFiles).forEach((file: any) => {
        // Pass relativePath for folder uploads, undefined for single files
        onUpload(file, file.webkitRelativePath || undefined);
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (folderInputRef.current) folderInputRef.current.value = '';
    }
    setShowUploadSheet(false);
  };

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setIsNewFolderOpen(false);
    }
  };

  const handleRename = () => {
    if (renameValue.trim() && renameFile) {
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

  const handleBulkDelete = () => {
    selectedIds.forEach(id => onDelete(id));
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleBulkMove = (targetFolderId: string) => {
    // Call onMove with all selected IDs and the target folder
    onMove(Array.from(selectedIds) as any, targetFolderId);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    setIsMoveDialogOpen(false);
  };

  const handleBulkDownload = async () => {
    const filesToDownload = filteredFiles.filter(f => selectedIds.has(f.id));
    if (filesToDownload.length === 0) return;

    toast.info(`Starting download for ${filesToDownload.length} items...`);
    setIsSelectionMode(false);
    setSelectedIds(new Set());

    for (let i = 0; i < filesToDownload.length; i++) {
      const f = filesToDownload[i];
      handleDownload(f);
      if (i < filesToDownload.length - 1) {
        await new Promise(r => setTimeout(r, 600));
      }
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredFiles.length) {
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedIds(new Set(filteredFiles.map(f => f.id)));
      setIsSelectionMode(true);
    }
  };



  const renderItem = (file: FileItem, idx: number) => {
    const Icon = iconMap[file.type] || FileIcon;
    const theme = categoryThemeMap[file.type] || categoryThemeMap.other;
    
    if (view === 'grid') {
      return (
        <motion.div
          key={file.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, delay: Math.min(idx, 8) * 0.015 }}
          onClick={() => handleItemClick(file)}
          onPointerDown={() => handlePressStart(file)}
          onPointerUp={handlePressEnd}
          onPointerLeave={handlePressEnd}
          onPointerCancel={handlePressEnd}
          onContextMenu={(e) => e.preventDefault()}
          className={`p-3.5 rounded-2xl space-y-3 group cursor-pointer relative transition-all duration-200 select-none border ${
            selectedIds.has(file.id) 
              ? 'bg-blue-50/70 dark:bg-blue-500/10 border-blue-500 shadow-md shadow-blue-500/10 scale-[0.98]' 
              : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-700/60 shadow-sm hover:shadow-md'
          }`}
        >
          {selectedIds.has(file.id) && (
            <div className="absolute top-2 right-2 w-6 h-6 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-full flex items-center justify-center text-white z-10 shadow-lg shadow-blue-500/30 scale-110">
              <Check size={14} strokeWidth={3} />
            </div>
          )}
          {file.starred && (
            <div className="absolute top-2 left-2 text-amber-400 z-10">
              <Star size={14} fill="currentColor" />
            </div>
          )}
          <div className={`aspect-square rounded-xl flex items-center justify-center overflow-hidden ${file.thumbnail && file.type !== 'folder' ? 'bg-black/5 dark:bg-black/20' : theme.bgColor}`}>
            {file.thumbnail && file.type !== 'folder' ? (
              <img src={file.thumbnail} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" alt={file.name} referrerPolicy="no-referrer" />
            ) : (
              <Icon size={file.type === 'folder' ? 44 : 32} className={`${theme.textColor} transition-transform duration-300 group-hover:scale-110`} />
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-xs sm:text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {file.name}
            </h4>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
              {file.type === 'folder' ? 'Folder' : file.size}
            </p>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        key={file.id}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18, delay: Math.min(idx, 8) * 0.015 }}
        onClick={() => handleItemClick(file)}
        onPointerDown={() => handlePressStart(file)}
        onPointerUp={handlePressEnd}
        onPointerLeave={handlePressEnd}
        onPointerCancel={handlePressEnd}
        onContextMenu={(e) => e.preventDefault()}
        className={`flex items-center gap-3.5 p-3 rounded-2xl border transition-all duration-200 cursor-pointer group relative select-none ${
          selectedIds.has(file.id) 
            ? 'bg-blue-50/70 dark:bg-blue-500/10 border-blue-500/50 shadow-sm' 
            : 'bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-100 dark:border-slate-700/60 hover:border-slate-200 dark:hover:border-slate-600 shadow-sm'
        }`}
      >
        {isSelectionMode && (
          <div className="shrink-0 transition-all duration-200">
            {selectedIds.has(file.id) ? (
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-blue-500/30 scale-110">
                <Check size={12} strokeWidth={3} />
              </div>
            ) : (
              <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-700 bg-transparent" />
            )}
          </div>
        )}
        <div className={`w-11 h-11 rounded-2xl ${theme.bgColor} flex items-center justify-center ${theme.textColor} transition-transform group-hover:scale-105 shrink-0`}>
          <Icon size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-slate-800 dark:text-slate-200 truncate text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {file.name}
            </h4>
            {file.starred && <Star size={13} className="text-amber-400 fill-amber-400 shrink-0" />}
          </div>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">
            {file.type === 'folder' ? 'Folder' : file.size} {file.date ? `• ${file.date}` : ''}
          </p>
        </div>
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setActionMenuFile(file);
          }}
          className="text-slate-300 dark:text-slate-600 hover:text-blue-500 transition-colors p-2 -mr-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50"
        >
          <MoreVertical size={18} />
        </button>
      </motion.div>
    );
  };

  return (
    <div className="flex-1 p-4 pb-6 md:pb-8 md:p-10 space-y-6 md:space-y-10 max-w-7xl mx-auto w-full transition-colors">
      <header className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-none">Files</h1>
            {activeSubTab === 'all' && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 max-w-[280px] sm:max-w-xl">
                {breadcrumb.map((b, i) => (
                  <React.Fragment key={b.id}>
                    {i > 0 && <ChevronRight size={13} className="text-slate-400 shrink-0" />}
                    <button 
                      onClick={() => onNavigate(b.id, b.name)}
                      className={`text-xs px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                        i === breadcrumb.length - 1 
                          ? 'bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 font-bold shadow-xs' 
                          : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      {i === 0 && <Folder size={12} className="shrink-0" />}
                      <span>{b.name}</span>
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {/* Hidden file inputs */}
            <input type="file" ref={fileInputRef} className="hidden" multiple accept="*/*" onChange={handleFileChange} />
            <input type="file" ref={folderInputRef} className="hidden" webkitdirectory="" directory="" multiple onChange={handleFileChange} />
            <input type="file" ref={zipInputRef} className="hidden" accept=".zip,.rar,.7z,.tar,.gz,application/zip,application/x-zip-compressed" multiple onChange={handleFileChange} />
          </div>
        </div>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input 
              placeholder="Search files..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 sm:h-11 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-xl shadow-xs focus-visible:ring-2 focus-visible:ring-blue-500 text-slate-900 dark:text-white text-sm transition-all"
            />
          </div>
          {/* ── Live Transfers Manager Button (matches Android) ── */}
          <button
            onClick={onTransfersClick}
            className="relative w-10 h-10 sm:w-11 sm:h-11 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-blue-600 active:scale-95 transition-all shadow-xs shrink-0 cursor-pointer"
            title="Transfers & History"
          >
            <ArrowUpDown size={18} className={activeTransfersCount > 0 ? "text-blue-600 dark:text-blue-400 animate-pulse" : "text-slate-700 dark:text-slate-300"} />
            {activeTransfersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-md shadow-blue-500/30">
                {activeTransfersCount > 9 ? '9+' : activeTransfersCount}
              </span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger 
              className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all shrink-0 shadow-xs cursor-pointer ${
                sortBy !== 'date_desc' 
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50' 
                  : 'bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
              title="Sort Options"
            >
              <ArrowUpDown size={18} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-xl rounded-2xl p-1.5 min-w-[215px]">
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Sort Hierarchy
              </div>
              <div className="px-3 py-1.5 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-1.5 mb-1 bg-slate-50 dark:bg-slate-800/70 rounded-xl font-medium">
                <Folder size={13} className="text-yellow-500 shrink-0" />
                <span>Folders always on top</span>
              </div>
              <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Order By
              </div>
              <DropdownMenuItem 
                onClick={() => setSortBy('date_desc')} 
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  sortBy === 'date_desc' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>Date modified (Newest)</span>
                {sortBy === 'date_desc' && <Check size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setSortBy('date_asc')} 
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  sortBy === 'date_asc' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>Date modified (Oldest)</span>
                {sortBy === 'date_asc' && <Check size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setSortBy('name_asc')} 
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  sortBy === 'name_asc' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>Name (A to Z)</span>
                {sortBy === 'name_asc' && <Check size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setSortBy('name_desc')} 
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  sortBy === 'name_desc' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>Name (Z to A)</span>
                {sortBy === 'name_desc' && <Check size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setSortBy('size_desc')} 
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  sortBy === 'size_desc' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>Size (Largest first)</span>
                {sortBy === 'size_desc' && <Check size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setSortBy('size_asc')} 
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  sortBy === 'size_asc' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>Size (Smallest first)</span>
                {sortBy === 'size_asc' && <Check size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => setSortBy('type')} 
                className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                  sortBy === 'type' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>Type (Category)</span>
                {sortBy === 'type' && <Check size={14} className="text-blue-600 dark:text-blue-400 shrink-0" />}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button 
            onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
            className="w-10 h-10 sm:w-11 sm:h-11 bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95 transition-all shadow-xs shrink-0 cursor-pointer"
            title={view === 'grid' ? 'List View' : 'Grid View'}
          >
            {view === 'grid' ? <ListIcon size={18} /> : <Grid size={18} />}
          </button>
          <button 
            onClick={() => {
              if (isSelectionMode) {
                setSelectedIds(new Set());
                setIsSelectionMode(false);
              } else {
                setIsSelectionMode(true);
              }
            }}
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 shadow-xs ${
              isSelectionMode 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                : 'bg-white dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 active:scale-95'
            }`}
            title={isSelectionMode ? "Cancel Selection" : "Select Files"}
          >
            <CheckSquare size={18} />
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['all', 'image', 'video', 'document', 'audio', 'folder', 'archive'].map((type) => (
            <button
              key={type}
              onClick={() => onFilterChange(filterType === type ? 'all' : type)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer shadow-2xs
                ${filterType === type 
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25' 
                  : 'bg-white dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
            >
              {type === 'all' ? 'All' : type}
            </button>
          ))}
        </div>
      </header>

      <Tabs value={activeSubTab} onValueChange={onTabChange} className="w-full">
        <TabsList className="bg-transparent p-0 h-auto gap-6 border-b border-slate-100 dark:border-slate-800 w-full justify-start rounded-none">
          {['all', 'recent', 'starred', 'shared'].map((tab) => (
            <TabsTrigger 
              key={tab}
              value={tab}
              className="px-0 py-2 bg-transparent border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:bg-transparent rounded-none capitalize font-medium text-slate-400 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 transition-all"
            >
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Top indeterminate progress bar when switching categories or folders */}
      {isFilesLoading && (
        <div className="w-full h-1 bg-blue-100/60 dark:bg-blue-950/40 rounded-full overflow-hidden relative">
          <motion.div
            className="h-full bg-blue-600 dark:bg-blue-500 rounded-full w-1/3"
            initial={{ x: '-100%' }}
            animate={{ x: '350%' }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
          />
        </div>
      )}

      {filteredFiles.length === 0 ? (
        isFilesLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-center px-4 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Loader2 size={32} className="animate-spin text-blue-600 dark:text-blue-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Loading {filterType !== 'all' ? `${filterType} files...` : 'files...'}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
                Fetching your Drive Vault files securely...
              </p>
            </div>
          </div>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-center px-4 space-y-4">
            <div className="w-20 h-20 rounded-3xl bg-blue-500/10 dark:bg-blue-500/15 flex items-center justify-center text-blue-500">
              <Folder size={40} className="stroke-[1.5]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                {searchQuery ? 'No matching files found' : 'This folder is empty'}
              </h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
                {searchQuery ? `No files matching "${searchQuery}" in this folder.` : 'Upload files, import archives, or create folders to get started.'}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={() => setShowUploadSheet(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all cursor-pointer"
              >
                <Plus size={16} />
                Upload to this folder
              </button>
            )}
          </div>
        )
      ) : (
        <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4' : 'space-y-1.5'}>
          {filteredFiles.map((file, idx) => renderItem(file, idx))}
        </div>
      )}

      <FileDetails 
        file={selectedFile}
        isOpen={!!selectedFile}
        tokens={tokens}
        onClose={() => setSelectedFile(null)}
        onDelete={onDelete}
        onShare={onShare}
        onDownload={handleDownload}
      />

      {/* ── BULK SELECT ACTION BAR ── */}
      {isSelectionMode && selectedIds.size > 0 && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-[60] bg-slate-900 dark:bg-slate-800 border-t border-slate-700 pb-safe"
        >
          <div className="flex items-center justify-between px-4 py-3 max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}
                className="w-8 h-8 rounded-full bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white"
              >
                <X size={16} />
              </button>
              <span className="text-white font-semibold text-sm">{selectedIds.size} selected</span>
              <button
                onClick={handleSelectAll}
                className="text-xs font-semibold text-blue-400 hover:text-blue-300 underline ml-1 cursor-pointer"
              >
                {selectedIds.size === filteredFiles.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleBulkDownload}
                className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold active:scale-95 transition-all shadow-md shadow-emerald-600/20"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Download</span>
              </button>
              <button
                onClick={() => { setIsMoveDialogOpen(true); }}
                className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold active:scale-95 transition-all"
              >
                <Move size={16} />
                <span className="hidden sm:inline">Move</span>
              </button>
              <button
                onClick={() => { handleBulkDelete(); }}
                className="flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold active:scale-95 transition-all"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">Delete</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── FAB: Google Drive style single + button ── */}
      <div className="fixed bottom-24 right-4 z-50">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowUploadSheet(true)}
          className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-blue-500/40"
        >
          <Plus size={30} />
        </motion.button>
      </div>

      {/* ── GOOGLE DRIVE STYLE UPLOAD BOTTOM SHEET ── */}
      {showUploadSheet && (
        <div
          className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
          onClick={() => setShowUploadSheet(false)}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 38 }}
            onClick={e => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-[#1e1e1e] rounded-t-3xl shadow-2xl"
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-2" />

            {/* Title */}
            <div className="px-5 pb-2 pt-1 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">New</p>
              <button
                onClick={() => setShowUploadSheet(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"
              >
                <X size={16} />
              </button>
            </div>

            {/* Options grid — Google Drive style */}
            <div className="px-4 pb-8 grid grid-cols-4 gap-2">
              {/* New Folder */}
              <button
                onClick={() => { setShowUploadSheet(false); setIsNewFolderOpen(true); }}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl active:bg-slate-100 dark:active:bg-slate-800 transition-all"
              >
                <div className="w-14 h-14 rounded-2xl bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center text-yellow-600 shadow-sm">
                  <Folder size={28} />
                </div>
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 text-center leading-tight">New<br/>Folder</span>
              </button>

              {/* Upload Photos & Files */}
              <button
                onClick={() => {
                  if (Capacitor.isNativePlatform() && onNativeUpload) {
                    onNativeUpload();
                  } else {
                    fileInputRef.current?.click();
                  }
                  setShowUploadSheet(false);
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl active:bg-slate-100 dark:active:bg-slate-800 transition-all"
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 shadow-sm">
                  <Plus size={28} />
                </div>
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 text-center leading-tight">Files, Photos,<br/>Videos, Zip</span>
              </button>

              {/* Upload Folder */}
              <button
                onClick={() => {
                  if (Capacitor.isNativePlatform()) {
                    toast.info("ℹ️ Android limitation: Folder selection is not natively supported by WebViews. Please use 'Photos & Files' to select and upload multiple files!", { duration: 6000 });
                  } else {
                    folderInputRef.current?.click();
                  }
                  setShowUploadSheet(false);
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl active:bg-slate-100 dark:active:bg-slate-800 transition-all"
              >
                <div className="w-14 h-14 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600 shadow-sm">
                  <Archive size={28} />
                </div>
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 text-center leading-tight">Upload<br/>Folder</span>
              </button>

              {/* Camera */}
              <button
                onClick={() => {
                  const i = document.createElement('input');
                  i.type = 'file'; i.accept = 'image/*';
                  (i as any).capture = 'environment';
                  i.onchange = (e: any) => handleFileChange(e);
                  i.click();
                  setShowUploadSheet(false);
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl active:bg-slate-100 dark:active:bg-slate-800 transition-all"
              >
                <div className="w-14 h-14 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-500 shadow-sm">
                  <Camera size={28} />
                </div>
                <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 text-center leading-tight">Camera</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── MOVE BROWSER — Google Drive bottom sheet style ── */}
      {isMoveDialogOpen && (
        <div
          className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex flex-col justify-end"
          onClick={() => setIsMoveDialogOpen(false)}
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-[#1e1e1e] rounded-t-3xl flex flex-col max-h-[85vh] shadow-2xl"
          >
            {/* Handle */}
            <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mt-3 mb-1 shrink-0" />

            {/* Header */}
            <div className="px-4 pt-2 pb-3 flex items-center gap-3 shrink-0 border-b border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setIsMoveDialogOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0"
              >
                <X size={18} />
              </button>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Move to</h2>
                {/* Breadcrumb */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar mt-0.5">
                  {moveBrowsePath.map((crumb, i) => (
                    <React.Fragment key={crumb.id}>
                      {i > 0 && <ChevronRight size={12} className="text-slate-300 shrink-0" />}
                      <button
                        onClick={() => {
                          const newPath = moveBrowsePath.slice(0, i + 1);
                          setMoveBrowsePath(newPath);
                          fetchMoveFolders(crumb.id);
                        }}
                        className={`text-xs whitespace-nowrap font-semibold ${
                          i === moveBrowsePath.length - 1
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        {crumb.name}
                      </button>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            {/* Folder list */}
            <div className="flex-1 overflow-y-auto">
              {moveBrowsePath.length > 1 && (
                <button
                  onClick={navigateMoveBack}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 shrink-0">
                    <ChevronRight size={20} className="rotate-180" />
                  </div>
                  <span className="font-medium text-slate-500 dark:text-slate-400 text-sm">Back</span>
                </button>
              )}

              {moveBrowseLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : moveBrowseFolders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-slate-400 gap-3">
                  <Folder size={48} className="opacity-20" />
                  <p className="text-sm font-semibold">No subfolders here</p>
                  <p className="text-xs text-slate-300 text-center px-8">Tap "Move here" to move to this location</p>
                </div>
              ) : (
                moveBrowseFolders.map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => navigateMoveInto(folder)}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 active:bg-slate-100 transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center text-yellow-500 shrink-0">
                      <Folder size={22} />
                    </div>
                    <span className="flex-1 font-medium text-slate-800 dark:text-white truncate text-sm">{folder.name}</span>
                    <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 shrink-0" />
                  </button>
                ))
              )}
            </div>

            {/* Move Here button — fixed at bottom */}
            <div className="px-4 py-4 pb-8 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-[#1e1e1e]">
              <button
                onClick={() => {
                  const target = moveBrowsePath[moveBrowsePath.length - 1];
                  handleBulkMove(target.id);
                  setIsMoveDialogOpen(false);
                }}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-blue-500/20"
              >
                <Move size={18} />
                Move here — <span className="truncate max-w-[120px]">{moveBrowsePath[moveBrowsePath.length - 1].name}</span>
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* New Folder Dialog */}
      <Dialog open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-800 border-none rounded-3xl px-6 pb-6">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-3">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="h-12 bg-slate-100 dark:bg-slate-700 border-2 border-blue-500 rounded-xl text-sm text-slate-900 dark:text-white focus-visible:ring-0 placeholder:text-slate-400"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Button
              onClick={handleCreateFolder}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold"
            >
              Create
            </Button>
            <Button
              variant="ghost"
              onClick={() => { setIsNewFolderOpen(false); setNewFolderName(""); }}
              className="w-full h-11 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold border border-slate-200 dark:border-slate-600"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── DOWNLOAD PROGRESS OVERLAY (fixed top) ── */}
      {activeDownloads.filter(d => !d.isHidden).length > 0 && (
        <div className="fixed top-0 left-0 right-0 z-[999] space-y-1 p-3 pointer-events-none">
          {activeDownloads.filter(d => !d.isHidden).map(dl => (
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
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setActiveDownloads(prev => prev.map(d => d.id === dl.id ? { ...d, isHidden: true } : d))}
                  className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300 hover:text-white transition-all shrink-0 pointer-events-auto"
                  title="Minimize to Background"
                >
                  <Minus size={14} />
                </button>
                <button
                  onClick={() => cancelDownload(dl.id, dl.controller)}
                  className="w-7 h-7 rounded-lg bg-slate-700 hover:bg-red-500/80 flex items-center justify-center text-slate-400 hover:text-white transition-all shrink-0 pointer-events-auto"
                  title="Cancel Download"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
        onOpen={handleItemClick}
        onDownload={handleDownload}
        onRename={openRenameDialog}
        onMove={(f) => {
          setSelectedIds(new Set([f.id]));
          setIsMoveDialogOpen(true);
        }}
        onStar={onStar}
        onShare={onShare}
        onShowInfo={onShowInfo}
        onHide={onHide}
        onDelete={onDelete}
        onSelect={(f) => {
          setIsSelectionMode(true);
          setSelectedIds(new Set([f.id]));
        }}
      />
    </div>
  );
}

