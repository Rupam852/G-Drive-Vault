import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FolderOpen, Eye, Download, Archive, Star, Edit2, 
  Move, Share2, Info, EyeOff, Check, Trash2, X, 
  Image, Video, FileText, Music, Smartphone, Folder, 
  FileQuestion, FileArchive, File as GenericFile
} from 'lucide-react';
import { FileItem } from '@/src/types';

interface FileActionBottomSheetProps {
  file: FileItem | null;
  isOpen: boolean;
  onClose: () => void;
  onOpen: (file: FileItem) => void;
  onDownload: (file: FileItem) => void;
  onRename: (file: FileItem) => void;
  onMove?: (file: FileItem) => void;
  onStar?: (id: string, starred: boolean) => void;
  onShare?: (id: string) => void;
  onDelete?: (id: string) => void;
  onShowInfo?: (file: FileItem) => void;
  onHide?: (id: string) => void;
  onSelect?: (file: FileItem) => void;
}

const iconMap: Record<string, any> = {
  image: Image,
  video: Video,
  document: FileText,
  audio: Music,
  apk: Smartphone,
  folder: Folder,
  archive: FileArchive,
  other: FileQuestion,
};

const categoryThemeMap: Record<string, { textColor: string; bgColor: string }> = {
  image: { textColor: 'text-blue-500 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/50' },
  video: { textColor: 'text-purple-500 dark:text-purple-400', bgColor: 'bg-purple-50 dark:bg-purple-950/50' },
  document: { textColor: 'text-amber-500 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-950/50' },
  audio: { textColor: 'text-emerald-500 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-950/50' },
  apk: { textColor: 'text-teal-500 dark:text-teal-400', bgColor: 'bg-teal-50 dark:bg-teal-950/50' },
  folder: { textColor: 'text-yellow-500 dark:text-yellow-400', bgColor: 'bg-yellow-50 dark:bg-yellow-950/50' },
  archive: { textColor: 'text-rose-500 dark:text-rose-400', bgColor: 'bg-rose-50 dark:bg-rose-950/50' },
  other: { textColor: 'text-slate-500 dark:text-slate-400', bgColor: 'bg-slate-100 dark:bg-slate-800' },
};

export default function FileActionBottomSheet({
  file,
  isOpen,
  onClose,
  onOpen,
  onDownload,
  onRename,
  onMove,
  onStar,
  onShare,
  onDelete,
  onShowInfo,
  onHide,
  onSelect,
}: FileActionBottomSheetProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const handleBack = () => onClose();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('vault-back', handleBack);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('vault-back', handleBack);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !file) return null;

  const isFolder = file.type === 'folder';
  const IconComponent = iconMap[file.type] || GenericFile;
  const theme = categoryThemeMap[file.type] || categoryThemeMap.other;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Modal / Sheet Container */}
        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 32, stiffness: 380 }}
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-[32px] sm:rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden max-h-[88vh] flex flex-col"
        >
          {/* Mobile Drag Pill */}
          <div className="pt-3 pb-1 flex justify-center sm:hidden shrink-0">
            <div className="w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full" />
          </div>

          {/* ── File Header Info Card (matches Android) ── */}
          <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${theme.bgColor} ${theme.textColor}`}>
                <IconComponent size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base truncate leading-snug">
                  {file.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  {isFolder ? 'Folder' : file.size} {file.date ? `• ${file.date}` : ''}
                </p>
              </div>
              <button 
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors shrink-0"
                aria-label="Close action sheet"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ── Actions List (Scrollable) ── */}
          <div className="p-3 sm:p-4 overflow-y-auto space-y-1 overscroll-contain">
            {/* Open / Preview */}
            <button
              onClick={() => { onClose(); onOpen(file); }}
              className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left group active:scale-[0.99]"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0 group-hover:scale-105 transition-transform">
                {isFolder ? <FolderOpen size={20} /> : <Eye size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block">
                  {isFolder ? 'Open Folder' : 'Open & Preview'}
                </span>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                  {isFolder ? 'View folder contents' : 'View file in-app viewer'}
                </p>
              </div>
            </button>

            {/* Download */}
            <button
              onClick={() => { onClose(); onDownload(file); }}
              className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left group active:scale-[0.99]"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
                isFolder 
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400' 
                  : 'bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400'
              }`}>
                {isFolder ? <Archive size={20} /> : <Download size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block">
                  {isFolder ? 'Download as ZIP' : 'Download to Device'}
                </span>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                  {isFolder ? 'Download all files as .zip archive' : 'High-speed edge download'}
                </p>
              </div>
            </button>

            {/* Star / Unstar */}
            {onStar && (
              <button
                onClick={() => { onClose(); onStar(file.id, !file.starred); }}
                className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left group active:scale-[0.99]"
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform ${
                  file.starred 
                    ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-500' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                }`}>
                  <Star size={20} className={file.starred ? 'fill-amber-500 text-amber-500' : ''} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block">
                    {file.starred ? 'Remove from Starred' : 'Add to Starred'}
                  </span>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    {file.starred ? 'Remove favorite star' : 'Add to favorites for quick access'}
                  </p>
                </div>
              </button>
            )}

            {/* Rename */}
            <button
              onClick={() => { onClose(); onRename(file); }}
              className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left group active:scale-[0.99]"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 group-hover:scale-105 transition-transform">
                <Edit2 size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block">
                  Rename
                </span>
                <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                  Change file or folder name
                </p>
              </div>
            </button>

            {/* Move */}
            {onMove && (
              <button
                onClick={() => { onClose(); onMove(file); }}
                className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left group active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/60 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Move size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block">
                    Move
                  </span>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    Change folder location
                  </p>
                </div>
              </button>
            )}

            {/* Share */}
            {onShare && (
              <button
                onClick={() => { onClose(); onShare(file.id); }}
                className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left group active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-950/60 flex items-center justify-center text-green-600 dark:text-green-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Share2 size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block">
                    Share
                  </span>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    Copy view link or manage permissions
                  </p>
                </div>
              </button>
            )}

            {/* Select (for bulk actions) */}
            {onSelect && (
              <button
                onClick={() => { onClose(); onSelect(file); }}
                className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left group active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Check size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block">
                    Select Item
                  </span>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    Enable multi-select mode for batch actions
                  </p>
                </div>
              </button>
            )}

            {/* Details & Info */}
            {onShowInfo && (
              <button
                onClick={() => { onClose(); onShowInfo(file); }}
                className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left group active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Info size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block">
                    Details & Info
                  </span>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    View full file properties, dimensions & dates
                  </p>
                </div>
              </button>
            )}

            {/* Hide / Unhide */}
            {onHide && (
              <button
                onClick={() => { onClose(); onHide(file.id); }}
                className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors text-left group active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 shrink-0 group-hover:scale-105 transition-transform">
                  <EyeOff size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors block">
                    {file.isHidden ? 'Unhide' : 'Hide'}
                  </span>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                    Toggle visibility in standard explorer views
                  </p>
                </div>
              </button>
            )}

            <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-2" />

            {/* Delete / Trash */}
            {onDelete && (
              <button
                onClick={() => { onClose(); onDelete(file.id); }}
                className="w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl hover:bg-red-50/80 dark:hover:bg-red-950/40 transition-colors text-left group active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0 group-hover:scale-105 transition-transform">
                  <Trash2 size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-sm text-red-600 dark:text-red-400 block">
                    Delete
                  </span>
                  <p className="text-xs text-red-400/80 dark:text-red-400/60 truncate mt-0.5">
                    Move item to trash
                  </p>
                </div>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
