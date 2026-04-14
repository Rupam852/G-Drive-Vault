import { Shield, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface LoginProps {
  onLoginSuccess: () => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const handleGoogleLogin = async () => {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${API_BASE_URL}/api/auth/url`);
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();

      const authWindow = window.open(
        url,
        'google_oauth',
        'width=600,height=700'
      );

      if (!authWindow) {
        toast.error('Popup blocked. Please allow popups for this site.');
      }
    } catch (error) {
      console.error('Login error:', error);
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
