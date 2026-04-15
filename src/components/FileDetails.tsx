import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { FileItem } from '../types';
import { Image, Video, FileText, Music, File, Trash2, Share2, Info, Calendar, HardDrive, Maximize2, Minimize2, X, ExternalLink, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://g-drive-vault.vercel.app';

interface FileDetailsProps {
  file: FileItem | null;
  isOpen: boolean;
  tokens: any;
  onClose: () => void;
  onDelete: (id: string) => void;
  onShare?: (id: string) => void;
}

const iconMap = {
  image: Image,
  video: Video,
  document: FileText,
  audio: Music,
  other: File,
};

/** Build the best possible preview URL for a given file, using Google APIs directly */
function buildPreviewUrl(file: FileItem, tokens: any): string | null {
  const accessToken = tokens?.access_token;
  if (!accessToken) return null;

  // Google Drive direct media URL — works for images, video, audio, binary files
  // No proxy needed; just pass the access_token as a query param
  const directMedia = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&access_token=${accessToken}`;

  switch (file.type) {
    case 'image':
      // Use high-res thumbnail if available (no auth needed for thumbnails)
      if (file.thumbnail) return file.thumbnail.replace('=s220', '=s1600');
      return directMedia;

    case 'video':
    case 'audio':
      // Stream directly from Google
      return directMedia;

    case 'document': {
      // Google Docs/Sheets/Slides → export as PDF
      const mimeType = (file as any).mimeType || '';
      if (mimeType.includes('vnd.google-apps')) {
        return `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=application%2Fpdf&access_token=${accessToken}`;
      }
      // PDFs and other docs → direct media
      return directMedia;
    }

    default:
      return directMedia;
  }
}

/** For iframe-based previews (docs/PDFs), use Google's Drive Viewer as a fallback */
function buildGoogleViewerUrl(fileId: string, accessToken: string): string {
  const directUrl = encodeURIComponent(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${accessToken}`
  );
  return `https://docs.google.com/viewer?url=${directUrl}&embedded=true`;
}

