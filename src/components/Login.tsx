import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { Capacitor } from '@capacitor/core';
import { Shield, Lock, Cloud, FolderOpen, Eye, CheckSquare, Sparkles, Download, ExternalLink, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useState } from 'react';

const WEB_CLIENT_ID = '366598728765-r8pdfc9s1bf4mkplf3k250mqqnj7lkbk.apps.googleusercontent.com';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://g-drive-vault.onrender.com';

interface LoginProps {
  onLoginSuccess: (tokens?: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          if (errData.error === 'missing_refresh_token') {
            throw new Error(errData.message || 'Please try signing in once more to grant Drive access.');
          }
          throw new Error('Token exchange failed on server');
        }
        
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
      const popup = window.open('', 'google_oauth', 'width=600,height=700');
      if (!popup) {
        toast.error('Popup was blocked. Please allow popups for this site.');
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/auth/url`);
      if (!response.ok) {
        popup.close();
        throw new Error('Could not get auth URL from server');
      }
      const { url } = await response.json();
      
      popup.location.href = url;
    } catch (error) {
      console.error('[Web Login] Error:', error);
      toast.error('Failed to initiate login');
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans overflow-x-hidden selection:bg-blue-600/30">
      {/* Background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/10 rounded-full blur-[120px]" />
      </div>

      {/* ── NAVIGATION BAR ── */}
      <header className="border-b border-slate-800/40 bg-slate-950/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg viewBox="0 0 108 108" className="w-6 h-6 text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M54 20L84 37V71L54 88L24 71V37L54 20Z" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
                <path d="M39 64C36 64 34 61.5 34 58.5C34 55.5 36.5 53 39.5 53C40 53 41 53 42 54C43 49 48 46 53 46C57 46 61 49 62 53C62.5 53 63 53 63.5 53C66.5 53 69 55.5 69 58.5C69 61.5 66.5 64 63.5 64H39Z" fill="currentColor" />
                <circle cx="54" cy="31" r="3" fill="currentColor" fillOpacity="0.5" />
              </svg>
            </div>
            <span className="font-extrabold text-xl tracking-tight text-white">Drive Vault</span>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#about" className="hover:text-white transition-colors">About</a>
            <a href="/privacy-policy" target="_blank" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="/terms-of-service" target="_blank" className="hover:text-white transition-colors">Terms of Service</a>
          </nav>

          <div className="flex items-center gap-4">
            <Button
              onClick={handleGoogleLogin}
              className="h-10 bg-white hover:bg-slate-100 text-slate-900 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 shadow-lg"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              Connect Drive
            </Button>
            <button 
              className="md:hidden text-slate-400 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-800 bg-slate-950 px-6 py-4 space-y-3">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-slate-400 hover:text-white text-sm">Features</a>
            <a href="#about" onClick={() => setMobileMenuOpen(false)} className="block py-2 text-slate-400 hover:text-white text-sm">About</a>
            <a href="/privacy-policy" target="_blank" className="block py-2 text-slate-400 hover:text-white text-sm">Privacy Policy</a>
            <a href="/terms-of-service" target="_blank" className="block py-2 text-slate-400 hover:text-white text-sm">Terms of Service</a>
          </div>
        )}
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative pt-20 pb-16 md:pt-32 md:pb-24 px-6 max-w-7xl mx-auto text-center space-y-8 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-4 max-w-3xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold tracking-wide uppercase mx-auto">
            <Sparkles size={12} />
            Reinforced Cloud Management
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-none bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-transparent">
            Your Google Drive, <br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">Reinforced with Security.</span>
          </h1>
          <p className="text-slate-400 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed pt-2">
            Drive Vault connects directly to your personal Google Drive API to provide a modern, biometric-protected interface, offline search, and instant files management. No middleman servers, ever.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto pt-4"
        >
          <Button
            onClick={handleGoogleLogin}
            className="w-full sm:w-auto h-14 px-8 bg-white hover:bg-slate-100 text-slate-900 rounded-2xl font-extrabold text-lg flex items-center justify-center gap-3 transition-transform active:scale-95 shadow-xl shadow-white/5"
          >
            <img src="https://www.google.com/favicon.ico" className="w-6 h-6" alt="Google" />
            Connect Google Drive
          </Button>
          
          {!Capacitor.isNativePlatform() && (
            <a 
              href="https://drive.google.com/file/d/1CAlz6VuVyVoDZfsiaHaF7HIRhoCurgaa/view?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto h-14 px-6 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-transform active:scale-95 shrink-0"
            >
              <Download size={16} />
              Download Android App
            </a>
          )}
        </motion.div>
      </section>

      {/* ── FEATURES GRID ── */}
      <section id="features" className="py-16 md:py-24 border-t border-slate-900 bg-slate-950/40 relative z-10 px-6">
        <div className="max-w-7xl mx-auto space-y-12">
          <div className="text-center max-w-2xl mx-auto space-y-3">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">App Capabilities & Key Features</h2>
            <p className="text-slate-400 text-sm md:text-base">Designed for seamless, responsive, and private interactions on all your screens.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Feature 1 */}
            <div className="p-6 bg-slate-900/50 border border-slate-800/60 rounded-2xl space-y-4 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Lock size={20} />
              </div>
              <h3 className="font-bold text-lg text-white">Biometric Vault</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Enable device security keys or local biometric authentication to protect your session inside the web or mobile environment.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 bg-slate-900/50 border border-slate-800/60 rounded-2xl space-y-4 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Eye size={20} />
              </div>
              <h3 className="font-bold text-lg text-white">Interactive Previews</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Stream video, listen to audios, and preview office documents natively without waiting for manual downloads.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 bg-slate-900/50 border border-slate-800/60 rounded-2xl space-y-4 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <CheckSquare size={20} />
              </div>
              <h3 className="font-bold text-lg text-white">Multi-Select Actions</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Perform bulk moves, stars, deletes, or uploads inside a fully responsive dual-layout (grid or list view).
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 bg-slate-900/50 border border-slate-800/60 rounded-2xl space-y-4 hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                <Cloud size={20} />
              </div>
              <h3 className="font-bold text-lg text-white">Google Cloud API</h3>
              <p className="text-slate-400 text-xs leading-relaxed">
                Your data is stored and secured directly on Google's high-speed global infrastructure under your personal account drive.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── TECHNICAL & PRIVACY TRANSPARENCY ── */}
      <section id="about" className="py-16 md:py-24 px-6 max-w-4xl mx-auto space-y-8 text-center relative z-10">
        <div className="w-12 h-12 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield size={24} />
        </div>
        <h2 className="text-3xl font-extrabold">Data Governance & User Consent</h2>
        <div className="text-slate-400 text-sm md:text-base leading-relaxed space-y-4 text-justify sm:text-center">
          <p>
            Drive Vault acts purely as a secure client portal interface. We operate using Google OAuth 2.0 protocol using restricted Google Drive scopes. <strong>We do not run, maintain, or transmit user information to external servers or remote databases.</strong>
          </p>
          <p>
            All file indexing, searches, offline cached information, and biometric key logs reside exclusively within the local memory bounds of your specific client device. Your personal files remain under your sole ownership on Google Cloud.
          </p>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12 px-6 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 108 108" className="w-4 h-4 text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M54 20L84 37V71L54 88L24 71V37L54 20Z" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
                <path d="M39 64C36 64 34 61.5 34 58.5C34 55.5 36.5 53 39.5 53C40 53 41 53 42 54C43 49 48 46 53 46C57 46 61 49 62 53C62.5 53 63 53 63.5 53C66.5 53 69 55.5 69 58.5C69 61.5 66.5 64 63.5 64H39Z" fill="currentColor" />
                <circle cx="54" cy="31" r="3" fill="currentColor" fillOpacity="0.5" />
              </svg>
            </div>
            <span className="font-bold text-sm tracking-tight text-white">Drive Vault</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-500 font-medium">
            <a href="/privacy-policy" target="_blank" className="hover:text-slate-300 transition-colors">Privacy Policy</a>
            <a href="/terms-of-service" target="_blank" className="hover:text-slate-300 transition-colors">Terms of Service</a>
            <span>Developer Support: rupam.dev@gmail.com</span>
          </div>

          <p className="text-[11px] text-slate-600">&copy; {new Date().getFullYear()} Drive Vault. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
