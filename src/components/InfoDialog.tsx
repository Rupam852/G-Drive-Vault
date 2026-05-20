import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FileItem } from '../types';
import { X, FileText, Folder, Calendar, Clock, HardDrive, Info } from 'lucide-react';

interface InfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileItem | null;
  breadcrumb: { id: string; name: string }[];
}

export default function InfoDialog({ isOpen, onClose, file, breadcrumb }: InfoDialogProps) {
  if (!file) return null;

  // Format date and time
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return { date: '--', time: '--' };
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) return { date: '--', time: '--' };
    
    return {
      date: dateObj.toLocaleDateString(undefined, { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      time: dateObj.toLocaleTimeString(undefined, { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit'
      })
    };
  };

  const created = formatDateTime(file.createdTime);
  const modified = formatDateTime(file.modifiedTime || file.createdTime);

  // Determine parent folder path (file root)
  const getFolderPath = () => {
    if (breadcrumb.length > 0) {
      if (file.type === 'folder') {
        const parentPath = breadcrumb.slice(0, -1).map(b => b.name).join(' / ');
        return parentPath || 'My Drive';
      } else {
        const currentPath = breadcrumb.map(b => b.name).join(' / ');
        return currentPath || 'My Drive';
      }
    }
    return 'My Drive';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[94vw] sm:max-w-md bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-3xl p-6 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200 [&>button.absolute]:hidden">
        
        {/* Custom Header with Cancel Icon in Top Right */}
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/60 w-full min-w-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Info size={18} />
            </div>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-white truncate">
               Details & Info
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

        {/* Info Grid Content */}
        <div className="mt-5 space-y-5 min-w-0 w-full">
          {/* File/Folder preview block */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/40 flex items-center gap-4 min-w-0">
            <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white shadow-md">
              {file.type === 'folder' ? <Folder size={24} className="fill-white/10" /> : <FileText size={24} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-white break-words break-all line-clamp-2" title={file.name}>
                {file.name}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                {file.type === 'folder' ? 'Folder' : `File • ${file.size}`}
              </p>
            </div>
          </div>

          <div className="space-y-4 min-w-0 w-full">
            {/* 1. File Name */}
            <div className="flex flex-col gap-1 w-full min-w-0">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">File Name</span>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200 break-words break-all select-all w-full">
                {file.name}
              </div>
            </div>

            {/* 2. File Root */}
            <div className="flex flex-col gap-1 w-full min-w-0">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">File Root</span>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 min-w-0">
                <HardDrive size={14} className="text-slate-400 shrink-0" />
                <span className="truncate flex-1">{getFolderPath()}</span>
              </div>
            </div>

            {/* 3. Last Modified */}
            <div className="flex flex-col gap-1 w-full min-w-0">
              <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Last Modified</span>
              <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 dark:text-slate-200 flex-wrap">
                <Calendar size={14} className="text-slate-400 shrink-0" />
                <span>{modified.date}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">•</span>
                <Clock size={14} className="text-slate-400 shrink-0" />
                <span>{modified.time}</span>
              </div>
            </div>

          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
