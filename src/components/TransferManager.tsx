import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, AlertCircle, X, ChevronUp, ChevronDown, Pause, Play } from 'lucide-react';
import { useState, useEffect } from 'react';

export interface TransferState {
  id: string;
  name: string;
  progress: number;
  status: 'pending' | 'uploading' | 'paused' | 'completed' | 'error';
  type: 'upload' | 'download';
  speed?: number;
  remainingSeconds?: number;
  loaded?: number;
  total?: number;
}

interface TransferManagerProps {
  transfers: TransferState[];
  onDismiss: (id: string) => void;
  onCloseAll: () => void;
  onCancel?: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
}

const formatSpeed = (bytesPerSec?: number) => {
  if (!bytesPerSec) return '';
  if (bytesPerSec > 1024 * 1024) return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
  return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
};

const formatETA = (seconds?: number) => {
  if (seconds === undefined) return '';
  if (seconds > 3600) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m left`;
  if (seconds > 60) return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s left`;
  return `${Math.floor(seconds)}s left`;
};

export default function TransferManager({ transfers, onDismiss, onCloseAll, onCancel, onPause, onResume }: TransferManagerProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const activeTransfers = transfers.filter(t => t.status === 'uploading' || t.status === 'pending' || t.status === 'paused');
  const completedTransfers = transfers.filter(t => t.status === 'completed');
  
  useEffect(() => {
    if (transfers.length > 0 && activeTransfers.length === 0) {
      const timer = setTimeout(() => {
        onCloseAll();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [transfers.length, activeTransfers.length, onCloseAll]);

  if (transfers.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-4 left-4 md:bottom-20 md:left-auto md:w-96 z-50 rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
      <div 
        className="bg-slate-50 dark:bg-slate-800 p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <span className="font-semibold text-base">
          {activeTransfers.length > 0 ? `Uploading ${activeTransfers.length} items...` : `Transfers (${completedTransfers.length} completed)`}
        </span>
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onCloseAll();
            }}
            className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <X size={20} />
          </button>
          <div className="p-2">
            {isMinimized ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {!isMinimized && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="max-h-[50vh] md:max-h-80 overflow-y-auto"
          >
            {transfers.slice().reverse().map(transfer => (
              <div key={transfer.id} className="p-4 border-b border-slate-100 dark:border-slate-800 last:border-0 flex flex-col gap-2 relative group">
                <div className="flex items-center justify-between gap-2">
                  {/* Left Side: Pause/Resume Toggle Button */}
                  {(transfer.status === 'uploading' || transfer.status === 'paused') && (
                    <button
                      onClick={() => {
                        if (transfer.status === 'uploading' && onPause) onPause(transfer.id);
                        else if (transfer.status === 'paused' && onResume) onResume(transfer.id);
                      }}
                      className="shrink-0 w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition active:scale-95"
                      title={transfer.status === 'uploading' ? 'Pause Upload' : 'Resume Upload'}
                    >
                      {transfer.status === 'uploading' ? (
                        <Pause size={14} fill="currentColor" />
                      ) : (
                        <Play size={14} className="ml-0.5" fill="currentColor" />
                      )}
                    </button>
                  )}

                  {/* Middle: Name and status text */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="text-sm font-medium truncate" title={transfer.name}>
                      {transfer.name}
                    </span>
                    {(transfer.status === 'uploading' || transfer.status === 'paused') && (
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {transfer.status === 'paused' ? 'Paused' : `${transfer.speed ? formatSpeed(transfer.speed) : ''} • ${transfer.remainingSeconds !== undefined ? formatETA(transfer.remainingSeconds) : ''}`}
                      </span>
                    )}
                  </div>

                  {/* Right Side: Status icon / Cancel button */}
                  <div className="shrink-0 flex items-center gap-2">
                    {transfer.status === 'completed' && <CheckCircle2 size={18} className="text-green-500" />}
                    {transfer.status === 'error' && <AlertCircle size={18} className="text-red-500" />}
                    
                    {(transfer.status === 'completed' || transfer.status === 'error') && (
                      <button 
                        onClick={() => onDismiss(transfer.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition p-1"
                      >
                        <X size={18} />
                      </button>
                    )}
                    {(transfer.status === 'uploading' || transfer.status === 'paused') && onCancel && (
                      <button 
                        onClick={() => onCancel(transfer.id)}
                        className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center justify-center text-slate-400 hover:text-red-500 transition active:scale-95"
                        title="Cancel Upload"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {(transfer.status === 'uploading' || transfer.status === 'paused') && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                      <motion.div 
                        className={`h-full rounded-full ${transfer.status === 'paused' ? 'bg-amber-500' : 'bg-blue-500'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${transfer.progress}%` }}
                        transition={{ duration: 0.2 }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 w-8 text-right">
                      {transfer.progress}%
                    </span>
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
