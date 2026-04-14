import { User, Bell, Shield, Cloud, Info, LogOut, ChevronRight, Moon, Sun, Trash2, RotateCcw, X, CheckCircle2, EyeOff, Eye, SendToBack, HardDrive } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { FileItem } from '../types';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
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
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [isHiddenOpen, setIsHiddenOpen] = useState(false);
  const [isTransfersOpen, setIsTransfersOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isSecurityOpen, setIsSecurityOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedHiddenIds, setSelectedHiddenIds] = useState<string[]>([]);

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
      const idsToRestore = selectedIds.length > 0 ? selectedIds : trashedFiles.map(f => f.id);
      if (idsToRestore.length === 0) return;
      
      await Promise.all(idsToRestore.map(id => onRestore(id)));
      setSelectedIds([]);
      toast.success(`Restored ${idsToRestore.length} items`);
    } catch (err) {
      toast.error('Failed to restore some items');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const idsToDelete = selectedIds.length > 0 ? selectedIds : trashedFiles.map(f => f.id);
      if (idsToDelete.length === 0) return;

      await Promise.all(idsToDelete.map(id => onPermanentDelete(id)));
      setSelectedIds([]);
      toast.success(`Permanently deleted ${idsToDelete.length} items`);
    } catch (err) {
      toast.error('Failed to delete some items');
    }
  };

  const handleBulkUnhide = async () => {
    try {
      const idsToUnhide = selectedHiddenIds.length > 0 ? selectedHiddenIds : hiddenFiles.map(f => f.id);
      if (idsToUnhide.length === 0) return;
      
      await onUnhide(idsToUnhide);
      setSelectedHiddenIds([]);
    } catch (err) {
      toast.error('Failed to unhide some items');
    }
  };

  const menuItems = [
    { icon: User, label: 'Profile Settings', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', onClick: () => setIsProfileOpen(true) },
    { icon: SendToBack, label: 'Transfer History', color: 'text-sky-500', bg: 'bg-sky-50 dark:bg-sky-900/20', onClick: () => setIsTransfersOpen(true) },
    { icon: Trash2, label: 'Trash Bin', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', onClick: () => setIsTrashOpen(true) },
    { icon: EyeOff, label: 'Hidden Files', color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-900/20', onClick: () => setIsHiddenOpen(true) },
    { icon: Bell, label: 'Notifications', color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', onClick: () => setIsNotificationsOpen(true) },
    { icon: Shield, label: 'Security & Privacy', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', onClick: () => setIsSecurityOpen(true) },
    { icon: HardDrive, label: 'File Permission', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', toggle: true, checked: isDownloadEnabled, onChange: setIsDownloadEnabled },
    { icon: isDarkMode ? Sun : Moon, label: 'Dark Mode', color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-800', toggle: true },
  ];

  return (
    <div className="p-6 pb-24 space-y-8 bg-slate-50 dark:bg-slate-950 min-h-screen transition-colors">
      <header className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Settings</h1>
        
        <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
          <CardContent className="p-4 flex items-center gap-4">
            <Avatar className="w-16 h-16 rounded-2xl">
              <AvatarImage src={user.picture} referrerPolicy="no-referrer" />
              <AvatarFallback className="bg-blue-600 text-white text-2xl font-bold rounded-2xl">
                {user.name?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 dark:text-white text-lg">{user.name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
            </div>
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl text-blue-600 dark:text-blue-400 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              EDIT
            </button>
          </CardContent>
        </Card>
      </header>

      <div className="space-y-2">
        {menuItems.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              onClick={item.onClick}
              className={`w-full flex items-center gap-4 p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm transition-all ${item.onClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
            >
              <div className={`w-10 h-10 ${item.bg} ${item.color} rounded-xl flex items-center justify-center`}>
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

      <AnimatePresence>
        {isTrashOpen && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 flex flex-col"
          >
            <div className="p-6 flex items-center justify-between border-b dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setIsTrashOpen(false)} className="rounded-full">
                  <X size={20} />
                </Button>
                <h2 className="text-xl font-bold">Trash Bin</h2>
              </div>
              {selectedIds.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleBulkRestore} className="rounded-xl gap-2 text-blue-600 border-blue-200">
                    <RotateCcw size={16} /> {selectedIds.length > 0 ? 'Restore Selected' : 'Restore All'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleBulkDelete} className="rounded-xl gap-2 text-red-600 border-red-200">
                    <Trash2 size={16} /> {selectedIds.length > 0 ? 'Delete Selected' : 'Empty Trash'}
                  </Button>
                </div>
              )}
              {trashedFiles.length > 0 && selectedIds.length === 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleBulkRestore} className="rounded-xl gap-2 text-blue-600 border-blue-200">
                    <RotateCcw size={16} /> Restore All
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleBulkDelete} className="rounded-xl gap-2 text-red-600 border-red-200 bg-red-50 dark:bg-red-900/10">
                    <Trash2 size={16} /> Delete All
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {trashedFiles.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <Trash2 size={40} />
                  </div>
                  <p className="font-medium">Trash is empty</p>
                </div>
              ) : (
                trashedFiles.map((file) => (
                  <div
                    key={file.id}
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
                      {selectedIds.includes(file.id) && <CheckCircle2 size={14} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{file.name}</h4>
                      <p className="text-xs text-slate-500">{file.type === 'folder' ? 'Folder' : file.size} • Trashed on {file.date}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHiddenOpen && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            className="fixed inset-0 z-[100] bg-slate-50 dark:bg-slate-950 flex flex-col"
          >
            <div className="p-6 flex items-center justify-between border-b dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => setIsHiddenOpen(false)} className="rounded-full">
                  <X size={20} />
                </Button>
                <h2 className="text-xl font-bold">Hidden Files</h2>
              </div>
              
              {hiddenFiles.length > 0 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleBulkUnhide} className="rounded-xl gap-2 text-indigo-600 border-indigo-200">
                    <Eye size={16} /> {selectedHiddenIds.length > 0 ? 'Unhide Selected' : 'Unhide All'}
                  </Button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {hiddenFiles.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <EyeOff size={40} />
                  </div>
                  <p className="font-medium">No hidden files</p>
                </div>
              ) : (
                hiddenFiles.map((file) => (
                  <div
                    key={file.id}
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
                      {selectedHiddenIds.includes(file.id) && <CheckCircle2 size={14} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium truncate">{file.name}</h4>
                      <p className="text-xs text-slate-500">{file.type === 'folder' ? 'Folder' : file.size} • Hidden</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isTransfersOpen && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[60] bg-white dark:bg-slate-900 flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setIsTransfersOpen(false)} className="rounded-full">
                  <X size={20} />
                </Button>
                <h2 className="text-xl font-bold">Transfer History</h2>
              </div>
              {transfers.length > 0 && (
                <Button variant="outline" size="sm" onClick={onClearTransfers} className="rounded-xl text-slate-500 border-slate-200">
                  Clear All
                </Button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {transfers.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                    <SendToBack size={40} />
                  </div>
                  <p className="font-medium">No recent transfers.</p>
                </div>
              ) : (
                transfers.slice().reverse().map(transfer => (
                  <div key={transfer.id} className="flex flex-col gap-2 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate pr-4 text-slate-900 dark:text-slate-100">{transfer.name}</span>
                      <span className="text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide bg-white dark:bg-slate-900 shrink-0">
                        {transfer.status}
                      </span>
                    </div>
                    {transfer.status === 'uploading' && (
                      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden mt-2">
                        <div 
                          className="bg-blue-500 h-full rounded-full transition-all duration-300"
                          style={{ width: `${transfer.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isProfileOpen && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[110] bg-slate-50 dark:bg-slate-950 flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setIsProfileOpen(false)} className="rounded-full"><X size={20} /></Button>
                <h2 className="text-xl font-bold">Profile Settings</h2>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex flex-col items-center gap-4 py-8 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800">
                <Avatar className="w-24 h-24 rounded-3xl ring-4 ring-blue-500/20">
                  <AvatarImage src={user.picture} referrerPolicy="no-referrer" />
                  <AvatarFallback className="bg-blue-600 text-white text-3xl font-bold">{user.name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="text-center">
                  <h3 className="text-xl font-bold">{user.name}</h3>
                  <p className="text-sm text-slate-500">{user.email}</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input defaultValue={user.name} className="rounded-xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 h-12 w-full" />
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input defaultValue={user.email} disabled className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-800 px-4 h-12 w-full" />
                </div>
              </div>
              <Button onClick={() => {toast.success('Profile updated'); setIsProfileOpen(false)}} className="w-full h-12 rounded-2xl bg-blue-600 hover:bg-blue-700 font-bold text-lg">Save Changes</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isNotificationsOpen && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[110] bg-slate-50 dark:bg-slate-950 flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setIsNotificationsOpen(false)} className="rounded-full"><X size={20} /></Button>
                <h2 className="text-xl font-bold">Notifications</h2>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {[
                { label: 'Push Notifications', desc: 'Receive alerts on your device', checked: true },
                { label: 'Email Alerts', desc: 'Get updates in your inbox', checked: true },
                { label: 'Shared File Activity', desc: 'When someone edits your file', checked: false },
                { label: 'Security Alerts', desc: 'Unusual login detection', checked: true }
              ].map((n, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
                  <div className="space-y-0.5">
                    <p className="font-medium">{n.label}</p>
                    <p className="text-xs text-slate-500">{n.desc}</p>
                  </div>
                  <Switch defaultChecked={n.checked} className="data-[state=checked]:bg-blue-600" />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSecurityOpen && (
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[110] bg-slate-50 dark:bg-slate-950 flex flex-col"
          >
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
                  <Switch className="data-[state=checked]:bg-blue-600" />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Biometric Login</Label>
                  <Switch defaultChecked className="data-[state=checked]:bg-blue-600" />
                </div>
              </div>
              <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 space-y-4">
                <div className="flex items-center gap-3 text-indigo-600 font-semibold mb-2">
                  <Info size={20} />
                  <h3>Privacy Options</h3>
                </div>
                <div className="flex items-center justify-between">
                  <Label>Hide from Shared Searches</Label>
                  <Switch className="data-[state=checked]:bg-blue-600" />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Usage Analytics</Label>
                  <Switch defaultChecked className="data-[state=checked]:bg-blue-600" />
                </div>
              </div>
              <Button variant="outline" className="w-full rounded-2xl border-red-200 text-red-600 hover:bg-red-50 h-12">Reset Security Settings</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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

