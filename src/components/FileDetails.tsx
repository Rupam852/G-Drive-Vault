import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { FileItem } from '../types';
import { Image, Video, FileText, Music, File, Trash2, Share2, Info, Calendar, HardDrive, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface FileDetailsProps {
  file: FileItem | null;
  isOpen: boolean;
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

export default function FileDetails({ file, isOpen, onClose, onDelete, onShare }: FileDetailsProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!file) return null;

  const Icon = iconMap[file.type] || File;



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
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 pr-8">
              <Icon className="text-blue-500 shrink-0" size={20} />
              <span className="truncate text-base font-bold">{file.name}</span>
            </DialogTitle>
            <DialogDescription>File Details</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="aspect-video bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-600 overflow-hidden border border-slate-100 dark:border-slate-800 relative group">
              {file.type === 'image' && file.thumbnail ? (
                <img 
                  src={file.thumbnail.replace('=s220', '=s1000')} 
                  className="w-full h-full object-contain bg-black" 
                  alt={file.name} 
                  referrerPolicy="no-referrer" 
                />
              ) : file.type === 'video' ? (
                <iframe 
                  src={`https://drive.google.com/file/d/${file.id}/preview`} 
                  className="w-full h-full border-none"
                  allow="autoplay"
                />
              ) : file.type === 'document' ? (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                  <FileText size={48} className="text-blue-500 opacity-50" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Document Preview</p>
                    <p className="text-[10px] text-slate-400">Standard Google Drive Viewer</p>
                  </div>
                  <iframe 
                    src={`https://drive.google.com/file/d/${file.id}/preview`} 
                    className="absolute inset-0 w-full h-full border-none opacity-0 hover:opacity-100 transition-opacity bg-white"
                    title="Document Preview"
                  />
                </div>
              ) : file.type !== 'folder' ? (
                <iframe 
                  src={`https://drive.google.com/file/d/${file.id}/preview`} 
                  className="w-full h-full border-none"
                  allow="autoplay"
                />
              ) : file.thumbnail ? (
                <img src={file.thumbnail.replace('=s220', '=s1000')} className="w-full h-full object-cover" alt={file.name} referrerPolicy="no-referrer" />
              ) : (
                <Icon size={64} />
              )}
              
              {file.type !== 'folder' && (
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="h-8 w-8 p-0 rounded-full bg-black/50 hover:bg-black/70 text-white border-none"
                    onClick={() => window.open(file.webViewLink, '_blank')}
                  >
                    <ExternalLink size={14} />
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                  <HardDrive size={10} /> Size
                </p>
                <p className="text-sm font-medium">{file.size}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                  <Calendar size={10} /> Date
                </p>
                <p className="text-sm font-medium">{file.date}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                  <Info size={10} /> Type
                </p>
                <p className="text-sm font-medium capitalize">{file.type}</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-3 sm:justify-center pt-2">
            <div className="grid grid-cols-2 gap-2 w-full">
              <Button variant="outline" className="rounded-xl h-11 border-slate-200 dark:border-slate-700" onClick={handleShare}>
                <Share2 size={18} className="mr-2" /> Share
              </Button>
              
              {file.webViewLink && (
                <Button variant="outline" className="rounded-xl h-11 text-green-600 border-green-100 bg-green-50 dark:bg-green-900/20 dark:border-green-900/30" onClick={() => window.open(file.webViewLink, '_blank')}>
                  <ExternalLink size={18} className="mr-2" /> Open
                </Button>
              )}
            </div>
            
            <div className="w-full">
              <Button variant="destructive" className="w-full rounded-xl h-11 shadow-lg shadow-red-200 dark:shadow-none" onClick={() => setShowDeleteConfirm(true)}>
                <Trash2 size={18} className="mr-2" /> Delete
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-white dark:bg-slate-900 border-none rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{file.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default" className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-red-600 hover:bg-red-700" onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
