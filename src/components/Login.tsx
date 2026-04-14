import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { Capacitor } from '@capacitor/core';
import { Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import { toast } from 'sonner';

const ANDROID_CLIENT_ID = '366598728765-rvhkrkvmisgeu0tn27jatbsajbp12qsk.apps.googleusercontent.com';
// Web Client ID is used as the serverClientId so Google returns a serverAuthCode
// that the backend can exchange for Drive access tokens
const WEB_CLIENT_ID = '366598728765-r8pdfc9s1bf4mkplf3k250mqqnj7lkbk.apps.googleusercontent.com';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://g-drive-vault.vercel.app';

interface LoginProps {
  onLoginSuccess: (tokens?: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const handleGoogleLogin = async () => {

    // ── NATIVE (Android / iOS) ──────────────────────────────────────────────
    if (Capacitor.isNativePlatform()) {
      try {
        // Step 1: Initialize the plugin.
        // IMPORTANT: scopes MUST be provided — the plugin only calls
        // requestOfflineAccess() (which returns serverAuthCode) when scopes
        // are present. Without scopes, serverAuthCode is always null.
        await GoogleSignIn.initialize({
          clientId: WEB_CLIENT_ID,
          scopes: [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/userinfo.email',
            'https://www.googleapis.com/auth/userinfo.profile',
          ],
        });

        // Step 2: Open Google Account picker
        const result = await GoogleSignIn.signIn();

        if (!result.serverAuthCode) {
          throw new Error('No serverAuthCode returned from Google');
        }

        // Step 3: Exchange the code for tokens via the backend
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

    // ── WEB (Browser popup) ─────────────────────────────────────────────────
    try {
      // Use relative URL — works on same-origin Vercel deployment
      const response = await fetch('/api/auth/url');
      if (!response.ok) throw new Error('Could not get auth URL from server');
      const { url } = await response.json();

      const popup = window.open(url, 'google_oauth', 'width=600,height=700');
      if (!popup) {
        toast.error('Popup was blocked. Please allow popups for this site.');
      }
    } catch (error) {
      console.error('[Web Login] Error:', error);
      toast.error('Failed to initiate login');
    }
  };

  return (
    <div className="h-screen bg-slate-900 flex flex-col items-center justify-center p-8 text-white">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center space-y-8 max-w-xs w-full"
      >
        <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/30">
          <Shield size={48} />
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Drive Vault</h1>
          <p className="text-slate-400 text-sm">Secure your Google Drive files with an extra layer of encryption.</p>
        </div>

        <Button
          onClick={handleGoogleLogin}
          className="w-full h-14 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all active:scale-95"
        >
          <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
          Sign in with Google
        </Button>

        <button
          onClick={() => onLoginSuccess()}
          className="text-slate-500 text-[10px] uppercase tracking-widest font-bold hover:text-blue-400 transition-colors"
        >
          Already signed in? Click here to refresh
        </button>

        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">
          Authorized by Google Drive API
        </p>
      </motion.div>

      <div className="absolute bottom-12 text-slate-600 flex items-center gap-2 text-xs">
        <Lock size={14} />
        <span>End-to-end encrypted vault</span>
      </div>
    </div>
  );
}
