import React, { useState, useEffect } from 'react';
import { User, Bell, Shield, Cloud, Info, LogOut, ChevronRight, Moon, Sun, Trash2, RefreshCw, X, CheckCircle, EyeOff, Eye, History, Database, Loader2, Pause, Play } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FileItem } from '../types';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Capacitor } from '@capacitor/core';

import { TransferState } from './TransferManager';
const isVersionOlder = (current: string, latest: string): boolean => {
  const cParts = current.split('.').map(Number);
  const lParts = latest.split('.').map(Number);
  for (let i = 0; i < Math.max(cParts.length, lParts.length); i++) {
    const cVal = cParts[i] || 0;
    const lVal = lParts[i] || 0;
    if (lVal > cVal) return true;
    if (cVal > lVal) return false;
  }
  return false;
};

interface SettingsProps {
  user: any;
  setUser?: (user: any) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  onLogout: () => void;
  trashedFiles: FileItem[];
  hiddenFiles: FileItem[];
  onRestore: (id: string) => void;
  onUnhide: (ids: string[]) => void;
  onPermanentDelete: (id: string) => void;
  transfers: TransferState[];
  onClearTransfers: () => void;
  isDownloadEnabled: boolean;
  setIsDownloadEnabled: (val: boolean) => void;
  isNotificationEnabled: boolean;
  setIsNotificationEnabled: (val: boolean) => void;
  onCancelTransfer?: (id: string) => void;
  onPauseTransfer?: (id: string) => void;
  onResumeTransfer?: (id: string) => void;
  defaultOpenTransfers?: boolean;
  onCloseTransfers?: () => void;
  currentVersion?: string;
  updateInfo?: any;
}

