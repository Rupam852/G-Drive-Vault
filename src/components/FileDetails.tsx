import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { FileItem } from '../types';
import { Image, Video, FileText, Music, File, Trash2, Share2, Info, Calendar, HardDrive, Maximize2, Minimize2, X } from 'lucide-react';
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

export default function FileDetails({ file, isOpen, tokens, onClose, onDelete, onShare }: FileDetailsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isExpanded) setIsExpanded(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isExpanded]);

  // Handle hardware back button for Android via Central Event
  useEffect(() => {
    if (!isOpen) return;
    
    const handleVaultBack = (e: any) => {
      // If modal is open, we "consume" the back gesture
      e.preventDefault();
      
      if (isExpanded) {
        setIsExpanded(false);
      } else if (showDeleteConfirm) {
        setShowDeleteConfirm(false);
      } else {
        onClose();
      }
    };

    window.addEventListener('vault-back', handleVaultBack);
    return () => window.removeEventListener('vault-back', handleVaultBack);
  }, [isOpen, isExpanded, showDeleteConfirm, onClose]);

  useEffect(() => {
    let active = true;
    if (file && isOpen && file.type !== 'folder') {
      loadPreview(active);
    } else {
      setPreviewUrl(null);
    }
    return () => { active = false; };
  }, [file?.id, isOpen]);

  const loadPreview = async (active: boolean) => {
    if (!file || !tokens) return;
    setIsLoading(true);
    setPreviewUrl(null); // Clear old preview first
    try {
      const ticketRes = await fetch(`${API_BASE_URL}/api/drive/download/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens }),
      });
      if (ticketRes.ok && active) {
        const { ticketId } = await ticketRes.json();
        // Use a unique parameter to force reload the iframe/img
        const url = `${API_BASE_URL}/api/drive/download/${file.id}?ticket=${ticketId}&inline=true&v=${Date.now()}`;
        setPreviewUrl(url);
      }
    } catch (e) {
      console.error('Preview error:', e);
    } finally {
      if (active) setIsLoading(false);
    }
  };

  // Safe check for blank screen prevention
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

  return (
    <>
      <Dialog open={isOpen && !isExpanded} onOpenChange={onClose}>
        <DialogContent className="w-[95vw] sm:max-w-lg bg-[#0F172A] border-slate-800 text-white rounded-[2rem] overflow-hidden p-0 gap-0 shadow-2xl">
          <div className="p-6 pb-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500">
                  <Icon size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-bold truncate max-w-[200px] sm:max-w-[300px]">{file.name}</h2>
                  <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">File Details</p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className={`
              ${file.type === 'video' ? 'aspect-video' : file.type === 'document' ? 'aspect-[3/4]' : 'aspect-auto max-h-[350px]'} 
              w-full bg-[#1e293b]/50 rounded-2xl flex items-center justify-center text-slate-700 overflow-hidden border border-slate-800/50 relative group cursor-pointer
            `}
              onClick={() => setIsExpanded(true)}
            >
              {isLoading ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : file.type === 'image' && (file.thumbnail || previewUrl) ? (
                <img 
                  src={previewUrl || file.thumbnail?.replace('=s220', '=s1000')} 
                  className="w-full h-full object-contain bg-black" 
                  alt={file.name} 
                  referrerPolicy="no-referrer" 
                />
              ) : file.type === 'video' && previewUrl ? (
                <video 
                  src={previewUrl} 
                  className="w-full h-full object-contain bg-black"
                  poster={file.thumbnail?.replace('=s220', '=s1000')}
                  autoPlay
                  playsInline
                  muted
                />
              ) : (file.type === 'document' || file.type === 'other' || file.type === 'audio') ? (
                previewUrl ? (
                  <iframe 
                    src={previewUrl}
                    className="w-full h-full border-none bg-white"
                    title="File Preview"
                    loading="lazy"
                  />
                ) : isLoading ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-xs text-slate-400">Loading preview...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-10 opacity-40">
                    <Icon size={64} />
                    <p className="text-[10px] uppercase font-bold tracking-[0.2em]">Preview Unavailable</p>
                  </div>
                )
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 opacity-40">
                  <Icon size={64} />
                  <p className="text-[10px] uppercase font-bold tracking-[0.2em]">Preview Unavailable</p>
                </div>
              )}
              
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 text-white flex items-center gap-2">
                  <Maximize2 size={18} />
                  <span className="text-xs font-bold">Tap to Fullscreen</span>
                </div>
              </div>
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
                  onClick={() => setIsExpanded(false)}
                  className="h-10 w-10 p-0 rounded-full bg-white/10 hover:bg-white/20 text-white border-none"
                >
                  <Minimize2 size={20} />
                </Button>
                <Button 
                  onClick={() => {
                    setIsExpanded(false);
                    onClose();
                  }}
                  className="h-10 w-10 p-0 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-500 border-none"
                >
                  <X size={20} />
                </Button>
              </div>
            </div>

            <div className="flex-1 w-full bg-[#0F172A]/50 rounded-[2.5rem] overflow-hidden flex items-center justify-center relative group max-w-7xl mx-auto border border-white/5 shadow-2xl">
              {file.type === 'image' ? (
                <img src={previewUrl || file.thumbnail?.replace('=s220', '=s1000')} className="w-full h-full object-contain" alt={file.name} referrerPolicy="no-referrer" />
              ) : file.type === 'video' ? (
                <video src={previewUrl || ''} className="w-full h-full object-contain" controls autoPlay playsInline poster={file.thumbnail?.replace('=s220', '=s1000')} />
              ) : (
                previewUrl ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-none bg-white"
                    title="Immersive Preview"
                    allow="autoplay"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-4 text-slate-400">
                    <Icon size={64} className="opacity-30" />
                    <p className="text-sm font-bold">Preview not available</p>
                  </div>
                )
              )}
            </div>
            
            <div className="p-6 flex justify-center gap-4 z-10">
               <button onClick={handleShare} className="flex flex-col items-center gap-1 group">
                 <div className="p-4 bg-white/5 rounded-2xl group-hover:bg-blue-500/20 transition-colors text-white group-hover:text-blue-400">
                    <Share2 size={24} />
                 </div>
                 <span className="text-[10px] font-bold text-slate-500 group-hover:text-white uppercase tracking-widest">Share</span>
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

      {/* REFINED DELETE CONFIRMATION */}
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
