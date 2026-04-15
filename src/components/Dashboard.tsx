import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Image, FileText, Video, Music, MoreHorizontal, Plus, Folder, Archive, RefreshCw, Camera, ExternalLink, Edit2, Share2, Trash2, Star, EyeOff, Move, Download, Cloud, Package, ChevronRight, Info, X } from 'lucide-react';

import { StorageStats, FileItem } from '@/src/types';
import { motion } from 'motion/react';
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://g-drive-vault.vercel.app';



interface DashboardProps {
  user: any;
  tokens: any;
  files: FileItem[];
  storageInfo: any;
  storageBreakdown?: any;
  onUpload: (file: File, relativePath?: string, targetFolderId?: string) => void;
  setActiveTab: (tab: string) => void;
  onRefreshStorage?: () => void;
  onCategoryClick?: (type: string) => void;
  onCreateFolder?: (name: string) => void;
  onRename?: (id: string, name: string) => void;
  onDelete?: (id: string) => void;
  onShare?: (id: string) => void;
  onHide?: (id: string) => void;
  onMove?: (id: string, newParentId?: string) => void;
  onStar?: (id: string, starred: boolean) => void;
  onNavigateToFiles?: () => void;
  isDownloadEnabled?: boolean;
}

export default function Dashboard({ user, tokens, files, storageInfo, storageBreakdown, onUpload, setActiveTab, onRefreshStorage, onCategoryClick, onCreateFolder, onRename, onDelete, onShare, onHide, onMove, onStar, onNavigateToFiles, isDownloadEnabled }: DashboardProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
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
      if (selectedFile) { e.preventDefault(); setSelectedFile(null); return; }
      if (actionMenuFile) { e.preventDefault(); setActionMenuFile(null); return; }
      if (isNewFolderOpen) { e.preventDefault(); setIsNewFolderOpen(false); return; }
      if (isRenameOpen) { e.preventDefault(); setIsRenameOpen(false); return; }
      if (showStorageDetails) { e.preventDefault(); setShowStorageDetails(false); return; }
    };

    window.addEventListener('vault-back', handleVaultBack);
    return () => window.removeEventListener('vault-back', handleVaultBack);
  }, [selectedFile, isNewFolderOpen, isRenameOpen, showStorageDetails]);

  // Set webkitdirectory via setAttribute — required for Android WebView folder picker
  useEffect(() => {
    if (dashFolderInputRef.current) {
      dashFolderInputRef.current.setAttribute('webkitdirectory', '');
      dashFolderInputRef.current.setAttribute('directory', '');
      dashFolderInputRef.current.setAttribute('multiple', '');
    }
  }, []);

  const handleRefresh = async () => {
    if (onRefreshStorage) {
      setIsRefreshing(true);
      await onRefreshStorage();
      setTimeout(() => setIsRefreshing(false), 1000);
      toast.success('Storage information updated');
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
      onCreateFolder(newFolderName.trim());
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

  const stats: StorageStats = {
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

      const res = await fetch(`${API_BASE_URL}/api/drive/download/${file.id}?ticket=${ticketId}`, { signal: controller.signal });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `Download failed (${res.status})`);
      }

      if (!res.body) throw new Error('Download stream is unavailable');

      // Request permissions on native platform
      if (Capacitor.isNativePlatform()) {
        const status = await Filesystem.requestPermissions();
        if (status.publicStorage !== 'granted') {
          throw new Error('Permission to write to Downloads was denied.');
        }
      }

      const contentLength = res.headers.get('Content-Length');
      const total = contentLength ? parseInt(contentLength) : 0;
      const reader = res.body!.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value); received += value.length;
          const pct = total > 0 ? Math.min(99, Math.round((received / total) * 100)) : -1;
          setActiveDownloads(prev => prev.map(d => d.id === dlId ? { ...d, progress: pct } : d));
        }
      }
      setActiveDownloads(prev => prev.map(d => d.id === dlId ? { ...d, progress: 100 } : d));
      const blob = new Blob(chunks);

      if (Capacitor.isNativePlatform()) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader(); fr.onloadend = () => resolve((fr.result as string).split(',')[1]); fr.onerror = reject; fr.readAsDataURL(blob);
        });
        await Filesystem.writeFile({ path: 'Download/' + finalFilename, data: base64, directory: Directory.ExternalStorage, recursive: true });
        toast.success(`✅ Saved to Downloads: ${finalFilename}`);
      } else {
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
      if (onNavigateToFiles) onNavigateToFiles();
    } else {
      setSelectedFile(file);
    }
  };

  const iconMap = {
    image: Image,
    video: Video,
    document: FileText,
    audio: Music,
    apk: Package,
    folder: Folder,
    archive: Archive,
    other: MoreHorizontal,
  };

  return (
    <div className="flex-1 p-4 md:p-10 space-y-6 md:space-y-10 max-w-7xl mx-auto w-full">
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
      </header>

      <Card 
        onClick={() => setShowStorageDetails(true)}
        className="border-none shadow-sm bg-slate-50 dark:bg-slate-800/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group"
      >
        <CardContent className="p-6 space-y-4">
          <div className="flex justify-between items-end">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Storage Used</p>
                <ChevronRight size={14} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
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

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 lg:gap-6">
        {stats.categories.map((cat, idx) => {
          const Icon = iconMap[cat.type];
          return (
            <motion.div
              key={cat.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              onClick={() => onCategoryClick ? onCategoryClick(cat.type) : setActiveTab('files')}
            >
              <Card className="border-none shadow-sm hover:shadow-md transition-shadow cursor-pointer group bg-white dark:bg-slate-800">
                <CardContent className="p-4 space-y-3">
                  <div className={`w-10 h-10 ${cat.color} bg-opacity-10 rounded-xl flex items-center justify-center text-${cat.color.split('-')[1]}-600 dark:text-${cat.color.split('-')[1]}-400 group-hover:scale-110 transition-transform`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">{cat.name}</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {cat.count} {cat.type === 'folder' ? (cat.count === 1 ? 'folder' : 'folders') : 'files'} • {cat.size === '--' ? 'Directory' : cat.size}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Files</h2>
          <button className="text-sm font-medium text-blue-600 dark:text-blue-400">View All</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {files.slice(0, 6).map((file, idx) => {
            const Icon = iconMap[file.type] || FileText;
            return (
              <div 
                key={idx} 
                onClick={() => handleOpenFile(file)}
                className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-50 dark:border-slate-800/50 hover:shadow-lg hover:border-blue-100 dark:hover:border-blue-900/30 transition-all cursor-pointer group"
              >
                <div className={`w-12 h-12 rounded-xl bg-slate-50 dark:bg-slate-900/50 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors`}>
                  <Icon size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-slate-800 dark:text-slate-200 truncate pr-2">{file.name}</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{file.type === 'folder' ? 'Folder' : file.size} • {file.date}</p>
                </div>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActionMenuFile(file);
                  }}
                  className="text-slate-300 dark:text-slate-600 hover:text-blue-500 transition-colors p-2"
                >
                  <MoreHorizontal size={20} />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Hidden inputs */}
      <input type="file" ref={fileInputRef} className="hidden" multiple accept="*/*" onChange={handleFileChange} />
      <input type="file" ref={dashFolderInputRef} className="hidden" webkitdirectory="" directory="" onChange={handleFileChange} />

      {/* ── FAB: New Folder + Upload ── */}
      <div className="fixed bottom-24 right-4 md:bottom-10 md:right-10 z-50 flex flex-col items-end gap-3">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setIsNewFolderOpen(true)}
          className="w-12 h-12 bg-slate-800 dark:bg-slate-700 rounded-2xl flex items-center justify-center text-white shadow-xl"
        >
          <Folder size={22} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setShowDashUploadSheet(true)}
          className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-blue-500/40"
        >
          <Plus size={32} />
        </motion.button>
      </div>

      {/* ── DASHBOARD UPLOAD BOTTOM SHEET ── */}
      {showDashUploadSheet && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm" onClick={() => setShowDashUploadSheet(false)}>
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 35 }}
            onClick={e => e.stopPropagation()}
            className="absolute bottom-0 left-0 right-0 bg-white dark:bg-slate-900 rounded-t-3xl p-6 pb-10 shadow-2xl"
          >
            <div className="w-10 h-1 bg-slate-200 dark:bg-slate-700 rounded-full mx-auto mb-5" />
            <h3 className="text-base font-bold text-slate-800 dark:text-white mb-1">Upload to My Drive</h3>
            <p className="text-xs text-slate-400 mb-5">All files go to My Drive root</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <button onClick={() => { const i = document.createElement("input"); i.type="file"; i.accept="image/*"; (i as any).capture="environment"; i.onchange=(e:any)=>handleFileChange(e); i.click(); }}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 active:scale-95 transition-all">
                <div className="w-10 h-10 bg-red-500 rounded-xl flex items-center justify-center text-white"><Camera size={20} /></div>
                <span className="text-xs font-bold text-red-700 dark:text-red-300">Camera</span>
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/20 active:scale-95 transition-all">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white"><Plus size={20} /></div>
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300">Files</span>
              </button>
              <button onClick={() => dashFolderInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-yellow-50 dark:bg-yellow-900/20 active:scale-95 transition-all">
                <div className="w-10 h-10 bg-yellow-500 rounded-xl flex items-center justify-center text-white"><Folder size={20} /></div>
                <span className="text-xs font-bold text-yellow-700 dark:text-yellow-300">Folder</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { const i = document.createElement("input"); i.type="file"; i.accept="image/*,video/*"; i.multiple=true; i.onchange=(e:any)=>handleFileChange(e); i.click(); }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-orange-50 dark:bg-orange-900/20 active:scale-95 transition-all">
                <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center text-white shrink-0"><Image size={18} /></div>
                <div><p className="text-xs font-bold text-orange-700 dark:text-orange-300">Images & Videos</p><p className="text-[9px] text-slate-400">Photos, clips</p></div>
              </button>
              <button onClick={() => { const i = document.createElement("input"); i.type="file"; i.accept=".zip,.rar,.7z,.tar,.gz"; i.multiple=true; i.onchange=(e:any)=>handleFileChange(e); i.click(); }}
                className="flex items-center gap-3 p-4 rounded-2xl bg-purple-50 dark:bg-purple-900/20 active:scale-95 transition-all">
                <div className="w-9 h-9 bg-purple-500 rounded-xl flex items-center justify-center text-white shrink-0"><Archive size={18} /></div>
                <div><p className="text-xs font-bold text-purple-700 dark:text-purple-300">Archives</p><p className="text-[9px] text-slate-400">ZIP, RAR, 7Z</p></div>
              </button>
            </div>
          </motion.div>
        </div>
      )}

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


      {/* Action Menu Dialog */}
      <Dialog open={!!actionMenuFile} onOpenChange={(open) => !open && setActionMenuFile(null)}>
        <DialogContent className="w-[90vw] sm:max-w-sm bg-white dark:bg-slate-900 border-none rounded-3xl p-6 overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold dark:text-white truncate pr-8">
              {actionMenuFile?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-1">
            <button
              onClick={() => {
                if (actionMenuFile) handleOpenFile(actionMenuFile);
                setActionMenuFile(null);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                <ExternalLink size={20} />
              </div>
              <span className="font-medium dark:text-white">Open</span>
            </button>

            <button
              onClick={() => {
                if (actionMenuFile) openRenameDialog(actionMenuFile);
                setActionMenuFile(null);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600">
                <Edit2 size={20} />
              </div>
              <span className="font-medium dark:text-white">Rename</span>
            </button>

            <button
              onClick={() => {
                if (actionMenuFile) handleCopyShareLink(actionMenuFile);
                setActionMenuFile(null);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600">
                <Share2 size={20} />
              </div>
              <div>
                <span className="font-medium dark:text-white block">Share</span>
                <span className="text-[10px] text-slate-400">Copy viewer link</span>
              </div>
            </button>


            <button
              onClick={() => {
                if (actionMenuFile && onHide) onHide(actionMenuFile.id);
                setActionMenuFile(null);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400">
                <EyeOff size={20} />
              </div>
              <span className="font-medium dark:text-white">Hide</span>
            </button>

            <button
              onClick={() => {
                if (actionMenuFile) handleDownload(actionMenuFile);
                setActionMenuFile(null);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                <Download size={20} />
              </div>
              <span className="font-medium dark:text-white">Download</span>
            </button>

            <button
              onClick={() => {
                if (actionMenuFile && onMove) onMove(actionMenuFile.id);
                setActionMenuFile(null);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center text-orange-600">
                <Move size={20} />
              </div>
              <span className="font-medium dark:text-white">Move</span>
            </button>

            <div className="h-px bg-slate-100 dark:bg-slate-800 my-2" />

            <button
              onClick={() => {
                if (actionMenuFile && onDelete) onDelete(actionMenuFile.id);
                setActionMenuFile(null);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 group-hover:bg-red-200 dark:group-hover:bg-red-900/60 transition-colors">
                <Trash2 size={20} />
              </div>
              <span className="font-medium text-red-600 dark:text-red-400">Delete</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <FileDetails 
        file={selectedFile}
        isOpen={!!selectedFile}
        tokens={tokens}
        onClose={() => setSelectedFile(null)}
        onDelete={onDelete || (() => {})}
        onShare={onShare}
      />
    </div>
  );
}