export default function Settings({ user, setUser, isDarkMode, setIsDarkMode, onLogout, trashedFiles, hiddenFiles, onRestore, onUnhide, onPermanentDelete, transfers, onClearTransfers, isDownloadEnabled, setIsDownloadEnabled, isNotificationEnabled, setIsNotificationEnabled, onCancelTransfer, onPauseTransfer, onResumeTransfer, defaultOpenTransfers, onCloseTransfers, currentVersion = '1.0.0', updateInfo }: SettingsProps) {
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isHiddenOpen, setIsHiddenOpen] = useState(false);
  const [isTransfersOpen, setIsTransfersOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedHiddenIds, setSelectedHiddenIds] = useState<string[]>([]);
  
  // Profile state
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [uploadHistory, setUploadHistory] = useState<any[]>([]);

  // Load upload history from localStorage
  React.useEffect(() => {
    try {
      const hist = JSON.parse(localStorage.getItem('drive_vault_upload_history') || '[]');
      setUploadHistory(hist);
    } catch {}
  }, [transfers]);

  // Sync isTransfersOpen from external props
  React.useEffect(() => {
    if (defaultOpenTransfers) {
      setIsTransfersOpen(true);
    }
  }, [defaultOpenTransfers]);

  const activeUploads = (transfers || []).filter(t => t.type === 'upload' && (t.status === 'uploading' || t.status === 'pending' || t.status === 'paused'));

  const clearUploadHistory = () => {
    localStorage.removeItem('drive_vault_upload_history');
    setUploadHistory([]);
    toast.success('Upload history cleared');
  };

  const deleteHistoryItem = (id: string, idx: number) => {
    const updated = uploadHistory.filter((_, i) => i !== idx);
    setUploadHistory(updated);
    try {
      localStorage.setItem('drive_vault_upload_history', JSON.stringify(updated));
    } catch {}
  };

  // Notifications state
  const [notifPush, setNotifPush] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSharedActivity, setNotifSharedActivity] = useState(false);
  const [notifSecurity, setNotifSecurity] = useState(true);

  // Security & Privacy state
  const [secBiometric, setSecBiometric] = useState(() => {
    const saved = localStorage.getItem('drive_vault_biometric_enabled');
    return saved !== null ? saved === 'true' : false;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleHiddenSelect = (id: string) => {
    setSelectedHiddenIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkRestore = async () => {
    try {
      if (!trashedFiles) return;
      const idsToRestore = selectedIds.length > 0 ? selectedIds : (trashedFiles || []).map(f => f.id);
      if (idsToRestore.length === 0) return;
      
      await Promise.all(idsToRestore.map(id => onRestore?.(id)));
      setSelectedIds([]);
      toast.success(`Restored ${idsToRestore.length} items`);
    } catch (err) {
      toast.error('Failed to restore some items');
    }
  };

  const handleBulkDelete = async () => {
    try {
      if (!trashedFiles) return;
      const idsToDelete = selectedIds.length > 0 ? selectedIds : (trashedFiles || []).map(f => f.id);
      if (idsToDelete.length === 0) return;

      await Promise.all(idsToDelete.map(id => onPermanentDelete?.(id)));
      setSelectedIds([]);
      toast.success(`Permanently deleted ${idsToDelete.length} items`);
    } catch (err) {
      toast.error('Failed to delete some items');
    }
  };

  const handleBulkUnhide = async () => {
    try {
      if (!hiddenFiles) return;
      const idsToUnhide = selectedHiddenIds.length > 0 ? selectedHiddenIds : (hiddenFiles || []).map(f => f.id);
      if (idsToUnhide.length === 0) return;
      
      await onUnhide?.(idsToUnhide);
      setSelectedHiddenIds([]);
    } catch (err) {
      toast.error('Failed to unhide some items');
    }
  };

  const menuItems = [
    { icon: History, label: 'Upload History', color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/20', onClick: () => setIsTransfersOpen(true) },
    { icon: Trash2, label: 'Trash Bin', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', onClick: () => setIsTrashOpen(true) },
    { icon: EyeOff, label: 'Hidden Files', color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20', onClick: () => setIsHiddenOpen(true) },
    { icon: Shield, label: 'Security & Privacy', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', onClick: () => setIsSecurityOpen(true), hideOnWeb: true },
    { icon: Database, label: 'File Permission', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', toggle: true, checked: isDownloadEnabled, onChange: setIsDownloadEnabled },
    { icon: isDarkMode ? Sun : Moon, label: 'Dark Mode', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', toggle: true },
  ];

  // CENTRAL BACK GESTURE HANDLING FOR SETTINGS SUB-VIEWS
  useEffect(() => {
    const handleVaultBack = (e: any) => {
      // Check which sub-view is open and close it if found
      if (isTrashOpen) { e.preventDefault(); setIsTrashOpen(false); return; }
      if (isHiddenOpen) { e.preventDefault(); setIsHiddenOpen(false); return; }
      if (isTransfersOpen) { e.preventDefault(); setIsTransfersOpen(false); return; }
      if (isProfileOpen) { e.preventDefault(); setIsProfileOpen(false); return; }
      if (isNotificationsOpen) { e.preventDefault(); setIsNotificationsOpen(false); return; }
      if (isSecurityOpen) { e.preventDefault(); setIsSecurityOpen(false); return; }
    };

    window.addEventListener('vault-back', handleVaultBack);
    return () => window.removeEventListener('vault-back', handleVaultBack);
  }, [isTrashOpen, isHiddenOpen, isTransfersOpen, isProfileOpen, isNotificationsOpen, isSecurityOpen]);

  return (
    <div className="p-6 pb-6 md:pb-8 space-y-8 bg-slate-50 dark:bg-slate-950 transition-colors">
      <header className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-4 flex items-center gap-4">
            <Avatar className="w-16 h-16 rounded-2xl">
              <AvatarImage src={user?.picture} referrerPolicy="no-referrer" />
              <AvatarFallback className="bg-blue-600 text-white text-2xl font-bold rounded-2xl">
                {user?.name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">{user?.name || 'User'}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email || 'No email provided'}</p>
            </div>

          </CardContent>
        </Card>
      </header>

      <div className="space-y-2">
        {menuItems.filter(item => !(item.hideOnWeb && !Capacitor.isNativePlatform())).map((item, idx) => {
          const Icon = item.icon || Info;
          return (
            <div
              key={idx}
              onClick={item.onClick}
              className={`w-full flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm transition-all ${item.onClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
            >
              <div className={`w-10 h-10 ${item.bg || ''} ${item.color || ''} rounded-xl flex items-center justify-center`}>
                <Icon size={20} />
              </div>
              <span className="flex-1 text-left font-medium text-slate-700 dark:text-slate-200">{item.label}</span>
              {item.toggle ? (
                <Switch 
                  checked={item.checked !== undefined ? item.checked : isDarkMode} 
                  onCheckedChange={item.onChange || setIsDarkMode}
                  className="data-[state=checked]:bg-blue-600"
                />
              ) : (
                <ChevronRight size={20} className="text-slate-300 dark:text-slate-600" />
              )}
            </div>
          );
        })}
      </div>

      {/* ── APP VERSION & AUTO-UPDATE CARD ── */}
      {Capacitor.isNativePlatform() && (
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900 rounded-[2rem] overflow-hidden">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 rounded-xl flex items-center justify-center shrink-0">
                <Cloud size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm">App Update</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Current Version: v{currentVersion}</p>
              </div>
              {updateInfo && isVersionOlder(currentVersion, updateInfo.latestVersion) ? (
                <span className="w-3.5 h-3.5 bg-red-500 rounded-full animate-ping shrink-0" />
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-bold text-green-500 bg-green-50 dark:bg-green-950/30 px-2.5 py-1 rounded-full shrink-0">
                  <CheckCircle size={10} /> Up to Date
                </span>
              )}
            </div>

            {updateInfo && isVersionOlder(currentVersion, updateInfo.latestVersion) ? (
              <div className="p-4 bg-orange-50 dark:bg-orange-950/10 border border-orange-100 dark:border-orange-900/10 rounded-2xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-orange-800 dark:text-orange-400">v{updateInfo.latestVersion} Available</p>
                    <p className="text-[11px] text-orange-600 dark:text-orange-500 mt-0.5 font-medium">A new version is ready to download.</p>
                  </div>
                  <Button 
                    onClick={() => window.open(updateInfo.apkUrl, '_blank')}
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-500 active:scale-95 transition-all text-white rounded-xl font-bold px-4"
                  >
                    Update Now
                  </Button>
                </div>
                {updateInfo.releaseNotes && (
                  <div className="pt-2.5 border-t border-orange-100/50 dark:border-orange-900/10">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-orange-400">Release Notes</span>
                    <p className="text-xs font-semibold text-orange-700/80 dark:text-orange-300 mt-1 leading-relaxed">
                      {updateInfo.releaseNotes}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 pt-1">
                🎉 You are using the latest version of DriveVault.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* MODALS - Changed from AnimatePresence to standard conditional rendering to fix black screen */}
      {isTrashOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-50 dark:bg-slate-950 md:bg-slate-900/50 md:backdrop-blur-sm flex flex-col md:items-center md:justify-center md:p-6 transition-all">
          <div className="w-full h-full md:h-auto md:max-h-full md:max-w-3xl bg-slate-50 dark:bg-slate-950 md:rounded-3xl md:shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="p-6 flex items-center justify-between border-b dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <h2 className="text-xl font-bold">Trash Bin</h2>
              <div className="flex items-center gap-2">
                {(trashedFiles || []).length > 0 && (
                  <>
                    <Button variant="outline" size="sm" onClick={handleBulkRestore} className="rounded-xl gap-2 text-blue-600 border-blue-200">
                      <RefreshCw size={16} /> {selectedIds.length > 0 ? 'Restore Selected' : 'Restore All'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleBulkDelete} className="rounded-xl gap-2 text-red-600 border-red-200">
                      <Trash2 size={16} /> {selectedIds.length > 0 ? 'Delete Selected' : 'Empty Trash'}
                    </Button>
                  </>
                )}
                <Button variant="ghost" size="icon" onClick={() => setIsTrashOpen(false)} className="rounded-full ml-2">
                  <X size={20} />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-3">
              {(trashedFiles || []).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <Trash2 size={40} />
                  </div>
                  <p className="font-medium">Trash is empty</p>
                </div>
              ) : (
                (trashedFiles || []).map((file) => (
                  <div
                    key={file.id || Math.random()}
                    onClick={() => toggleSelect(file.id)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      selectedIds.includes(file.id) 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-transparent bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedIds.includes(file.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-200 dark:border-slate-700'
                    }`}>
                      {selectedIds.includes(file.id) && <CheckCircle size={14} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{file.name || 'Untitled'}</h4>
                      <p className="text-xs text-slate-500">{file.type === 'folder' ? 'Folder' : file.size} • Trashed on {file.date}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isHiddenOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-50 dark:bg-slate-950 md:bg-slate-900/50 md:backdrop-blur-sm flex flex-col md:items-center md:justify-center md:p-6 transition-all">
          <div className="w-full h-full md:h-auto md:max-h-full md:max-w-3xl bg-slate-50 dark:bg-slate-950 md:rounded-3xl md:shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="p-6 flex items-center justify-between border-b dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
              <h2 className="text-xl font-bold">Hidden Files</h2>
              <div className="flex items-center gap-2">
                {(hiddenFiles || []).length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleBulkUnhide} className="rounded-xl gap-2 text-indigo-600 border-indigo-200">
                    <Eye size={16} /> {selectedHiddenIds.length > 0 ? 'Unhide Selected' : 'Unhide All'}
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setIsHiddenOpen(false)} className="rounded-full ml-2">
                  <X size={20} />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-3">
              {(hiddenFiles || []).length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <EyeOff size={40} />
                  </div>
                  <p className="font-medium">No hidden files</p>
                </div>
              ) : (
                (hiddenFiles || []).map((file) => (
                  <div
                    key={file.id || Math.random()}
                    onClick={() => toggleHiddenSelect(file.id)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                      selectedHiddenIds.includes(file.id) 
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                        : 'border-transparent bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      selectedHiddenIds.includes(file.id) ? 'bg-indigo-500 border-indigo-500' : 'border-slate-200 dark:border-slate-700'
                    }`}>
                      {selectedHiddenIds.includes(file.id) && <CheckCircle size={14} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{file.name || 'Untitled'}</h4>
                      <p className="text-xs text-slate-500">{file.type === 'folder' ? 'Folder' : file.size} • Hidden</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {isTransfersOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-50 dark:bg-slate-950 md:bg-slate-900/50 md:backdrop-blur-sm flex flex-col md:items-center md:justify-center md:p-6 transition-all">
          <div className="w-full h-full md:h-auto md:max-h-full md:max-w-3xl bg-slate-50 dark:bg-slate-950 md:rounded-3xl md:shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <div>
                <h2 className="text-xl font-bold">Upload History</h2>
                <p className="text-xs text-slate-400">{uploadHistory.length} uploads recorded</p>
              </div>
              <div className="flex items-center gap-2">
                {uploadHistory.length > 0 && (
                  <Button variant="outline" size="sm" onClick={clearUploadHistory} className="rounded-xl text-slate-500 border-slate-200">
                    Clear All
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => {
                   setIsTransfersOpen(false);
                   if (onCloseTransfers) onCloseTransfers();
                 }} className="rounded-full ml-2">
                  <X size={20} />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-2">
              {activeUploads.length === 0 && uploadHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <History size={40} />
                  </div>
                  <p className="font-semibold">No uploads yet</p>
                  <p className="text-xs text-center text-slate-400">Your upload history will appear here</p>
                </div>
              ) : (
                <>
                {activeUploads.map(t => {
                  const speedStr = t.speed ? (t.speed > 1048576 ? `${(t.speed/1048576).toFixed(1)} MB/s` : `${(t.speed/1024).toFixed(0)} KB/s`) : 'Calculating...';
                  const timeStr = t.remainingSeconds ? (t.remainingSeconds > 60 ? `${Math.floor(t.remainingSeconds/60)}m ${Math.round(t.remainingSeconds%60)}s left` : `${Math.round(t.remainingSeconds)}s left`) : '';
                  return (
                    <div key={t.id} className="flex flex-col gap-2 p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 shadow-sm relative overflow-hidden">
                      <div className="flex items-center gap-3">
                        {/* Left Side: Play/Pause Button */}
                        {(t.status === 'uploading' || t.status === 'paused') && (
                          <button
                            onClick={() => {
                              if (t.status === 'uploading' && onPauseTransfer) onPauseTransfer(t.id);
                              else if (t.status === 'paused' && onResumeTransfer) onResumeTransfer(t.id);
                            }}
                            className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 transition active:scale-95 cursor-pointer"
                            title={t.status === 'uploading' ? 'Pause Upload' : 'Resume Upload'}
                          >
                            {t.status === 'uploading' ? (
                              <Pause size={18} fill="currentColor" />
                            ) : (
                              <Play size={18} className="ml-0.5" fill="currentColor" />
                            )}
                          </button>
                        )}
                        {t.status === 'pending' && (
                          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                            <Loader2 size={20} className="text-blue-500 animate-spin" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{t.name}</p>
                          <div className="flex items-center justify-between mt-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                            <span>{t.status === 'paused' ? 'Paused' : (t.status === 'pending' ? 'Starting...' : `${speedStr} • ${timeStr}`)}</span>
                            <span>{t.progress}%</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {onCancelTransfer && (
                            <button
                              onClick={() => onCancelTransfer(t.id)}
                              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all active:scale-90"
                              title="Cancel Upload"
                            >
                              <X size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-full h-1.5 mt-1 overflow-hidden">
                        <motion.div 
                          className={`h-full rounded-full ${t.status === 'paused' ? 'bg-amber-500' : 'bg-blue-500'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${t.progress}%` }}
                          transition={{ duration: 0.2 }}
                        />
                      </div>
                    </div>
                  );
                })}
                {uploadHistory.map((item, idx) => {
                  const date = new Date(item.date);
                  const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                  const timeStr = date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                  const sizeStr = item.size ? (item.size > 1048576 ? `${(item.size/1048576).toFixed(1)} MB` : item.size > 1024 ? `${(item.size/1024).toFixed(0)} KB` : `${item.size} B`) : '';
                  return (
                    <div key={item.id || idx} className="flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 shadow-sm group">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                        <Cloud size={20} className="text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{item.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {item.folderName || 'My Drive'} {sizeStr ? `• ${sizeStr}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <p className="text-[10px] font-semibold text-slate-500">{dateStr}</p>
                          <p className="text-[10px] text-slate-400">{timeStr}</p>
                        </div>
                        <button
                          onClick={() => deleteHistoryItem(item.id, idx)}
                          className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-slate-400 hover:text-red-500 transition-all active:scale-90"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
                }
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {isProfileOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-50 dark:bg-slate-950 md:bg-slate-900/50 md:backdrop-blur-sm flex flex-col md:items-center md:justify-center md:py-10 transition-all">
          <div className="w-full h-full md:h-auto md:max-h-full md:max-w-2xl bg-slate-50 dark:bg-slate-950 md:rounded-3xl md:shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <h2 className="text-xl font-bold">Profile Settings</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsProfileOpen(false)} className="rounded-full hover:bg-slate-100 dark:hover:bg-slate-800">
                <X size={20} />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-8 bg-slate-50 dark:bg-slate-950">
              {/* Cover & Avatar Section */}
              <div className="relative rounded-3xl bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden pb-8">
                <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600 w-full"></div>
                <div className="px-8 relative">
                  <div className="absolute -top-12 left-1/2 -translate-x-1/2">
                    <Avatar className="w-24 h-24 rounded-full ring-4 ring-white dark:ring-slate-900 shadow-lg bg-white dark:bg-slate-900">
                      <AvatarImage src={user?.picture} referrerPolicy="no-referrer" />
                      <AvatarFallback className="bg-blue-600 text-white text-3xl font-bold">{user?.name?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="pt-16 text-center">
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">{displayName || 'User'}</h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">{user?.email || 'No email'}</p>
                  </div>
                </div>
              </div>

              {/* Form Section */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 space-y-5">
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300 font-semibold ml-1">Display Name</Label>
                  <Input 
                    value={displayName} 
                    onChange={(e) => setDisplayName(e.target.value)} 
                    className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 px-5 h-14 w-full focus-visible:ring-blue-500" 
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700 dark:text-slate-300 font-semibold ml-1">Email Address</Label>
                  <Input defaultValue={user?.email} disabled className="rounded-2xl bg-slate-100/50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800 px-5 h-14 w-full text-slate-500" />
                  <p className="text-xs text-slate-400 ml-1 mt-1">Email addresses cannot be changed.</p>
                </div>
              </div>

              <div className="pt-2">
                <Button 
                  onClick={() => {
                    if (setUser) {
                      const updatedUser = { ...user, name: displayName };
                      setUser(updatedUser);
                      localStorage.setItem('drive_vault_user', JSON.stringify(updatedUser));
                    }
                    toast.success('Profile updated'); 
                    setIsProfileOpen(false);
                  }} 
                  className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/25 font-bold text-lg transition-all active:scale-[0.98]"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isNotificationsOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-50 dark:bg-slate-950 md:bg-slate-900/50 md:backdrop-blur-sm flex flex-col md:items-center md:justify-center md:py-10 transition-all">
          <div className="w-full h-full md:h-auto md:max-h-full md:max-w-2xl bg-slate-50 dark:bg-slate-950 md:rounded-3xl md:shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <h2 className="text-xl font-bold">Notifications</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsNotificationsOpen(false)} className="rounded-full"><X size={20} /></Button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
              {([
                { label: 'Push Notifications', desc: 'Receive alerts on your device', checked: notifPush, onChange: setNotifPush },
                { label: 'Email Alerts', desc: 'Get updates in your inbox', checked: notifEmail, onChange: setNotifEmail },
                { label: 'Shared File Activity', desc: 'When someone edits your file', checked: notifSharedActivity, onChange: setNotifSharedActivity },
                { label: 'Security Alerts', desc: 'Unusual login detection', checked: notifSecurity, onChange: setNotifSecurity }
              ] as { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }[]).map((n, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                  <div className="space-y-0.5">
                    <p className="font-medium">{n.label}</p>
                    <p className="text-xs text-slate-500">{n.desc}</p>
                  </div>
                  <Switch checked={n.checked} onCheckedChange={n.onChange} className="data-[state=checked]:bg-blue-600" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {isSecurityOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-50 dark:bg-slate-950 md:bg-slate-900/50 md:backdrop-blur-sm flex flex-col md:items-center md:justify-center md:py-10 transition-all">
          <div className="w-full h-full md:h-auto md:max-h-full md:max-w-2xl bg-slate-50 dark:bg-slate-950 md:rounded-3xl md:shadow-2xl flex flex-col overflow-hidden border border-slate-100 dark:border-slate-800">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 shrink-0">
              <h2 className="text-xl font-bold">Security & Privacy</h2>
              <Button variant="ghost" size="icon" onClick={() => setIsSecurityOpen(false)} className="rounded-full"><X size={20} /></Button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-4">
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-3 text-blue-600 font-semibold mb-2">
                  <Shield size={20} />
                  <h3>Account Security</h3>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Biometric Login</Label>
                  <Switch 
                    checked={secBiometric} 
                    onCheckedChange={(val) => {
                      setSecBiometric(val);
                      localStorage.setItem('drive_vault_biometric_enabled', String(val));
                    }} 
                    className="data-[state=checked]:bg-blue-600" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <button 
        onClick={onLogout}
        className="w-full flex items-center justify-center gap-2 p-4 text-red-500 font-bold bg-red-50 dark:bg-red-900/20 rounded-2xl active:scale-95 transition-transform"
      >
        <LogOut size={20} />
        <span>Log Out</span>
      </button>

      <div className="text-center">
        <p className="text-[10px] text-slate-400 dark:text-slate-600 uppercase tracking-widest font-bold">Drive Vault v1.0.7</p>
      </div>
    </div>
  );
}

