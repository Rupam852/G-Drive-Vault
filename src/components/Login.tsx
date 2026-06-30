import { GoogleSignIn } from '@capawesome/capacitor-google-sign-in';
import { Capacitor } from '@capacitor/core';
import { 
  Shield, Lock, Cloud, FolderOpen, Eye, CheckSquare, Sparkles, 
  Download, Menu, X, ChevronDown, ArrowRight, 
  ShieldCheck, Key, Database, Laptop
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { useState, useEffect } from 'react';

const WEB_CLIENT_ID = '443871816940-j8ifmrgsd4f0s1to4bttjm3uh93ujl2l.apps.googleusercontent.com';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://g-drive-vault.onrender.com';

interface LoginProps {
  onLoginSuccess: (tokens?: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);

  const words = ['Biometric Vault', 'Direct Speed', 'Absolute Privacy', 'Zero Server Logs'];

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
      setIsHovering(true);
    };
    const handleMouseLeave = () => {
      setIsHovering(false);
    };
    window.addEventListener('mousemove', handleMouseMove);
    document.body.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.body.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

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



  const faqs = [
    {
      q: 'How does Drive Vault guarantee complete privacy?',
      a: 'Unlike traditional storage managers, Drive Vault functions as a serverless client-side interface. It communicates directly with Google Drive APIs. Your OAuth credentials and file indices are stored only in your device’s secure local storage or native keychain. No third-party servers ever touch or store your files.'
    },
    {
      q: 'How does the Biometric Vault mechanism work?',
      a: 'On Android and iOS devices, we leverage native biometrics APIs (fingerprint/face recognition) using high-grade device enclaves. On web/browsers, we lock down active login sessions locally using highly secure encryption keys. Your session expires and locks automatically the moment you close the page or app.'
    },
    {
      q: 'Does it support offline access?',
      a: 'Yes. Drive Vault implements offline caching for file listings and folder paths. You can browse, queue downloads, and search through cached files offline. Once your internet connection is re-established, any queued operations are automatically synced.'
    },
    {
      q: 'Can I view or play my private media natively?',
      a: 'Absolutely. Drive Vault streams video and audio content directly from Google Drive APIs to your local video and audio players without intermediate caching or download wait times. All documents can also be read securely using internal viewers.'
    }
  ];

  // ── NATIVE MOBILE LAYOUT ────────────────────────────────────────────────
  if (Capacitor.isNativePlatform()) {
    return (
      <div className="min-h-screen bg-[#020617] text-white font-sans flex flex-col justify-between p-6 relative overflow-hidden selection:bg-blue-600/30">
        {/* Animated grid in background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none grid-glow animate-grid-drift opacity-50" />
        
        {/* Colorful glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] left-[-20%] w-[140%] h-[65%] bg-gradient-to-br from-indigo-600/25 to-transparent rounded-full blur-[140px]" />
          <div className="absolute bottom-[-15%] right-[-15%] w-[90%] h-[45%] bg-gradient-to-tl from-blue-600/20 to-transparent rounded-full blur-[120px]" />
        </div>

        {/* Top Spacer */}
        <div className="h-4" />

        {/* Main Panel */}
        <div className="flex-1 flex flex-col justify-center items-center max-w-sm mx-auto w-full space-y-10 z-10">
          {/* Vault Logo Ring */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 15 }}
            className="relative"
          >
            {/* Pulsing ring */}
            <div className="absolute -inset-4 rounded-[2.5rem] bg-gradient-to-r from-blue-500 to-indigo-500 opacity-20 blur-xl animate-[pulse_3s_infinite]" />
            <div className="absolute -inset-1 rounded-[2.2rem] bg-gradient-to-r from-blue-500 to-indigo-500 opacity-30 blur-sm" />
            
            {/* Core logo icon container */}
            <div className="relative w-24 h-24 bg-slate-950 border-2 border-slate-800 rounded-[2rem] flex items-center justify-center shadow-2xl">
              <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-[1.3rem] flex items-center justify-center shadow-lg shadow-blue-500/20">
                <svg viewBox="0 0 108 108" className="w-9 h-9 text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M54 20L84 37V71L54 88L24 71V37L54 20Z" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
                  <path d="M39 64C36 64 34 61.5 34 58.5C34 55.5 36.5 53 39.5 53C40 53 41 53 42 54C43 49 48 46 53 46C57 46 61 49 62 53C62.5 53 63 53 63.5 53C66.5 53 69 55.5 69 58.5C69 61.5 66.5 64 63.5 64H39Z" fill="currentColor" />
                  <circle cx="54" cy="31" r="3" fill="currentColor" fillOpacity="0.5" />
                </svg>
              </div>
            </div>
          </motion.div>

          {/* Titles */}
          <div className="text-center space-y-4">
            <motion.h1 
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-white to-slate-400 bg-clip-text text-transparent"
            >
              DriveVault
            </motion.h1>
            <motion.p 
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="text-slate-400 text-sm font-medium leading-relaxed max-w-xs mx-auto"
            >
              Biometric-protected direct cloud interface. Serverless client connection.
            </motion.p>
          </div>

          {/* Premium Connect Button */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-full"
          >
            <button
              onClick={handleGoogleLogin}
              className="relative overflow-hidden group w-full h-15 bg-slate-950/60 border border-slate-800 hover:border-slate-700/80 hover:bg-slate-900/60 active:scale-98 transition-all duration-250 text-white rounded-2xl font-extrabold text-base flex items-center justify-center gap-3 shadow-none backdrop-blur-md"
            >
              {/* Shine sweep effect */}
              <div className="absolute top-0 w-[50%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-25 animate-shine" />
              
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5 z-10" alt="Google" />
              <span className="z-10">Connect Google Drive</span>
            </button>
          </motion.div>

          {/* Security details badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900/80 border border-slate-800 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-widest"
          >
            <Shield size={12} className="text-blue-500" />
            Device Enclave & OAuth Secure
          </motion.div>
        </div>

        {/* Footer info links */}
        <div className="z-10 text-center py-4 flex justify-center gap-6 text-[10px] font-extrabold text-slate-600 uppercase tracking-widest">
          <a href="/privacy-policy" target="_blank" className="hover:text-slate-400 transition-colors">Privacy Policy</a>
          <span>•</span>
          <a href="/terms-of-service" target="_blank" className="hover:text-slate-400 transition-colors">Terms of Service</a>
        </div>
      </div>
    );
  }

  // ── WEB DESKTOP LAYOUT ──────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#030712] text-white font-sans overflow-x-hidden selection:bg-indigo-600/30 relative">
      {/* Interactive Cursor Spotlight */}
      {!Capacitor.isNativePlatform() && isHovering && (
        <div 
          className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-500 opacity-25" 
          style={{
            background: `radial-gradient(550px circle at ${mousePos.x}px ${mousePos.y}px, rgba(99, 102, 241, 0.12), transparent 80%)`
          }}
        />
      )}

      {/* Dynamic drifting background grids */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none grid-glow animate-grid-drift opacity-70" />

      {/* Decorative large light orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-600/10 rounded-full blur-[140px]" />
        <div className="absolute top-[20%] right-[-10%] w-[45vw] h-[45vw] bg-blue-600/10 rounded-full blur-[130px]" />
        <div className="absolute bottom-[10%] left-[20%] w-[35vw] h-[35vw] bg-purple-600/5 rounded-full blur-[120px]" />
      </div>

      {/* ── HEADER ── */}
      <header className="border-b border-white/5 bg-slate-950/45 backdrop-blur-xl fixed top-0 left-0 right-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Logo & Brand on the Left */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/25">
              <svg viewBox="0 0 108 108" className="w-5 h-5 text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M54 20L84 37V71L54 88L24 71V37L54 20Z" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
                <path d="M39 64C36 64 34 61.5 34 58.5C34 55.5 36.5 53 39.5 53C40 53 41 53 42 54C43 49 48 46 53 46C57 46 61 49 62 53C62.5 53 63 53 63.5 53C66.5 53 69 55.5 69 58.5C69 61.5 66.5 64 63.5 64H39Z" fill="currentColor" />
                <circle cx="54" cy="31" r="3" fill="currentColor" fillOpacity="0.5" />
              </svg>
            </div>
            <span className="font-black text-lg tracking-tight text-white bg-gradient-to-r from-white to-slate-350 bg-clip-text text-transparent">
              DriveVault
            </span>
          </div>

          {/* Links and Actions grouped on the Right */}
          <div className="flex items-center gap-6">
            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-6 text-xs font-bold uppercase tracking-wider text-slate-400">
              <button onClick={() => scrollToSection('features')} className="hover:text-white transition-colors duration-200 cursor-pointer bg-transparent border-none outline-none">Key Features</button>
              <button onClick={() => scrollToSection('architecture')} className="hover:text-white transition-colors duration-200 cursor-pointer bg-transparent border-none outline-none">Architecture</button>
              <button onClick={() => scrollToSection('faq')} className="hover:text-white transition-colors duration-200 cursor-pointer bg-transparent border-none outline-none">FAQ</button>
            </nav>

            {/* Header Action Button */}
            <div className="flex items-center gap-3">
              <Button
                onClick={handleGoogleLogin}
                className="relative overflow-hidden group h-9 px-4 bg-slate-950/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/60 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-none backdrop-blur-md active:scale-95 transition-all"
              >
                {/* Shine sweep effect */}
                <div className="absolute top-0 w-[50%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-25 animate-shine" />
                
                <img src="https://www.google.com/favicon.ico" className="w-3.5 h-3.5 z-10" alt="Google" />
                <span className="z-10">Connect Drive</span>
              </Button>
              <button
                className="md:hidden text-slate-400 hover:text-white"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-900 bg-[#030712] px-6 py-5 space-y-3 flex flex-col items-start">
            <button onClick={() => { scrollToSection('features'); setMobileMenuOpen(false); }} className="w-full text-left py-2 text-slate-400 hover:text-white text-sm font-medium bg-transparent border-none outline-none cursor-pointer">Key Features</button>
            <button onClick={() => { scrollToSection('architecture'); setMobileMenuOpen(false); }} className="w-full text-left py-2 text-slate-400 hover:text-white text-sm font-medium bg-transparent border-none outline-none cursor-pointer">Architecture</button>
            <button onClick={() => { scrollToSection('faq'); setMobileMenuOpen(false); }} className="w-full text-left py-2 text-slate-400 hover:text-white text-sm font-medium bg-transparent border-none outline-none cursor-pointer">FAQ</button>
            <div className="w-full border-t border-slate-900 my-3 pt-3 flex flex-col gap-2">
              <a href="/privacy-policy" target="_blank" className="text-slate-500 hover:text-white text-xs">Privacy Policy</a>
              <a href="/terms-of-service" target="_blank" className="text-slate-500 hover:text-white text-xs">Terms of Service</a>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO SECTION ── */}
      <section className="relative pt-28 pb-20 md:pt-40 md:pb-28 px-6 max-w-7xl mx-auto text-center space-y-8 z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-6 max-w-4xl mx-auto"
        >
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-bold tracking-wider uppercase mx-auto animate-pulse">
            <Sparkles size={13} className="text-indigo-400" />
            100% Serverless & Biometric Encrypted
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-none bg-gradient-to-b from-white via-white to-slate-400 bg-clip-text text-transparent pb-3">
            Your Personal Google Drive,<br />
            <span className="inline-flex flex-col h-[1.15em] overflow-hidden pt-1.5 relative vertical-align-middle">
              <AnimatePresence mode="wait">
                <motion.span
                  key={wordIndex}
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -40, opacity: 0 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent pb-2 block"
                >
                  {words[wordIndex]}
                </motion.span>
              </AnimatePresence>
            </span>
          </h1>

          <p className="text-slate-400 text-base sm:text-lg md:text-xl max-w-3xl mx-auto leading-relaxed pt-2">
            Connect directly to Google’s global storage network through an ultra-fast, local client interface. Safeguarded by local device biometrics, secure storage, and instant offline searching. No external backends, no tracking.
          </p>
        </motion.div>

        {/* Call to Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-lg mx-auto pt-6"
        >
          <Button
            onClick={handleGoogleLogin}
            className="relative overflow-hidden group w-full sm:w-auto h-16 px-10 bg-slate-950/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/60 text-white rounded-2xl font-extrabold text-lg flex items-center justify-center gap-3 transition-all active:scale-95 shadow-none backdrop-blur-md"
          >
            {/* Shine sweep effect */}
            <div className="absolute top-0 w-[50%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-25 animate-shine" />
            
            <img src="https://www.google.com/favicon.ico" className="w-6 h-6 z-10" alt="Google" />
            <span className="z-10">Connect Google Drive</span>
          </Button>

          {!Capacitor.isNativePlatform() && (
            <a
              href="https://neo-files-download.rupambairagya08.workers.dev?hash=654f8c0f9c19"
              className="relative overflow-hidden group w-full sm:w-auto h-16 px-8 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 rounded-2xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all duration-200 active:scale-95 shadow-md"
            >
              {/* Shine sweep effect */}
              <div className="absolute top-0 w-[50%] h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-25 animate-shine" />
              
              <Download size={18} className="text-slate-400 group-hover:text-white transition-colors z-10" />
              <span className="z-10">Download Android APK</span>
            </a>
          )}
        </motion.div>
      </section>

      {/* ── KEY CAPABILITIES FEATURES GRID ── */}
      <section id="features" className="py-20 md:py-28 border-t border-slate-900 bg-slate-950/30 relative z-10 px-6">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Reinforced Security & Performance</h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              Designed from the ground up to protect your privacy and speed up cloud navigation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <motion.div 
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              whileHover={{ y: -6 }}
              className="p-8 bg-slate-950/60 border border-slate-900 rounded-2xl space-y-5 hover:border-slate-800/80 transition-all duration-200 shadow-md relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/20">
                <Lock size={22} />
              </div>
              <h3 className="font-bold text-xl text-white">Biometric Locks</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Unlock your files via native fingerprint scanner, Face ID, or strict device passcode keys. Session data disappears immediately upon lock.
              </p>
            </motion.div>

            {/* Feature 2 */}
            <motion.div 
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.2 }}
              whileHover={{ y: -6 }}
              className="p-8 bg-slate-950/60 border border-slate-900 rounded-2xl space-y-5 hover:border-slate-800/80 transition-all duration-200 shadow-md relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                <Eye size={22} />
              </div>
              <h3 className="font-bold text-xl text-white">Instant Media Previews</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Stream videos, audios, and view secure documents directly within the app without ever needing to store them on external host filesystems.
              </p>
            </motion.div>

            {/* Feature 3 */}
            <motion.div 
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.3 }}
              whileHover={{ y: -6 }}
              className="p-8 bg-slate-950/60 border border-slate-900 rounded-2xl space-y-5 hover:border-slate-800/80 transition-all duration-200 shadow-md relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20">
                <CheckSquare size={22} />
              </div>
              <h3 className="font-bold text-xl text-white">Bulk Operations</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Perform bulk file movements, deletions, stars, and folder transfers inside a responsive design matching both list and grid views.
              </p>
            </motion.div>

            {/* Feature 4 */}
            <motion.div 
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.4 }}
              whileHover={{ y: -6 }}
              className="p-8 bg-slate-950/60 border border-slate-900 rounded-2xl space-y-5 hover:border-slate-800/80 transition-all duration-200 shadow-md relative overflow-hidden group"
            >
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-blue-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                <Cloud size={22} />
              </div>
              <h3 className="font-bold text-xl text-white">100% Serverless</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                No intermediate proxy servers. All requests route directly between your browser/app and Google APIs, achieving maximal transfer speeds.
              </p>
            </motion.div>
          </div>
        </div>
      </section>



      {/* ── SECURITY ARCHITECTURE FLOW SECTION ── */}
      <section id="architecture" className="py-20 md:py-28 border-t border-slate-900 bg-slate-950/20 relative z-10 px-6">
        <div className="max-w-7xl mx-auto space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-4">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Security Architecture</h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              We believe in structural transparency. Your security is guaranteed by client-to-cloud direct pipelines.
            </p>
          </div>

          {/* Architecture Blocks Diagram */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pt-4 relative">
            {/* Connecting SVG Flow Lines behind the cards on Desktop */}
            <div className="absolute inset-x-16 top-1/2 -translate-y-1/2 h-1 hidden lg:block pointer-events-none z-0">
              <svg className="w-full h-8 overflow-visible" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 0 4 H 1000" stroke="rgba(99, 102, 241, 0.08)" strokeWidth="4" strokeLinecap="round" />
                <path d="M 0 4 H 1000" stroke="url(#flow-gradient)" strokeWidth="4" strokeLinecap="round" className="animate-flow-dash" />
                <defs>
                  <linearGradient id="flow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="50%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
              </svg>
            </div>
            
            {/* Client Device Node */}
            <motion.div 
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="lg:col-span-4 p-8 bg-slate-950/85 border border-slate-900 rounded-2xl flex flex-col justify-between relative overflow-hidden group z-10 backdrop-blur-xl"
            >
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Laptop size={18} />
                </div>
                <h3 className="text-xl font-bold text-white">Client Device (Local)</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Authentication tokens and temporary metadata reside strictly within your client’s memory bounds. Keychains are unlocked dynamically via native device credentials.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="px-2.5 py-1 bg-slate-900 text-[10px] font-bold text-slate-400 rounded-md border border-slate-800">Biometrics</span>
                  <span className="px-2.5 py-1 bg-slate-900 text-[10px] font-bold text-slate-400 rounded-md border border-slate-800">Index Cache</span>
                  <span className="px-2.5 py-1 bg-slate-900 text-[10px] font-bold text-slate-400 rounded-md border border-slate-800">Local Secrets</span>
                </div>
              </div>
            </motion.div>

            {/* Direct Channel Node */}
            <motion.div 
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="lg:col-span-4 p-8 bg-slate-950/85 border border-slate-900 rounded-2xl flex flex-col justify-between relative overflow-hidden group z-10 backdrop-blur-xl"
            >
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Key size={18} />
                </div>
                <h3 className="text-xl font-bold text-white">Direct HTTPS & OAuth 2.0</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  Your device establishes a direct SSL pipeline to Google’s servers. Access tokens authorize file streams locally without any proxy servers or third-party gateways.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="px-2.5 py-1 bg-slate-900 text-[10px] font-bold text-indigo-400 rounded-md border border-indigo-500/20">SSL/TLS 1.3</span>
                  <span className="px-2.5 py-1 bg-slate-900 text-[10px] font-bold text-indigo-400 rounded-md border border-indigo-500/20">Restricted Scopes</span>
                  <span className="px-2.5 py-1 bg-slate-900 text-[10px] font-bold text-indigo-400 rounded-md border border-indigo-500/20">Direct Fetch</span>
                </div>
              </div>
            </motion.div>

            {/* Cloud Storage Node */}
            <motion.div 
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="lg:col-span-4 p-8 bg-slate-950/85 border border-slate-900 rounded-2xl flex flex-col justify-between relative overflow-hidden group z-10 backdrop-blur-xl"
            >
              <div className="space-y-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Database size={18} />
                </div>
                <h3 className="text-xl font-bold text-white">Google Drive Cloud</h3>
                <p className="text-slate-400 text-xs leading-relaxed">
                  All storage assets, folders, and shared document graphs remain directly inside Google’s high-performance, enterprise-grade cloud centers.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <span className="px-2.5 py-1 bg-slate-900 text-[10px] font-bold text-emerald-400 rounded-md border border-emerald-500/20">Google Servers</span>
                  <span className="px-2.5 py-1 bg-slate-900 text-[10px] font-bold text-emerald-400 rounded-md border border-emerald-500/20">AES-256 Storage</span>
                  <span className="px-2.5 py-1 bg-slate-900 text-[10px] font-bold text-emerald-400 rounded-md border border-emerald-500/20">High Availability</span>
                </div>
              </div>
            </motion.div>

          </div>

          {/* Banner: Verified Security Direct Cloud */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="p-8 bg-gradient-to-r from-emerald-950/10 via-emerald-950/20 to-emerald-950/10 border border-emerald-900/35 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-6"
          >
            <div className="flex items-center gap-4 text-center sm:text-left">
              <div className="relative w-12 h-12 flex items-center justify-center shrink-0 mx-auto">
                {/* Sonar radiating rings */}
                <div className="absolute inset-0 rounded-2xl bg-emerald-500/25 border border-emerald-500/40 animate-sonar-pulse z-0" />
                <div className="absolute inset-0 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 animate-sonar-pulse [animation-delay:0.7s] z-0" />
                
                <div className="relative w-12 h-12 bg-emerald-950 border border-emerald-500/25 text-emerald-400 rounded-2xl flex items-center justify-center z-10">
                  <ShieldCheck size={24} />
                </div>
              </div>
              <div>
                <h4 className="font-bold text-lg text-white">No Proxy / Third-Party Databases</h4>
                <p className="text-xs text-slate-400 max-w-xl leading-relaxed mt-1">
                  Drive Vault does not host external user authentication tables, proxy tunnels, or usage track log servers. Your credentials and file paths never leave your device’s sandbox.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 bg-slate-950 px-4 py-2 border border-slate-900 rounded-xl text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              <Shield size={14} className="text-emerald-400" />
              Direct Connection
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ACCORDION SECTION ── */}
      <section id="faq" className="py-20 md:py-28 relative z-10 px-6 max-w-4xl mx-auto">
        <div className="space-y-12">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">Frequently Asked Questions</h2>
            <p className="text-slate-400 text-sm md:text-base leading-relaxed">
              Find technical answers about authorization, caching, and mobile applications.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div 
                  key={index}
                  className="bg-slate-950/60 border border-slate-900 rounded-2xl overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full p-6 text-left flex justify-between items-center gap-4 hover:bg-slate-900/30 transition-all"
                  >
                    <span className="font-bold text-sm sm:text-base text-white">{faq.q}</span>
                    <ChevronDown 
                      size={18} 
                      className={`text-slate-500 shrink-0 transition-transform duration-350 ${isOpen ? 'rotate-180 text-white' : ''}`} 
                    />
                  </button>
                  
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                      >
                        <div className="p-6 pt-0 border-t border-slate-900/40 text-xs sm:text-sm text-slate-400 leading-relaxed text-justify">
                          {faq.a}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-slate-900 bg-slate-950/70 py-16 px-6 relative z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 108 108" className="w-5 h-5 text-white" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M54 20L84 37V71L54 88L24 71V37L54 20Z" stroke="currentColor" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
                <path d="M39 64C36 64 34 61.5 34 58.5C34 55.5 36.5 53 39.5 53C40 53 41 53 42 54C43 49 48 46 53 46C57 46 61 49 62 53C62.5 53 63 53 63.5 53C66.5 53 69 55.5 69 58.5C69 61.5 66.5 64 63.5 64H39Z" fill="currentColor" />
                <circle cx="54" cy="31" r="3" fill="currentColor" fillOpacity="0.5" />
              </svg>
            </div>
            <span className="font-extrabold text-sm tracking-tight text-white">DriveVault</span>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-xs text-slate-500 font-semibold">
            <a href="/privacy-policy" target="_blank" className="hover:text-slate-350 transition-colors">Privacy Policy</a>
            <a href="/terms-of-service" target="_blank" className="hover:text-slate-350 transition-colors">Terms of Service</a>
            <span className="text-slate-600">Support: rupambairagya08@gmail.com</span>
          </div>

          <p className="text-[11px] text-slate-600 font-mono">
            &copy; {new Date().getFullYear()} DriveVault. Serverless Cloud Project.
          </p>
        </div>
      </footer>
    </div>
  );
}
