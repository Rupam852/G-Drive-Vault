import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FileItem } from '../types';
import { Folder } from 'lucide-react';
import { useState } from 'react';

interface MoveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (newParentId: string) => void;
  file: FileItem | null;
  folders: FileItem[];
  currentFolderId: string;
}

export default function MoveDialog({ isOpen, onClose, onConfirm, file, folders, currentFolderId }: MoveDialogProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');

  const handleConfirm = () => {
    if (selectedFolderId) {
      onConfirm(selectedFolderId);
      onClose();
      setSelectedFolderId('');
    }
  };

  if (!file) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] w-[90vw] rounded-2xl">
        <DialogHeader>
          <DialogTitle>Move "{file.name}"</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Select a destination folder to move this item.
          </p>
          
          <div className="max-h-60 overflow-y-auto space-y-2 p-2 border rounded-xl dark:border-slate-800">
            <button
              onClick={() => setSelectedFolderId('root')}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                selectedFolderId === 'root' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Folder size={20} className={selectedFolderId === 'root' ? 'text-blue-500' : 'text-slate-400'} />
              <span className="font-medium text-sm flex-1">My Drive (Root)</span>
              {currentFolderId === 'root' && <span className="text-xs text-slate-400">(Current)</span>}
            </button>
            
            {folders.filter(f => f.id !== file.id).map(folder => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                  selectedFolderId === folder.id ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Folder size={20} className={selectedFolderId === folder.id ? 'text-blue-500' : 'text-slate-400'} />
                <span className="font-medium text-sm flex-1 truncate">{folder.name}</span>
                {currentFolderId === folder.id && <span className="text-xs text-slate-400">(Current)</span>}
              </button>
            ))}
            
            {folders.filter(f => f.id !== file.id).length === 0 && (
              <p className="text-center text-sm text-slate-400 py-4">No other folders available here.</p>
            )}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleConfirm} disabled={!selectedFolderId || selectedFolderId === currentFolderId} className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white">
            Move Here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
