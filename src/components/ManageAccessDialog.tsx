import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { FileItem } from '../types';
import { X, Users, Loader2, UserMinus, Shield, Globe, Lock, ShieldCheck, Link, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

interface PermissionList {
  id: string;
  emailAddress?: string;
  role: string;
  type: string;
  displayName?: string;
  photoLink?: string;
}

interface ManageAccessDialogProps {
  isOpen: boolean;
  onClose: () => void; // This will route back to Screen 1
  file: FileItem | null;
  tokens: any;
  user: any;
}

export default function ManageAccessDialog({ isOpen, onClose, file, tokens, user }: ManageAccessDialogProps) {
  const [permissions, setPermissions] = useState<PermissionList[]>([]);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [changingGeneral, setChangingGeneral] = useState(false);
  const [showGeneralSelector, setShowGeneralSelector] = useState(false);

  // Android Back Gesture routing back to Screen 1
  useEffect(() => {
    if (!isOpen) return;

    const handleVaultBack = (e: any) => {
      e.preventDefault();
      onClose(); // In Screen 2, back gesture goes back to Screen 1
    };

    window.addEventListener('vault-back', handleVaultBack);
    return () => window.removeEventListener('vault-back', handleVaultBack);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && file && tokens) {
      fetchPermissions();
    } else {
      setPermissions([]);
      setShowGeneralSelector(false);
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
      } else {
        toast.error('Failed to load permissions');
      }
    } catch (err) {
      toast.error('Error loading permissions');
    }
    setLoading(false);
  };

  const handleRoleChange = async (permissionId: string, currentRole: string, newRole: string) => {
    if (newRole === 'remove') {
      await handleRemoveAccess(permissionId);
      return;
    }

    if (!file) return;
    setUpdatingId(permissionId);
    try {
      const res = await fetch(`/api/drive/files/${file.id}/permissions/${permissionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-tokens': JSON.stringify(tokens)
        },
        body: JSON.stringify({ role: newRole }),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Permission updated successfully');
        fetchPermissions();
      } else {
        toast.error('Failed to update permission');
      }
    } catch (err) {
      toast.error('Error updating permission');
    }
    setUpdatingId(null);
  };

  const handleRemoveAccess = async (permissionId: string) => {
    if (!file) return;
    setUpdatingId(permissionId);
    try {
      const res = await fetch(`/api/drive/files/${file.id}/permissions/${permissionId}`, {
        method: 'DELETE',
        headers: { 'x-goog-tokens': JSON.stringify(tokens) },
        credentials: 'include'
      });
      if (res.ok) {
        toast.success('Access revoked');
        setPermissions(prev => prev.filter(p => p.id !== permissionId));
      } else {
        toast.error('Failed to remove access');
      }
    } catch (err) {
      toast.error('Error removing access');
    }
    setUpdatingId(null);
  };

  const handleGeneralAccessChange = async (role: 'reader' | 'writer' | null) => {
    if (!file) return;
    setChangingGeneral(true);
    try {
      const res = await fetch(`/api/drive/files/${file.id}/permissions-anyone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-tokens': JSON.stringify(tokens)
        },
        body: JSON.stringify({ role }),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success(role ? 'Access updated to Anyone with the link' : 'Access updated to Restricted');
        setShowGeneralSelector(false);
        fetchPermissions();
      } else {
        toast.error('Failed to update general access');
      }
    } catch (err) {
      toast.error('Error updating general access');
    }
    setChangingGeneral(false);
  };

  const handleCopyLink = () => {
    if (!file || !file.webViewLink) {
      toast.error('Link not available');
      return;
    }
    navigator.clipboard.writeText(file.webViewLink).then(() => {
      toast.success('Sharing link copied to clipboard');
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
        
        {/* Custom Header (Screen 2 close triggers onClose which goes back to Screen 1) */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/60 w-full">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <ShieldCheck size={18} />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-white truncate">
              Manage access
            </DialogTitle>
          </div>
          
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-800/60 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all active:scale-90 shrink-0"
            aria-label="Back to share"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="mt-5 space-y-6">
          
          {/* People with Access Section */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              People with access
            </h4>
            
            <div className="max-h-[220px] overflow-y-auto space-y-3 pr-1 -mr-2">
              {loading ? (
                <div className="flex justify-center p-4"><Loader2 className="animate-spin text-slate-400" /></div>
              ) : (
                <>
                  {/* Owner */}
                  <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100/50 dark:border-slate-800/40">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {user?.picture ? (
                        <img src={user.picture} alt="Owner" className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold uppercase text-sm shrink-0">
                          {user?.name?.[0] || 'U'}
                        </div>
                      )}
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                          {user?.name || 'Owner'}
                        </span>
                        <span className="text-[10px] text-slate-500 truncate">{user?.email}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg select-none">
                      Owner
                    </span>
                  </div>

                  {/* Shared Users */}
                  {sharedUsers.map((perm) => (
                    <div key={perm.id} className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100/50 dark:border-slate-800/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {perm.photoLink ? (
                          <img src={perm.photoLink} alt="Avatar" className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold uppercase text-sm shrink-0">
                            {perm.displayName?.[0] || perm.emailAddress?.[0] || 'U'}
                          </div>
                        )}
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate">
                            {perm.displayName || 'Shared User'}
                          </span>
                          {perm.emailAddress && (
                            <span className="text-[10px] text-slate-500 truncate">{perm.emailAddress}</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 shrink-0">
                        {updatingId === perm.id ? (
                          <Loader2 size={14} className="animate-spin text-blue-500" />
                        ) : (
                          <select
                            value={perm.role === 'writer' ? 'writer' : 'reader'}
                            onChange={(e) => handleRoleChange(perm.id, perm.role, e.target.value)}
                            className="text-[11px] font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-850 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer focus:outline-none"
                          >
                            <option value="reader">Viewer</option>
                            <option value="writer">Editor</option>
                            <option value="remove">Remove</option>
                          </select>
                        )}
                      </div>
                    </div>
                  ))}

                  {sharedUsers.length === 0 && !loading && (
                    <p className="text-[11px] text-slate-400 py-1 text-center">No other users have access yet.</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* General Access Section */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/60">
            <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              General access
            </h4>
            
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/40 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 mt-0.5">
                  {anyoneAccess ? (
                    <Globe className="text-emerald-500" size={16} />
                  ) : (
                    <Lock className="text-slate-400" size={16} />
                  )}
                </div>
                
                <div className="min-w-0 flex-1">
                  <span className="font-bold text-xs text-slate-800 dark:text-slate-200 block">
                    {anyoneAccess ? 'Anyone with the link' : 'Restricted'}
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                    {anyoneAccess ? (
                      <span>
                        Anyone on the internet with this link can{' '}
                        {anyoneAccess.role === 'writer' ? 'Edit' : 'View'}
                      </span>
                    ) : (
                      'Only people added can open with the link'
                    )}
                  </span>
                </div>
              </div>

              {changingGeneral ? (
                <Loader2 size={14} className="animate-spin text-blue-500 shrink-0 self-center" />
              ) : (
                <button
                  onClick={() => setShowGeneralSelector(!showGeneralSelector)}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 self-center hover:underline shrink-0"
                >
                  Change
                </button>
              )}
            </div>

            {/* General Access Sub-Selector */}
            {showGeneralSelector && (
              <div className="p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/50 dark:border-blue-900/30 space-y-2 animate-in slide-in-from-top-2 duration-200">
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 block">Choose access type:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => handleGeneralAccessChange(null)}
                    className="p-2 rounded-xl text-center border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all"
                  >
                    Restricted
                  </button>
                  <button
                    onClick={() => handleGeneralAccessChange('reader')}
                    className="p-2 rounded-xl text-center border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all"
                  >
                    Anyone (Viewer)
                  </button>
                  <button
                    onClick={() => handleGeneralAccessChange('writer')}
                    className="p-2 rounded-xl text-center border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 transition-all"
                  >
                    Anyone (Editor)
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Footer (Back to Screen 1) */}
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
            className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 active:scale-95 transition-all text-xs"
          >
            Done
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
