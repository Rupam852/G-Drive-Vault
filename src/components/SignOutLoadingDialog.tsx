import { AnimatePresence, motion } from 'motion/react';
import { LogOut } from 'lucide-react';

interface SignOutLoadingDialogProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
}

export default function SignOutLoadingDialog({
  visible,
  title = 'Signing out...',
  subtitle = 'Clearing secure session & cache...'
}: SignOutLoadingDialogProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="signout-dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 selection:bg-transparent"
          style={{ pointerEvents: 'auto' }}
        >
          <motion.div
            key="signout-dialog-card"
            initial={{ opacity: 0, scale: 0.88, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[320px] sm:max-w-[340px] rounded-[28px] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-8 shadow-2xl flex flex-col items-center text-center"
          >
            {/* ── Animated Circular Spinner with Centered LogOut Icon (matches Android SignOutLoadingDialog.kt) ── */}
            <div className="relative w-16 h-16 flex items-center justify-center">
              {/* Soft glow inner circle */}
              <div className="w-14 h-14 rounded-full bg-blue-50 dark:bg-blue-900/30" />

              {/* Smooth Circular Progress Spinner */}
              <svg
                className="absolute inset-0 w-16 h-16 animate-spin text-blue-600 dark:text-blue-500"
                viewBox="0 0 64 64"
                fill="none"
              >
                {/* Background track circle */}
                <circle
                  cx="32"
                  cy="32"
                  r="27"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  className="opacity-15"
                />
                {/* Foreground animated spinning arc */}
                <circle
                  cx="32"
                  cy="32"
                  r="27"
                  stroke="currentColor"
                  strokeWidth="3.5"
                  strokeDasharray="50 120"
                  strokeLinecap="round"
                />
              </svg>

              {/* Center LogOut Icon */}
              <LogOut
                size={24}
                className="absolute text-blue-600 dark:text-blue-400 stroke-[2.2] translate-x-0.5"
              />
            </div>

            {/* ── Title ── */}
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-5 tracking-tight leading-tight">
              {title}
            </h3>

            {/* ── Subtitle ── */}
            <p className="text-xs sm:text-[13px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed font-medium">
              {subtitle}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
