import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Wifi, CheckCircle2, ServerCrash } from 'lucide-react';

export type WakeStatus = 'waking' | 'ready' | 'error';

interface ServerWakeupPopupProps {
  wakeStatus: WakeStatus;
}

export default function ServerWakeupPopup({ wakeStatus }: ServerWakeupPopupProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Countdown timer — shows elapsed time while waking
  useEffect(() => {
    if (wakeStatus !== 'waking') return;
    const id = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [wakeStatus]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Dark backdrop blur */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
      />

      {/* Popup Dialog */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
        className="relative z-10 w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-center gap-8 overflow-hidden"
      >
        {/* Animated logo */}
        <motion.div
          animate={wakeStatus === 'waking' ? { scale: [1, 1.08, 1] } : { scale: 1 }}
          transition={{ duration: 1.6, repeat: wakeStatus === 'waking' ? Infinity : 0, ease: 'easeInOut' }}
          className="relative"
        >
          <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-500/40">
            <Shield size={40} className="text-white" />
          </div>
          {/* Pulse ring — only while waking */}
          {wakeStatus === 'waking' && (
            <>
              <motion.div
                animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                className="absolute inset-0 rounded-3xl border-2 border-blue-500"
              />
              <motion.div
                animate={{ scale: [1, 2.1], opacity: [0.2, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
                className="absolute inset-0 rounded-3xl border border-blue-400"
              />
            </>
          )}
        </motion.div>

        {/* Status text */}
        <div className="text-center space-y-3 min-h-[100px] flex flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            {wakeStatus === 'waking' && (
              <motion.div
                key="waking"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-2"
              >
                <div className="flex items-center justify-center gap-2 text-blue-400">
                  <Wifi size={16} className="animate-pulse" />
                  <span className="text-sm font-semibold tracking-wide">Connecting to server</span>
                </div>
                <p className="text-xs text-slate-400">
                  {elapsedSeconds < 5
                    ? 'Starting up...'
                    : elapsedSeconds < 20
                    ? 'Waking up Render server...'
                    : elapsedSeconds < 45
                    ? 'Almost there, server is starting...'
                    : 'Taking longer than usual, please wait...'}
                </p>
                {/* Progress dots */}
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1, 0.8] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      className="w-1.5 h-1.5 rounded-full bg-blue-500"
                    />
                  ))}
                </div>
                {elapsedSeconds > 3 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[10px] text-slate-500 uppercase tracking-widest mt-2"
                  >
                    {elapsedSeconds}s elapsed
                  </motion.p>
                )}
              </motion.div>
            )}

            {wakeStatus === 'ready' && (
              <motion.div
                key="ready"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  <CheckCircle2 size={36} className="text-emerald-400" />
                </motion.div>
                <p className="text-sm font-semibold text-emerald-400">Server connected!</p>
                <p className="text-xs text-slate-400">Ready in {elapsedSeconds}s</p>
              </motion.div>
            )}

            {wakeStatus === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-2"
              >
                <ServerCrash size={32} className="text-amber-400" />
                <p className="text-sm font-semibold text-amber-400">Network issue</p>
                <p className="text-xs text-slate-400">Unable to reach the server</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Thin loading bar at bottom */}
        {wakeStatus === 'waking' && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800 overflow-hidden">
            <motion.div
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
              className="h-full w-1/3 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
