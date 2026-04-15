import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { Capacitor } from '@capacitor/core';
import { Shield, Lock, Wifi, CheckCircle2, ServerCrash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

const WEB_CLIENT_ID = '366598728765-r8pdfc9s1bf4mkplf3k250mqqnj7lkbk.apps.googleusercontent.com';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://g-drive-vault.onrender.com';

interface LoginProps {
  onLoginSuccess: (tokens?: any) => void;
}

type WakeStatus = 'waking' | 'ready' | 'error';

export default function Login({ onLoginSuccess }: LoginProps) {
  const [wakeStatus, setWakeStatus] = useState<WakeStatus>('waking');
  // overlay stays visible for a brief moment after ready so user sees the ✓
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Countdown timer — shows elapsed time while waking
  useEffect(() => {
    if (wakeStatus !== 'waking') return;
    const id = setInterval(() => setElapsedSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [wakeStatus]);

  // Wake up Render server the moment login screen opens
  useEffect(() => {
    let cancelled = false;
    const warmUp = async () => {
      try {
        await fetch(`${API_BASE_URL}/api/auth/me`, {
          method: 'GET',
          signal: AbortSignal.timeout(70000),
        });
        // Any HTTP response (even 401) = server is awake
        if (!cancelled) {
          setWakeStatus('ready');
          // Close overlay after 900ms so user sees the success state
          setTimeout(() => { if (!cancelled) setOverlayVisible(false); }, 900);
        }
      } catch {
        // Network error — still allow login attempt
        if (!cancelled) {
          setWakeStatus('error');
          setTimeout(() => { if (!cancelled) setOverlayVisible(false); }, 1200);
        }
      }
    };
    warmUp();
    return () => { cancelled = true; };
  }, []);

  const handleGoogleLogin = async () => {
    // ── NATIVE (Android / iOS) ────────────────────────────────────────────
    if (Capacitor.isNativePlatform()) {
      try {
        await GoogleSignIn.initialize({
          clientId: WEB_CLIENT_ID,
          scopes: [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
          ],
        });

        const result = await GoogleSignIn.signIn();
        if (!result.serverAuthCode) throw new Error('No serverAuthCode returned from Google');

        const response = await fetch(`${API_BASE_URL}/api/auth/native`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: result.serverAuthCode }),
        });

        if (!response.ok) throw new Error('Token exchange failed on server');
        const authData = await response.json();
        localStorage.setItem('drive_vault_tokens', JSON.stringify(authData.tokens));
        onLoginSuccess(authData.tokens);
        toast.success('Signed in successfully!');
      } catch (error: any) {
        console.error('[Native Login] Error:', error);
        toast.error('Login failed: ' + (error.message || 'Unknown error'));
      }
      return;
    }

    // ── WEB (Browser popup) ──────────────────────────────────────────────
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/url`);
      if (!response.ok) throw new Error('Could not get auth URL from server');
      const { url } = await response.json();
      const popup = window.open(url, 'google_oauth', 'width=600,height=700');
      if (!popup) toast.error('Popup was blocked. Please allow popups for this site.');
    } catch (error) {
      console.error('[Web Login] Error:', error);
      toast.error('Failed to initiate login');
    }
  };

  return (
    <div className="h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-white relative overflow-hidden">

      {/* Background subtle gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl" />
      </div>

      {/* ── FULL-SCREEN CONNECTING OVERLAY ── */}
      <AnimatePresence>
        {overlayVisible && (
          <motion.div
            key="overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="absolute inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center gap-8"
          >
            {/* Animated logo */}
            <motion.div
              animate={wakeStatus === 'waking' ? { scale: [1, 1.08, 1] } : { scale: 1 }}
              transition={{ duration: 1.6, repeat: wakeStatus === 'waking' ? Infinity : 0, ease: 'easeInOut' }}
              className="relative"
            >
              <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/40">
                <Shield size={48} />
              </div>
              {/* Pulse ring — only while waking */}
              {wakeStatus === 'waking' && (
                <>
                  <motion.div
                    animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
                    className="absolute inset-0 rounded-[2rem] border-2 border-blue-500"
                  />
                  <motion.div
                    animate={{ scale: [1, 2.1], opacity: [0.2, 0] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', delay: 0.3 }}
                    className="absolute inset-0 rounded-[2rem] border border-blue-400"
                  />
                </>
              )}
            </motion.div>

            {/* Status text */}
            <div className="text-center space-y-3">
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
                    <p className="text-xs text-slate-500">
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
                        className="text-[10px] text-slate-600 uppercase tracking-widest"
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
                    <p className="text-xs text-slate-500">Ready in {elapsedSeconds}s</p>
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
                    <p className="text-xs text-slate-500">You can still try signing in</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Thin loading bar at bottom */}
            {wakeStatus === 'waking' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-800 overflow-hidden">
                <motion.div
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  className="h-full w-1/3 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN LOGIN CARD (shown after overlay closes) ── */}
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: overlayVisible ? 0.92 : 1, opacity: overlayVisible ? 0 : 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="text-center space-y-8 max-w-xs w-full relative z-10"
      >
        <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/30">
          <Shield size={48} />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Drive Vault</h1>
          <p className="text-slate-400 text-sm">Secure your Google Drive files with an extra layer of protection.</p>
        </div>

        <div className="space-y-3">
          <Button
            onClick={handleGoogleLogin}
            className="w-full h-14 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg"
          >
            <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
            Sign in with Google
          </Button>

          <button
            onClick={() => onLoginSuccess()}
            className="text-slate-500 text-[10px] uppercase tracking-widest font-bold hover:text-blue-400 transition-colors"
          >
            Already signed in? Tap to refresh
          </button>
        </div>

        <p className="text-[10px] text-slate-600 uppercase tracking-widest font-medium">
          Authorized by Google Drive API
        </p>
      </motion.div>

      <div className="absolute bottom-12 text-slate-600 flex items-center gap-2 text-xs z-10">
        <Lock size={14} />
        <span>End-to-end encrypted vault</span>
      </div>
    </div>
  );
}
