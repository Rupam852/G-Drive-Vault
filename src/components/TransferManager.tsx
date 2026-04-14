import { motion, AnimatePresence } from 'motion/react';
import { Loader2, CheckCircle2, AlertCircle, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';

export interface TransferState {
  id: string;
  name: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  type: 'upload' | 'download';
}

interface TransferManagerProps {
  transfers: TransferState[];
  onDismiss: (id: string) => void;
  onCloseAll: () => void;
}

export default function TransferManager({ transfers, onDismiss, onCloseAll }: TransferManagerProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const activeTransfers = transfers.filter(t => t.status === 'uploading' || t.status === 'pending');
  const completedTransfers = transfers.filter(t => t.status === 'completed');
  
  if (transfers.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 w-80 z-50 rounded-2xl shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
      <div 
        className="bg-slate-50 dark:bg-slate-800 p-3 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <span className="font-semibold text-sm">
          {activeTransfers.length > 0 ? `Uploading ${activeTransfers.length} items...` : `Transfers (${completedTransfers.length} completed)`}
        </span>
        <div className="flex items-center gap-1">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onCloseAll();
            }}
            className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors"
          >
            <X size={16} />
          </button>
          <div className="p-1">
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {!isMinimized && (
          <motion.div 
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            className="max-h-60 overflow-y-auto"
          >
            {transfers.slice().reverse().map(transfer => (
              <div key={transfer.id} className="p-3 border-b border-slate-100 dark:border-slate-800 last:border-0 relative group">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium truncate pr-4" title={transfer.name}>
                    {transfer.name}
                  </span>
                  <div className="shrink-0 flex items-center gap-2">
                    {transfer.status === 'uploading' && <Loader2 size={14} className="animate-spin text-blue-500" />}
                    {transfer.status === 'completed' && <CheckCircle2 size={14} className="text-green-500" />}
                    {transfer.status === 'error' && <AlertCircle size={14} className="text-red-500" />}
                    {(transfer.status === 'completed' || transfer.status === 'error') && (
                      <button 
                        onClick={() => onDismiss(transfer.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-700 transition"
                      >
                        <X size={14} />
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
