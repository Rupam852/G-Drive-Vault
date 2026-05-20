import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, AlertCircle, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useState, useEffect } from 'react';

export interface TransferState {
  id: string;
  name: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
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
}

export default function TransferManager({ transfers, onDismiss, onCloseAll, onCancel }: TransferManagerProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const activeTransfers = transfers.filter(t => t.status === 'uploading' || t.status === 'pending');
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
              <div key={transfer.id} className="p-4 border-b border-slate-100 dark:border-slate-800 last:border-0 relative group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium truncate pr-4" title={transfer.name}>
                    {transfer.name}
                  </span>
                  <div className="shrink-0 flex items-center gap-3">
                    {transfer.status === 'uploading' && <Loader2 size={18} className="animate-spin text-blue-500" />}
                    {transfer.status === 'completed' && <CheckCircle2 size={18} className="text-green-500" />}
                    {transfer.status === 'error' && <AlertCircle size={18} className="text-red-500" />}
                    {(transfer.status === 'completed' || transfer.status === 'error') && (
                      <button 
                        onClick={() => onDismiss(transfer.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition p-1"
                      >
                        <X size={18} />
                      </button>
                    )}
                    {transfer.status === 'uploading' && onCancel && (
                      <button 
                        onClick={() => onCancel(transfer.id)}
                        className="text-slate-400 hover:text-red-500 transition p-1"
                        title="Cancel Upload"
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                </div>
                
                {transfer.status === 'uploading' && (
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <motion.div 
                      className="bg-blue-500 h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${transfer.progress}%` }}
                      transition={{ duration: 0.2 }}
                    />
                  </div>
                )}
                {transfer.status === 'error' && (
                  <span className="text-[10px] text-red-500">Failed to transfer</span>
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