export default function FileDetails({ file, isOpen, tokens, onClose, onDelete, onShare }: FileDetailsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) setIsExpanded(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isExpanded]);

  // Handle hardware back button for Android
  useEffect(() => {
    if (!isOpen) return;
    const handleVaultBack = (e: any) => {
      e.preventDefault();
      if (isExpanded) setIsExpanded(false);
      else if (showDeleteConfirm) setShowDeleteConfirm(false);
      else onClose();
    };
    window.addEventListener('vault-back', handleVaultBack);
    return () => window.removeEventListener('vault-back', handleVaultBack);
  }, [isOpen, isExpanded, showDeleteConfirm, onClose]);

  // Build preview URLs immediately — no async/server needed
  useEffect(() => {
    if (file && isOpen && file.type !== 'folder') {
      setPreviewError(false);
      setIsLoading(true);

      const url = buildPreviewUrl(file, tokens);
      setPreviewUrl(url);

      // For documents, also build a Google Viewer URL as fallback
      if ((file.type === 'document' || file.type === 'other') && tokens?.access_token) {
        setIframeUrl(buildGoogleViewerUrl(file.id, tokens.access_token));
      } else {
        setIframeUrl(null);
      }

      // Give browser a moment then stop spinner
      setTimeout(() => setIsLoading(false), 400);
    } else {
      setPreviewUrl(null);
      setIframeUrl(null);
      setPreviewError(false);
    }
  }, [file?.id, isOpen, retryCount]);

  if (!file) return null;

  const Icon = iconMap[file.type as keyof typeof iconMap] || File;

  const handleDelete = () => {
    onDelete(file.id);
    toast.error(`${file.name} deleted`);
    onClose();
  };

  const handleShare = () => {
    if (onShare && file) {
      onShare(file.id);
      onClose();
    }
  };

  const handleOpenInDrive = () => {
    window.open(`https://drive.google.com/file/d/${file.id}/view`, '_blank');
  };

  const handleRetry = () => {
    setPreviewError(false);
    setRetryCount(c => c + 1);
  };

  // Render the actual preview media element
  const renderPreviewContent = (fullscreen = false) => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium">Loading preview...</p>
        </div>
      );
    }

    if (previewError) {
      return (
        <div className="flex flex-col items-center gap-4 text-slate-400 py-10 px-4">
          <Icon size={56} className="opacity-20" />
          <div className="text-center">
            <p className="text-sm font-bold text-slate-300">Preview failed</p>
            <p className="text-xs text-slate-500 mt-1">Try opening in Google Drive</p>
          </div>
          <div className="flex gap-3 flex-wrap justify-center">
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 text-xs font-bold text-blue-400 border border-blue-400/30 px-4 py-2 rounded-full hover:bg-blue-400/10 transition-colors"
            >
              <RefreshCw size={12} /> Retry
            </button>
            <button
              onClick={handleOpenInDrive}
              className="flex items-center gap-2 text-xs font-bold text-slate-300 border border-slate-600 px-4 py-2 rounded-full hover:bg-slate-700 transition-colors"
            >
              <ExternalLink size={12} /> Open in Drive
            </button>
          </div>
        </div>
      );
    }

    if (!previewUrl) {
      return (
        <div className="flex flex-col items-center gap-3 py-10 opacity-40">
          <Icon size={64} />
          <p className="text-[10px] uppercase font-bold tracking-[0.2em]">Preview Unavailable</p>
        </div>
      );
    }

    if (file.type === 'image') {
      return (
        <img
          src={previewUrl}
          className={`${fullscreen ? 'max-w-full max-h-full' : 'w-full h-full'} object-contain bg-black`}
          alt={file.name}
          referrerPolicy="no-referrer"
          onError={() => setPreviewError(true)}
          onLoad={() => setIsLoading(false)}
        />
      );
    }

    if (file.type === 'video') {
      return (
        <video
          src={previewUrl}
          className="w-full h-full object-contain bg-black"
          poster={file.thumbnail?.replace('=s220', '=s1000')}
          controls={fullscreen}
          autoPlay={fullscreen}
          playsInline
          muted={!fullscreen}
          onError={() => setPreviewError(true)}
        />
      );
    }

    if (file.type === 'audio') {
      return (
        <div className="flex flex-col items-center gap-6 p-8 w-full">
          <div className="w-24 h-24 rounded-3xl bg-green-500/10 flex items-center justify-center text-green-400">
            <Music size={48} />
          </div>
          <p className="text-white font-bold text-center truncate max-w-full">{file.name}</p>
          <audio
            src={previewUrl}
            controls
            autoPlay={fullscreen}
            className="w-full max-w-sm"
            onError={() => setPreviewError(true)}
          />
        </div>
      );
    }

    // Documents and other types → try iframe with Google Viewer
    const src = iframeUrl || previewUrl;
    return (
      <iframe
        src={src}
        className="w-full h-full border-none"
        title="File Preview"
        loading="lazy"
        onError={() => {
          // If Google Viewer fails, fall back to direct URL
          if (src === iframeUrl && previewUrl) {
            setIframeUrl(null);
          } else {
            setPreviewError(true);
          }
        }}
        style={{ background: 'white' }}
      />
    );
  };

  return (
    <>
      <Dialog open={isOpen && !isExpanded} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] sm:max-w-lg bg-[#0F172A] border-slate-800 text-white rounded-[2rem] overflow-hidden p-0 gap-0 shadow-2xl">
          <div className="p-6 pb-0">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                <Icon size={22} />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-bold truncate max-w-[200px] sm:max-w-[300px]">{file.name}</h2>
                <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">File Details</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Preview area */}
            <div
              className={`
                ${file.type === 'video' ? 'aspect-video' : file.type === 'document' ? 'aspect-[3/4] max-h-[400px]' : file.type === 'audio' ? 'h-auto' : 'aspect-square max-h-[280px]'}
                w-full bg-[#1e293b]/50 rounded-2xl flex items-center justify-center text-slate-700 overflow-hidden border border-slate-800/50 relative group cursor-pointer
              `}
              onClick={() => !previewError && setIsExpanded(true)}
            >
              {renderPreviewContent(false)}

              {!previewError && !isLoading && previewUrl && (
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                  <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-white flex items-center gap-2">
                    <Maximize2 size={18} />
                    <span className="text-xs font-bold">Tap to Fullscreen</span>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-y-6 px-1">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 font-extrabold flex items-center gap-1.5">
                  <HardDrive size={12} /> Size
                </p>
                <p className="text-xl font-black text-white">{file.size}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 font-extrabold flex items-center gap-1.5">
                  <Calendar size={12} /> Date
                </p>
                <p className="text-xl font-black text-white">{file.date}</p>
              </div>
              <div className="col-span-2 space-y-1">
                <p className="text-[11px] uppercase tracking-[0.15em] text-slate-500 font-extrabold flex items-center gap-1.5">
                  <Info size={12} /> Type
                </p>
                <p className="text-xl font-black text-white capitalize">{file.type}</p>
              </div>
            </div>
          </div>

          <div className="p-6 pt-2 space-y-3 bg-white/5 border-t border-slate-800/50">
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="rounded-2xl h-14 border-slate-800 bg-transparent text-white hover:bg-slate-800 font-bold"
                onClick={handleShare}
              >
                <Share2 size={20} className="mr-2" /> Share
              </Button>
              <Button
                variant="outline"
                className="rounded-2xl h-14 border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 font-bold"
                onClick={() => setIsExpanded(true)}
              >
                <Maximize2 size={20} className="mr-2" /> View
              </Button>
            </div>
            <Button
              variant="destructive"
              className="w-full rounded-2xl h-14 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 font-bold shadow-none"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={20} className="mr-2" /> Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* IMMERSIVE FULLSCREEN OVERLAY */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-3xl flex flex-col md:p-6"
          >
            <div className="flex items-center justify-between p-4 md:p-0 mb-4 z-10 w-full max-w-7xl mx-auto">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl text-white">
                  <Icon size={20} />
                </div>
                <h2 className="text-white font-bold truncate max-w-[200px]">{file.name}</h2>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleOpenInDrive}
                  className="h-10 px-3 rounded-full bg-white/10 hover:bg-white/20 text-white border-none text-xs font-bold gap-1.5"
                >
                  <ExternalLink size={14} /> Drive
                </Button>
                <Button
                  onClick={() => setIsExpanded(false)}
                  className="h-10 w-10 p-0 rounded-full bg-white/10 hover:bg-white/20 text-white border-none"
                >
                  <Minimize2 size={20} />
                </Button>
                <Button
                  onClick={() => { setIsExpanded(false); onClose(); }}
                  className="h-10 w-10 p-0 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border-none"
                >
                  <X size={20} />
                </Button>
              </div>
            </div>

            <div className="flex-1 w-full bg-[#0F172A]/50 rounded-[2.5rem] overflow-hidden flex items-center justify-center relative max-w-7xl mx-auto border border-white/5 shadow-2xl">
              {renderPreviewContent(true)}
            </div>

            <div className="p-6 flex justify-center gap-4 z-10">
              <button onClick={handleShare} className="flex flex-col items-center gap-1 group">
                <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-blue-500/20 transition-colors text-white group-hover:text-blue-400">
                  <Share2 size={24} />
                </div>
                <span className="text-[10px] font-bold text-slate-500 group-hover:text-white uppercase tracking-widest">Share</span>
              </button>
              <button onClick={handleOpenInDrive} className="flex flex-col items-center gap-1 group">
                <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-green-500/20 transition-colors text-white group-hover:text-green-400">
                  <ExternalLink size={24} />
                </div>
                <span className="text-[10px] font-bold text-slate-500 group-hover:text-white uppercase tracking-widest">Drive</span>
              </button>
              <button onClick={() => setShowDeleteConfirm(true)} className="flex flex-col items-center gap-1 group">
                <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-red-500/20 transition-colors text-white group-hover:text-red-400">
                  <Trash2 size={24} />
                </div>
                <span className="text-[10px] font-bold text-slate-500 group-hover:text-white uppercase tracking-widest">Delete</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DELETE CONFIRMATION */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-slate-900 border border-white/5 rounded-[2rem] p-8 shadow-2xl max-w-[320px]">
          <AlertDialogHeader className="flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-2">
              <Trash2 size={32} />
            </div>
            <AlertDialogTitle className="text-xl font-black text-white">Delete File?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 text-sm leading-relaxed">
              Are you sure you want to move <span className="text-white font-bold">"{file.name}"</span> to trash?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col gap-3 mt-8 sm:flex-col sm:space-x-0">
            <AlertDialogAction
              className="w-full h-14 rounded-2xl bg-red-500 hover:bg-red-600 text-white font-bold text-base shadow-lg shadow-red-500/20 border-none transition-all active:scale-95"
              onClick={handleDelete}
            >
              Delete File
            </AlertDialogAction>
            <AlertDialogCancel
              className="w-full h-14 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 border-none font-bold text-base transition-all"
              onClick={() => setShowDeleteConfirm(false)}
            >
              Go Back
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
