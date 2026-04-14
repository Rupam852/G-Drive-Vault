import React, { useState, useRef } from 'react';
import { Search, Grid, List as ListIcon, MoreVertical, File, Image as ImageIcon, Video, Music, FileText, ArrowUpDown, Plus, Folder, Archive, Camera, User, Star, Trash2, Move, Check, Share2, Edit2, ExternalLink, EyeOff, Download, X } from 'lucide-react';

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
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://g-drive-vault.vercel.app';


interface FileExplorerProps {
  files: FileItem[];
  tokens: any;
  breadcrumb: {id: string, name: string}[];
  filterType: string;
  onFilterChange: (type: string) => void;
  onNavigate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onUpload: (file: File, relativePath?: string) => void;
  onCreateFolder: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onShare: (id: string) => void;
  onTabChange: (tab: string) => void;

  onStar: (id: string, starred: boolean) => void;
  onMove: (id: string, targetId: string) => void;
  onHide: (id: string) => void;
  isDownloadEnabled?: boolean;
  activeSubTab: string;
}

const iconMap = {
  image: ImageIcon,
  video: Video,
  document: FileText,
  audio: Music,
  folder: Folder,
  archive: Archive,
  other: File,
};

export default function FileExplorer({ files, tokens, breadcrumb, filterType, onFilterChange, onNavigate, onDelete, onUpload, onCreateFolder, onRename, onShare, onTabChange, activeSubTab, onStar, onMove, onHide, isDownloadEnabled }: FileExplorerProps) {
  const [view, setView] = useState<'grid' | 'list'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date' | 'type'>('date');
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [actionMenuFile, setActionMenuFile] = useState<FileItem | null>(null);
  const [renameFile, setRenameFile] = useState<FileItem | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const longPressTimer = useRef<any>(null);
  const [isMoveDialogOpen, setIsMoveDialogOpen] = useState(false);
  const [activeDownloads, setActiveDownloads] = useState<{
    id: string; name: string; progress: number; controller: AbortController;
  }[]>([]);


  const filteredFiles = files
    .filter(f => {
      const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           f.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter = filterType === 'all' || f.type === filterType;
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'size') return a.sizeBytes - b.sizeBytes;
      if (sortBy === 'type') return a.type.localeCompare(b.type);
      return b.timestamp - a.timestamp;
    });

  const handleItemClick = (file: FileItem) => {
    if (file.type === 'folder') {
      onNavigate(file.id, file.name);
    } else {
      setSelectedFile(file);
    }
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
      // Get one-time ticket
      const ticketRes = await fetch(`${API_BASE_URL}/api/drive/download/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens }),
        signal: controller.signal,
      });
      if (!ticketRes.ok) throw new Error('Ticket failed');
      const { ticketId } = await ticketRes.json();

      const downloadUrl = `${API_BASE_URL}/api/drive/download/${file.id}?ticket=${ticketId}`;
      const res = await fetch(downloadUrl, { signal: controller.signal });
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

      // Stream with progress tracking
      const contentLength = res.headers.get('Content-Length');
      const total = contentLength ? parseInt(contentLength) : 0;
      const reader = res.body!.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          received += value.length;
          const pct = total > 0 ? Math.min(99, Math.round((received / total) * 100)) : -1;
          setActiveDownloads(prev => prev.map(d => d.id === dlId ? { ...d, progress: pct } : d));
        }
      }
      setActiveDownloads(prev => prev.map(d => d.id === dlId ? { ...d, progress: 100 } : d));

      const blob = new Blob(chunks);

      if (Capacitor.isNativePlatform()) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onloadend = () => resolve((fr.result as string).split(',')[1]);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        await Filesystem.writeFile({ path: finalFilename, data: base64, directory: Directory.Downloads, recursive: true });
        toast.success(`✅ Saved to Downloads: ${finalFilename}`);
      } else {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl; a.download = finalFilename; a.click();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
        toast.success(`Downloaded: ${finalFilename}`);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.info(`Cancelled: ${file.name}`);
      } else {
        console.error('Download error:', err);
        toast.error(`Error: ${err.message || 'Failed to download file'}`);
      }
    } finally {
      setTimeout(() => setActiveDownloads(prev => prev.filter(d => d.id !== dlId)), 1200);
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
        onUpload(file, file.webkitRelativePath);
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      const folderInput = document.getElementById('folderInput') as HTMLInputElement;
      if (folderInput) folderInput.value = '';
    }
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
    selectedIds.forEach(id => onMove(id, targetFolderId));
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    setIsMoveDialogOpen(false);
  };

  return (
    <div className="flex-1 p-4 md:p-10 space-y-6 md:space-y-10 max-w-7xl mx-auto w-full transition-colors">
      <header className="space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Files</h1>
            {activeSubTab === 'all' && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar max-w-[200px] sm:max-w-md">
                {breadcrumb.map((b, i) => (
                  <React.Fragment key={b.id}>
                    {i > 0 && <span className="text-slate-400 text-xs">/</span>}
                    <button 
                      onClick={() => onNavigate(b.id, b.name)}
                      className={`text-xs font-medium whitespace-nowrap ${i === breadcrumb.length - 1 ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      {b.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileChange} />
            <input type="file" id="folderInput" className="hidden" webkitdirectory="" directory="" onChange={handleFileChange} />
          </div>
        </div>
        
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input 
              placeholder="Search files..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus-visible:ring-blue-500 dark:text-white"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="w-11 h-11 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 active:bg-slate-100 transition-colors">
              <ArrowUpDown size={20} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white dark:bg-slate-800 border-none shadow-xl rounded-2xl p-2">
              <DropdownMenuItem onClick={() => setSortBy('name')} className="rounded-xl cursor-pointer">Sort by Name</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('size')} className="rounded-xl cursor-pointer">Sort by Size</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('type')} className="rounded-xl cursor-pointer">Sort by Type</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('date')} className="rounded-xl cursor-pointer">Sort by Date</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button 
            onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
            className="w-11 h-11 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-600 dark:text-slate-400 active:bg-slate-100 transition-colors"
          >
            {view === 'grid' ? <ListIcon size={20} /> : <Grid size={20} />}
          </button>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['all', 'image', 'video', 'document', 'audio', 'folder', 'archive'].map((type) => (
            <button
              key={type}
              onClick={() => onFilterChange(type)}
              className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap
                ${filterType === type 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
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

      <div className={view === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4' : 'space-y-1'}>
        {filteredFiles.map((file, idx) => {
          const Icon = iconMap[file.type] || File;
          
          if (view === 'grid') {
            return (
              <motion.div
                key={file.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                onClick={() => handleItemClick(file)}
                className={`p-4 rounded-2xl space-y-3 group cursor-pointer relative transition-all ${
                  selectedIds.has(file.id) 
                    ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500' 
                    : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {selectedIds.has(file.id) && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white z-10">
                    <Check size={14} />
                  </div>
                )}
                {file.starred && (
                  <div className="absolute top-2 left-2 text-yellow-500 z-10">
                    <Star size={14} fill="currentColor" />
                  </div>
                )}
                <div className="aspect-square bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors overflow-hidden">
                  {file.thumbnail && file.type !== 'folder' ? (
                    <img src={file.thumbnail} className="w-full h-full object-cover" alt={file.name} referrerPolicy="no-referrer" />
                  ) : (
                    <Icon size={file.type === 'folder' ? 48 : 32} className={file.type === 'folder' ? 'text-blue-500' : ''} />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">{file.name}</h4>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{file.type === 'folder' ? 'Folder' : file.size}</p>
                </div>
              </motion.div>
            );
          }

          return (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              onClick={() => handleItemClick(file)}
              className={`flex items-center gap-4 p-3 rounded-2xl transition-colors cursor-pointer group relative ${
                selectedIds.has(file.id) 
                  ? 'bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500' 
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {selectedIds.has(file.id) && (
                <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center text-white z-10">
                  <Check size={12} />
                </div>
              )}
              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-blue-500 transition-colors shrink-0">
                <Icon size={20} className={file.type === 'folder' ? 'text-blue-500' : ''} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-slate-800 dark:text-slate-200 truncate">{file.name}</h4>
                  {file.starred && <Star size={14} className="text-yellow-500 fill-yellow-500 shrink-0" />}
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">{file.type === 'folder' ? 'Folder' : file.size} • {file.date}</p>
              </div>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActionMenuFile(file);
                }}
                className="text-slate-300 dark:text-slate-600 hover:text-blue-500 transition-colors p-2 -mr-2"
              >
                <MoreVertical size={18} />
              </button>
            </motion.div>
          );
        })}
      </div>

      <FileDetails 
        file={selectedFile}
        isOpen={!!selectedFile}
        tokens={tokens}
        onClose={() => setSelectedFile(null)}
        onDelete={onDelete}
        onShare={onShare}
      />

      {/* Floating Action Button */}
      <div className="fixed bottom-24 right-6 z-50">
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
            <DropdownMenuItem onClick={() => document.getElementById('folderInput')?.click()} className="rounded-xl cursor-pointer py-3 flex items-center gap-3">
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
                <ImageIcon size={18} />
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

      {/* Move Dialog */}
      <Dialog open={isMoveDialogOpen} onOpenChange={setIsMoveDialogOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-none rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold dark:text-white">Move to Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto py-4">
            <button 
              onClick={() => handleBulkMove('root')}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                <Folder size={20} />
              </div>
              <span className="font-medium dark:text-white">My Drive (Root)</span>
            </button>
            {files.filter(f => f.type === 'folder' && !selectedIds.has(f.id)).map(folder => (
              <button 
                key={folder.id}
                onClick={() => handleBulkMove(folder.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center text-yellow-600">
                  <Folder size={20} />
                </div>
                <span className="font-medium dark:text-white">{folder.name}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMoveDialogOpen(false)} className="rounded-xl w-full">Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                if (actionMenuFile) handleItemClick(actionMenuFile);
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
                if (actionMenuFile) onStar(actionMenuFile.id, !actionMenuFile.starred);
                setActionMenuFile(null);
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center text-yellow-600">
                <Star size={20} className={actionMenuFile?.starred ? 'fill-yellow-600' : ''} />
              </div>
              <span className="font-medium dark:text-white">{actionMenuFile?.starred ? 'Unstar' : 'Star'}</span>
            </button>

            <button
              onClick={() => {
                if (actionMenuFile) {
                  handleCopyShareLink(actionMenuFile);
                }
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
                if (actionMenuFile) onDelete(actionMenuFile.id);
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

