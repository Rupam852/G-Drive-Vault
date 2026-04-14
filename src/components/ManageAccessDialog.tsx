import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import { FileItem } from '../types';
import { Users, Loader2, UserMinus, Shield } from 'lucide-react';
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
  onClose: () => void;
  file: FileItem | null;
  tokens: any;
}

export default function ManageAccessDialog({ isOpen, onClose, file, tokens }: ManageAccessDialogProps) {
  const [permissions, setPermissions] = useState<PermissionList[]>([]);
  const [loading, setLoading] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);

  useEffect(() => {
    if (isOpen && file && tokens) {
      if (file.webViewLink) {
        navigator.clipboard.writeText(file.webViewLink).then(() => {
          toast.success('Share link copied to clipboard');
        }).catch(() => {
          toast.error('Failed to copy share link');
        });
      }
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
      } else {
        toast.error('Failed to load permissions');
      }
    } catch (err) {
      toast.error('Error loading permissions');
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
        body: JSON.stringify({ emailAddress: newEmail, role: 'reader' }),
        credentials: 'include'
      });
      if (res.ok) {
        toast.success(`Access granted to ${newEmail}`);
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

  const handleRemoveAccess = async (permissionId: string) => {
    if (!file) return;
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
  };

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px] w-[95vw] rounded-3xl p-0 overflow-hidden bg-white dark:bg-slate-900 border-0 shadow-2xl">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 border-b border-slate-100 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Users className="text-blue-500" />
              Manage Access
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500 mt-2 truncate">
            {file.name}
          </p>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex gap-2">
            <Input 
              placeholder="Add people via email" 
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              className="rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
              onKeyDown={(e) => e.key === 'Enter' && handleAddAccess()}
            />
            <Button 
              onClick={handleAddAccess} 
              disabled={addingEmail || !newEmail}
              className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
            >
              {addingEmail ? <Loader2 size={16} className="animate-spin" /> : 'Share'}
            </Button>
          </div>

          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Shield size={16} className="text-slate-400" />
              People with access
            </h4>
            
            <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 -mr-2">
              {loading ? (
                <div className="flex justify-center p-4"><Loader2 className="animate-spin text-slate-400" /></div>
              ) : permissions.length === 0 ? (
                <p className="text-sm text-slate-500">No one has been added yet.</p>
              ) : (
                permissions.map((perm) => (
                  <div key={perm.id} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 transition-colors">
                    <div className="flex items-center gap-3 overflow-hidden">
                      {perm.photoLink ? (
                        <img src={perm.photoLink} alt="Avatar" className="w-10 h-10 rounded-full bg-slate-200" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold uppercase">
                          {perm.displayName?.[0] || perm.emailAddress?.[0] || 'U'}
                        </div>
                      )}
                      <div className="flex flex-col truncate">
                        <span className="font-medium text-sm truncate dark:text-slate-200">
                          {perm.displayName || 'Unknown User'}
                        </span>
                        {perm.emailAddress ? (
                          <span className="text-xs text-slate-500 truncate">{perm.emailAddress}</span>
                        ) : (
                          <span className="text-[10px] text-slate-400 uppercase tracking-wide">{perm.type}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 ml-3">
                      <span className="text-xs font-medium text-slate-500 bg-white dark:bg-slate-900 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 capitalize">
                        {perm.role}
                      </span>
                      {perm.role !== 'owner' && (
                        <button 
                          onClick={() => handleRemoveAccess(perm.id)}
                          className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                          title="Remove access"
                        >
                          <UserMinus size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
          <Button variant="ghost" onClick={onClose} className="rounded-xl w-full">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
