import React, { useState, useEffect } from 'react';
import { User, Bell, Shield, Cloud, Info, LogOut, ChevronRight, Moon, Sun, Trash2, RefreshCw, X, CheckCircle, EyeOff, Eye, History, Database } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { FileItem } from '../types';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';

import { TransferState } from './TransferManager';

interface SettingsProps {
  user: any;
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
}

export default function Settings({ user, isDarkMode, setIsDarkMode, onLogout, trashedFiles, hiddenFiles, onRestore, onUnhide, onPermanentDelete, transfers, onClearTransfers, isDownloadEnabled, setIsDownloadEnabled }: SettingsProps) {
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
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
  const [uploadHistory, setUploadHistory] = useState<any[]>([]);

  // Load upload history from localStorage
  React.useEffect(() => {
    try {
      const hist = JSON.parse(localStorage.getItem('drive_vault_upload_history') || '[]');
      setUploadHistory(hist);
    } catch {}
  }, []);

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
  const [secTwoFactor, setSecTwoFactor] = useState(false);
  const [secBiometric, setSecBiometric] = useState(true);
  const [privHideSearches, setPrivHideSearches] = useState(false);
  const [privAnalytics, setPrivAnalytics] = useState(true);

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
    { icon: User, label: 'Profile Settings', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', onClick: () => setIsProfileOpen(true) },
    { icon: History, label: 'Upload History', color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/20', onClick: () => setIsTransfersOpen(true) },
    { icon: Trash2, label: 'Trash Bin', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', onClick: () => setIsTrashOpen(true) },
    { icon: EyeOff, label: 'Hidden Files', color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20', onClick: () => setIsHiddenOpen(true) },
    { icon: Bell, label: 'Notifications', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', onClick: () => setIsNotificationsOpen(true) },
    { icon: Shield, label: 'Security & Privacy', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', onClick: () => setIsSecurityOpen(true) },
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
    <div className="p-6 pb-24 space-y-8 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors">
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
        {menuItems.map((item, idx) => {
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

      {/* MODALS - Changed from AnimatePresence to standard conditional rendering to fix black screen */}
      {isTrashOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-50 dark:bg-slate-950 flex flex-col">
          <div className="p-6 flex items-center justify-between border-b dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setIsTrashOpen(false)} className="rounded-full">
                <X size={20} />
              </Button>
              <h2 className="text-xl font-bold">Trash Bin</h2>
            </div>
            <div className="flex gap-2">
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
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3">
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
      )}

      {isHiddenOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-50 dark:bg-slate-950 flex flex-col">
          <div className="p-6 flex items-center justify-between border-b dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setIsHiddenOpen(false)} className="rounded-full">
                <X size={20} />
              </Button>
              <h2 className="text-xl font-bold">Hidden Files</h2>
            </div>
            
            {(hiddenFiles || []).length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleBulkUnhide} className="rounded-xl gap-2 text-indigo-600 border-indigo-200">
                  <Eye size={16} /> {selectedHiddenIds.length > 0 ? 'Unhide Selected' : 'Unhide All'}
                </Button>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-3">
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
      )}

      {isTransfersOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-50 dark:bg-slate-950 flex flex-col">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setIsTransfersOpen(false)} className="rounded-full">
                <X size={20} />
              </Button>
              <div>
                <h2 className="text-xl font-bold">Upload History</h2>
                <p className="text-xs text-slate-400">{uploadHistory.length} uploads recorded</p>
              </div>
            </div>
            {uploadHistory.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearUploadHistory} className="rounded-xl text-slate-500 border-slate-200">
                Clear All
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {uploadHistory.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                  <History size={40} />
                </div>
                <p className="font-semibold">No uploads yet</p>
                <p className="text-xs text-center text-slate-400">Your upload history will appear here</p>
              </div>
            ) : (
              uploadHistory.map((item, idx) => {
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
            )}
          </div>
        </div>
      )}

      {isProfileOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-50 dark:bg-slate-950 flex flex-col">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setIsProfileOpen(false)} className="rounded-full"><X size={20} /></Button>
              <h2 className="text-xl font-bold">Profile Settings</h2>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="flex flex-col items-center gap-4 py-8 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
              <Avatar className="w-24 h-24 rounded-3xl ring-4 ring-blue-500/20">
                <AvatarImage src={user?.picture} referrerPolicy="no-referrer" />
                <AvatarFallback className="bg-blue-600 text-white text-3xl font-bold">{user?.name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <h3 className="text-xl font-bold">{user?.name || 'User'}</h3>
                <p className="text-sm text-slate-500">{user?.email || 'No email'}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input defaultValue={user?.name} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 h-12 w-full" />
              </div>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input defaultValue={user?.email} disabled className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-800 px-4 h-12 w-full" />
              </div>
            </div>
            <Button onClick={() => {toast.success('Profile updated'); setIsProfileOpen(false)}} className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 font-bold text-lg">Save Changes</Button>
          </div>
        </div>
      )}

      {isNotificationsOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-50 dark:bg-slate-950 flex flex-col">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setIsNotificationsOpen(false)} className="rounded-full"><X size={20} /></Button>
              <h2 className="text-xl font-bold">Notifications</h2>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
      )}

      {isSecurityOpen && (
        <div className="fixed inset-0 z-[500] bg-slate-50 dark:bg-slate-950 flex flex-col">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setIsSecurityOpen(false)} className="rounded-full"><X size={20} /></Button>
              <h2 className="text-xl font-bold">Security & Privacy</h2>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-3 text-blue-600 font-semibold mb-2">
                <Shield size={20} />
                <h3>Account Security</h3>
              </div>
              <div className="flex items-center justify-between">
                <Label>Two-Factor Authentication</Label>
                <Switch checked={secTwoFactor} onCheckedChange={setSecTwoFactor} className="data-[state=checked]:bg-blue-600" />
              </div>
              <div className="flex items-center justify-between">
                <Label>Biometric Login</Label>
                <Switch checked={secBiometric} onCheckedChange={setSecBiometric} className="data-[state=checked]:bg-blue-600" />
              </div>
            </div>
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-3 text-indigo-600 font-semibold mb-2">
                <Info size={20} />
                <h3>Privacy Options</h3>
              </div>
              <div className="flex items-center justify-between">
                <Label>Hide from Shared Searches</Label>
                <Switch checked={privHideSearches} onCheckedChange={setPrivHideSearches} className="data-[state=checked]:bg-blue-600" />
              </div>
              <div className="flex items-center justify-between">
                <Label>Usage Analytics</Label>
                <Switch checked={privAnalytics} onCheckedChange={setPrivAnalytics} className="data-[state=checked]:bg-blue-600" />
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full rounded-2xl border-red-200 text-red-600 hover:bg-red-50 h-12"
              onClick={() => {
                setSecTwoFactor(false);
                setSecBiometric(true);
                setPrivHideSearches(false);
                setPrivAnalytics(true);
                toast.success('Security settings reset');
              }}
            >
              Reset Security Settings
            </Button>
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

