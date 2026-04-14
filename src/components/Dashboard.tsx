import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Image, FileText, Video, Music, MoreHorizontal, Plus, Folder, Archive, RefreshCw, Camera, ExternalLink, Edit2, Share2, Trash2, Star, EyeOff, Move, Download, Cloud, Package, ChevronRight, Info } from 'lucide-react';
import { StorageStats, FileItem } from '@/src/types';
import { motion } from 'motion/react';
import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { formatBytes } from '../utils';

interface DashboardProps {
  user: any;
  tokens: any;
  files: FileItem[];
  storageInfo: any;
  storageBreakdown?: any;
  onUpload: (file: File) => void;
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
}

export default function Dashboard({ user, tokens, files, storageInfo, storageBreakdown, onUpload, setActiveTab, onRefreshStorage, onCategoryClick, onCreateFolder, onRename, onDelete, onShare, onHide, onMove, onStar, onNavigateToFiles }: DashboardProps) {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [actionMenuFile, setActionMenuFile] = useState<FileItem | null>(null);
  const [renameFile, setRenameFile] = useState<FileItem | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [showStorageDetails, setShowStorageDetails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        onUpload(file);
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      const folderInput = document.getElementById('folderInputDash') as HTMLInputElement;
      if (folderInput) folderInput.value = '';
    }
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

  const handleDownload = async (id: string) => {
    try {
      const response = await fetch('/api/drive/download/ticket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens })
      });
      
      if (!response.ok) throw new Error('Failed to get download ticket');
      
      const { ticketId } = await response.json();
      window.location.assign(`/api/drive/download/${id}?ticket=${ticketId}`);
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Failed to start download');
    }
  };

  const handleOpenFile = (file: FileItem) => {
    if (file.type === 'folder') {
      if (onNavigateToFiles) onNavigateToFiles();
    } else if (file.webViewLink) {
      window.open(file.webViewLink, '_blank');
    } else {
      toast.error('Cannot open this file');
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

      <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />
      <input type="file" id="folderInputDash" className="hidden" webkitdirectory="" directory="" onChange={handleFileChange} />

      {/* Floating Action Button */}
      {/* Floating Action Button - hidden on desktop because sidebar/header handles it or keep as convenience */}
      <div className="fixed bottom-24 right-6 md:bottom-10 md:right-10 z-50">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-2xl shadow-blue-500/40 active:scale-90 transition-all hover:bg-blue-700">
            <Plus size={32} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="bg-white dark:bg-slate-800 border-none shadow-2xl rounded-2xl p-2 mb-4 min-w-[180px]">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="rounded-xl cursor-pointer py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-red-600">
                <Camera size={18} />
              </div>
              <span className="font-medium">Camera</span>
            </DropdownMenuItem>
            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2" />
            <DropdownMenuItem onClick={() => document.getElementById('folderInputDash')?.click()} className="rounded-xl cursor-pointer py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-yellow-50 dark:bg-yellow-900/30 flex items-center justify-center text-yellow-600">
                <Folder size={18} />
              </div>
              <span className="font-medium">Upload Folder</span>
            </DropdownMenuItem>
            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2" />
            <DropdownMenuItem onClick={() => setIsNewFolderOpen(true)} className="rounded-xl cursor-pointer py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                <Folder size={18} />
              </div>
              <span className="font-medium">New Folder</span>
            </DropdownMenuItem>
            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2" />
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="rounded-xl cursor-pointer py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-green-600">
                <Plus size={18} />
              </div>
              <span className="font-medium">Upload All</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="rounded-xl cursor-pointer py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center text-orange-600">
                <Image size={18} />
              </div>
              <span className="font-medium">Images & Videos</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="rounded-xl cursor-pointer py-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center text-purple-600">
                <Archive size={18} />
              </div>
              <span className="font-medium">ZIP & Archives</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* New Folder Dialog */}
      <Dialog open={isNewFolderOpen} onOpenChange={setIsNewFolderOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-none rounded-3xl">
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input 
              placeholder="Folder name" 
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus-visible:ring-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsNewFolderOpen(false)} className="rounded-xl flex-1">Cancel</Button>
            <Button onClick={handleCreateFolder} className="rounded-xl flex-1 bg-blue-600 hover:bg-blue-700">Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-none rounded-3xl">
          <DialogHeader>
            <DialogTitle>Rename {renameFile?.type === 'folder' ? 'Folder' : 'File'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input 
              placeholder="New name" 
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus-visible:ring-blue-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsRenameOpen(false)} className="rounded-xl flex-1">Cancel</Button>
            <Button onClick={handleRename} className="rounded-xl flex-1 bg-blue-600 hover:bg-blue-700">Rename</Button>
          </DialogFooter>
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
                if (actionMenuFile && onShare) onShare(actionMenuFile.id);
                setActionMenuFile(null);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600">
                <Share2 size={20} />
              </div>
              <span className="font-medium dark:text-white">Share</span>
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
                if (actionMenuFile) handleDownload(actionMenuFile.id);
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
    </div>
  );
}

