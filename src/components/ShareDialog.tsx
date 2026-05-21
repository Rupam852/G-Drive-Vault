import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import { FileItem } from '../types';
import { X, Link, Users, Loader2, UserPlus, ShieldAlert, Check, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface PermissionList {
  id: string;
  emailAddress?: string;
  role: string;
  type: string;
  displayName?: string;
  photoLink?: string;
}

interface ShareDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onManageAccess: () => void;
  file: FileItem | null;
  tokens: any;
}

export default function ShareDialog({ isOpen, onClose, onManageAccess, file, tokens }: ShareDialogProps) {
  const [permissions, setPermissions] = useState<PermissionList[]>([]);
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<'reader' | 'writer'>('reader');
  const [addingEmail, setAddingEmail] = useState(false);

  // Android Hardware Back Gesture support
  useEffect(() => {
    if (!isOpen) return;

    const handleVaultBack = (e: any) => {
      e.preventDefault();
      onClose(); // Screen 1 back gesture closes the dialog completely
    };

    window.addEventListener('vault-back', handleVaultBack);
    return () => window.removeEventListener('vault-back', handleVaultBack);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && file && tokens) {
      fetchPermissions();
    } else {
      setPermissions([]);
      setNewEmail('');
    }
  }, [isOpen, file, tokens]);

  const fetchPermissions = async () => {
    if (!file) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/drive/files/${file.id}/permissions`, {
        headers: { 'x-goog-tokens': JSON.stringify(tokens) },
        credentials: 'include'
      });
      if (res.ok) {
        setPermissions(await res.json());
      }
    } catch (err) {
      console.error('Error fetching permissions in ShareDialog:', err);
    }
    setLoading(false);
  };

  const handleAddAccess = async () => {
    if (!newEmail || !file || !newEmail.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    setAddingEmail(true);
    try {
      const res = await fetch(`/api/drive/files/${file.id}/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-tokens': JSON.stringify(tokens)
        },
        body: JSON.stringify({ emailAddress: newEmail, role: newRole }),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success(`Access granted to ${newEmail} as ${newRole === 'reader' ? 'Viewer' : 'Editor'}`);
        setNewEmail('');
        fetchPermissions();
      } else {
        toast.error('Failed to add access');
      }
    } catch (err) {
      toast.error('Error adding access');
    }
    setAddingEmail(false);
  };

  const handleCopyLink = () => {
    if (!file || !file.webViewLink) {
      toast.error('Link not available for this file');
      return;
    }
    navigator.clipboard.writeText(file.webViewLink).then(() => {
      toast.success('Link copied to clipboard (Restricted)');
    }).catch(() => {
      toast.error('Failed to copy link');
    });
  };

  if (!file) return null;

  const owner = permissions.find(p => p.role === 'owner');
  const sharedUsers = permissions.filter(p => p.role !== 'owner' && p.type === 'user');
  const anyoneAccess = permissions.find(p => p.type === 'anyone');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[94vw] sm:max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 [&>button.absolute]:hidden">
        
        {/* Custom Header */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/60 w-full">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <UserPlus size={18} />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-white truncate">
              Share "{file.name}"
            </DialogTitle>
          </div>
          
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center justify-center text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all active:scale-90 shrink-0"
            aria-label="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-6">
          
          {/* Add People Section */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              Add people and groups
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="Add email address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="rounded-2xl border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 focus-visible:ring-blue-500 pr-24"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddAccess()}
                />
                
                {/* Role Switcher */}
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as 'reader' | 'writer')}
                  className="absolute right-2 top-1.5 bottom-1.5 rounded-xl border-0 bg-white dark:bg-slate-800 text-xs font-semibold px-2 py-0 focus:outline-none dark:text-slate-200 cursor-pointer"
                >
                  <option value="reader">Viewer</option>
                  <option value="writer">Editor</option>
                </select>
              </div>

              <Button
                onClick={handleAddAccess}
                disabled={addingEmail || !newEmail}
                className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold shrink-0 px-4"
              >
                {addingEmail ? <Loader2 size={16} className="animate-spin" /> : 'Share'}
              </Button>
            </div>
          </div>

          {/* Quick Access Overview */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={14} />
              People with access
            </h4>
            
            <div className="flex items-center gap-2">
              {loading ? (
                <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                  <Loader2 size={14} className="animate-spin text-blue-500" />
                  <span>Loading access list...</span>
                </div>
              ) : (
                <div className="flex -space-x-2.5 overflow-hidden">
                  {/* Owner Avatar */}
                  {owner && (
                    <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-blue-600 text-white flex items-center justify-center text-xs font-bold uppercase cursor-pointer" title={`${owner.displayName || 'Owner'} (Owner)`}>
                      {owner.photoLink ? (
                        <img src={owner.photoLink} alt="Owner" className="w-full h-full rounded-full" />
                      ) : (
                        owner.displayName?.[0] || 'O'
                      )}
                    </div>
                  )}

                  {/* Shared Users */}
                  {sharedUsers.slice(0, 3).map((u) => (
                    <div key={u.id} className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-xs font-bold uppercase" title={`${u.displayName || u.emailAddress} (${u.role})`}>
                      {u.photoLink ? (
                        <img src={u.photoLink} alt="User" className="w-full h-full rounded-full" />
                      ) : (
                        u.displayName?.[0] || u.emailAddress?.[0] || 'U'
                      )}
                    </div>
                  ))}

                  {/* Overflow */}
                  {sharedUsers.length > 3 && (
                    <div className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center text-xs font-semibold">
                      +{sharedUsers.length - 3}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* General Access Overview */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/40 flex items-start gap-3">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 mt-0.5">
              {anyoneAccess ? <Shield className="text-emerald-500" size={20} /> : <ShieldAlert className="text-amber-500" size={20} />}
            </div>
            
            <div className="min-w-0 flex-1">
              <h5 className="text-xs font-bold text-slate-700 dark:text-slate-200">General access</h5>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                {anyoneAccess ? (
                  <span>
                    <strong>Anyone with the link</strong> can{' '}
                    {anyoneAccess.role === 'writer' ? 'Edit' : 'View'}
                  </span>
                ) : (
                  <span>
                    <strong>Restricted</strong> • Only people added can open with the link
                  </span>
                )}
              </p>
              
              <button
                onClick={onManageAccess}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mt-2 block transition-colors"
              >
                Manage access
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <DialogFooter className="mt-6 flex flex-row items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800/60 pt-4 w-full">
          <Button
            variant="outline"
            onClick={handleCopyLink}
            className="rounded-2xl border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 gap-2 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/40 active:scale-95 transition-all py-2 px-4 text-xs"
          >
            <Link size={14} />
            Copy link
          </Button>

          <Button
            onClick={onClose}
            className="rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-semibold px-6 active:scale-95 transition-all text-xs"
          >
            Done
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
