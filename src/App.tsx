
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor, registerPlugin } from '@capacitor/core';
const UploadNotification = registerPlugin<any>('UploadNotification');
import { NativeBiometric } from '@capgo/capacitor-native-biometric';
import { Shield, Cloud } from 'lucide-react';
import Dashboard from './components/Dashboard';
import FileExplorer from './components/FileExplorer';
import Settings from './components/Settings';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import MoveDialog from './components/MoveDialog';
import ManageAccessDialog from './components/ManageAccessDialog';
import InfoDialog from './components/InfoDialog';
import { formatBytes } from './utils';
import TransferManager, { TransferState } from './components/TransferManager';
import Login from './components/Login';
import { FileItem } from './types';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import ServerWakeupPopup, { WakeStatus } from './components/ServerWakeupPopup';

// Define API Base URL for mobile and production environments
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function App() {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem('drive_vault_active_tab');
    return saved || 'home';
  });
  const [user, setUser] = useState<any>(() => {
    const saved = localStorage.getItem('drive_vault_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [tokens, setTokens] = useState<any>(() => {
    const saved = localStorage.getItem('drive_vault_tokens');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [wakeStatus, setWakeStatus] = useState<WakeStatus | null>(null);
  const retryCount = useRef(0);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([]);
  const [trashedFiles, setTrashedFiles] = useState<FileItem[]>([]);
  const [hiddenFiles, setHiddenFiles] = useState<FileItem[]>([]);
  
  const initialFileFilter = (() => {
    const saved = sessionStorage.getItem('drive_vault_file_filter');
    return saved || 'all';
  })();
  const [fileFilter, setFileFilter] = useState<string>(initialFileFilter);
  const fileFilterRef = useRef<string>(initialFileFilter);
  const [currentFilter, setCurrentFilter] = useState('all');
  
  const initialFolderId = (() => {
    const saved = sessionStorage.getItem('drive_vault_current_folder_id');
    return saved || 'root';
  })();
  const [currentFolderId, setCurrentFolderId] = useState<string>(initialFolderId);
  const currentFolderIdRef = useRef<string>(initialFolderId); // always latest, no stale closure
  const [breadcrumb, setBreadcrumb] = useState<{id: string, name: string}[]>(() => {
    const saved = sessionStorage.getItem('drive_vault_breadcrumb');
    return saved ? JSON.parse(saved) : [{id: 'root', name: 'My Drive'}];
  });

  useEffect(() => {
    sessionStorage.setItem('drive_vault_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    sessionStorage.setItem('drive_vault_current_folder_id', currentFolderId);
    currentFolderIdRef.current = currentFolderId;
  }, [currentFolderId]);

  useEffect(() => {
    sessionStorage.setItem('drive_vault_breadcrumb', JSON.stringify(breadcrumb));
  }, [breadcrumb]);

  useEffect(() => {
    sessionStorage.setItem('drive_vault_file_filter', fileFilter);
    fileFilterRef.current = fileFilter;
  }, [fileFilter]);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [fileToMove, setFileToMove] = useState<FileItem | null>(null);
  
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [fileToShare, setFileToShare] = useState<FileItem | null>(null);

  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [fileForInfo, setFileForInfo] = useState<FileItem | null>(null);

  const handleShowInfo = (file: FileItem) => {
    setFileForInfo(file);
    setIsInfoOpen(true);
  };
  
  const [transfers, setTransfers] = useState<TransferState[]>([]);
  const activeUploadsRef = useRef<{ [key: string]: XMLHttpRequest }>({});
  const uploadSessionsRef = useRef<Record<string, { uploadUrl: string, file: File, currentFolderId: string }>>({});
  const uploadSpeedsRef = useRef<Record<string, number>>({});
  const [defaultOpenTransfers, setDefaultOpenTransfers] = useState(false);
  const [storageBreakdown, setStorageBreakdown] = useState<any>(null);
  const [isDownloadEnabled, setIsDownloadEnabled] = useState(() => {
    const saved = localStorage.getItem('drive_vault_download_permission');
    return saved !== null ? saved === 'true' : true;
  });
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(() => {
    const saved = localStorage.getItem('drive_vault_notification_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const handleToggleNotification = async (val: boolean) => {
    setIsNotificationEnabled(val);
    localStorage.setItem('drive_vault_notification_enabled', val.toString());
    if (val && Capacitor.isNativePlatform()) {
      try {
        const state = await UploadNotification.checkPermissions();
        if (state.notifications !== 'granted') {
          const res = await UploadNotification.requestPermissions({ permissions: ['notifications'] });
          if (res.notifications !== 'granted') {
            toast.error('Notification permission denied by system. Please enable it in Android Settings.');
            setIsNotificationEnabled(false);
            localStorage.setItem('drive_vault_notification_enabled', 'false');
          } else {
            toast.success('Upload notifications enabled!');
          }
        }
      } catch (err) {
        console.error('Error requesting notification permission on toggle:', err);
      }
    }
  };

  const mainScrollRef = useRef<HTMLElement>(null);

  // Reset scroll position when switching tabs
  useEffect(() => {
    if (mainScrollRef.current) {
      mainScrollRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, [activeTab]);

  // Global Drag & Drop state
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const dragCounter = useRef(0);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [isUnlocked, setIsUnlocked] = useState(true);
  const isAuthenticatingRef = useRef(false);

  const checkBiometric = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      setIsUnlocked(true);
      return;
    }
    const isEnabled = localStorage.getItem('drive_vault_biometric_enabled') === 'true';
    if (!isEnabled) {
      setIsUnlocked(true);
      return;
    }

    if (isAuthenticatingRef.current) return;

    setIsUnlocked(false);
    isAuthenticatingRef.current = true;
    
    try {
      const result = await NativeBiometric.isAvailable();
      if (!result.isAvailable) {
        setIsUnlocked(true);
        isAuthenticatingRef.current = false;
        return;
      }

      await NativeBiometric.verifyIdentity({
        reason: "Unlock Drive Vault",
        title: "Authentication Required",
        subtitle: "Please authenticate to access your files",
        description: "Use your biometric or device password",
        useFallback: true
      });
      setIsUnlocked(true);
    } catch (e) {
      console.log('Biometric failed or cancelled', e);
    } finally {
      // Use a timeout before releasing the lock to prevent immediate re-trigger by appStateChange event
      setTimeout(() => {
        isAuthenticatingRef.current = false;
      }, 1000);
    }
  }, []);

  useEffect(() => {
    // Only check biometrics once when the app is freshly launched (cold start)
    checkBiometric();
  }, [checkBiometric]);

  const fetchUser = async (currentTokens?: any) => {
    const activeTokens = currentTokens || tokens;
    // Persist tokens to state immediately so polling/effects don't lose them
    if (currentTokens) {
      setTokens(currentTokens);
      localStorage.setItem('drive_vault_tokens', JSON.stringify(currentTokens));
    }
    console.log('[App] Fetching user profile, using tokens:', !!activeTokens);
    
    try {
      const headers: any = {};
      if (activeTokens) {
        headers['x-goog-tokens'] = JSON.stringify(activeTokens);
      }
      
      const controller = new AbortController();
      const fetchTimeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(`${API_BASE_URL}/api/auth/me`, { 
        headers,
        credentials: 'include',
        signal: controller.signal
      });
      clearTimeout(fetchTimeout);
      
      console.log('[App] Fetch user response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('[App] User data received:', data);
        setUser(data);
        localStorage.setItem('drive_vault_user', JSON.stringify(data));
        setIsLoading(false);
        
        fetchFiles(currentFolderIdRef.current || 'root', activeTokens, fileFilterRef.current === 'all' ? undefined : fileFilterRef.current);
        fetchRecentFiles(activeTokens);
        fetchStorage(activeTokens);
        fetchStorageBreakdown(activeTokens);
        fetchTrash(activeTokens);
        fetchHiddenFiles(activeTokens);
      } else if (res.status === 401) {
        // Explicitly unauthorized - server is awake, but tokens missing/invalid
        console.log('[App] User not authenticated (401)');
        setUser(null);
        localStorage.removeItem('drive_vault_user');
        localStorage.removeItem('drive_vault_tokens');
        
        if (Capacitor.isNativePlatform()) {
          import('@capawesome/capacitor-google-sign-in').then(({ GoogleSignIn }) => {
            GoogleSignIn.signOut().catch(console.error);
          });
        }
        setIsLoading(false);
      } else {
        throw new Error(`Server error: ${res.status}`);
      }
    } catch (err: any) {
      console.error('[App] Fetch user error:', err);
      setUser(null);
      setIsLoading(false);
    }
  };

  const fetchStorage = async (currentTokens?: any) => {
    const activeTokens = currentTokens || tokens;
    try {
      const headers: any = {};
      if (activeTokens) {
        headers['x-goog-tokens'] = JSON.stringify(activeTokens);
      }
      const res = await fetch(`${API_BASE_URL}/api/drive/about`, { headers, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStorageInfo(data.storageQuota);
      }
    } catch (err) {
      console.error('Error fetching storage:', err);
    }
  };

  const fetchStorageBreakdown = async (currentTokens?: any) => {
    const activeTokens = currentTokens || tokens;
    try {
      const headers: any = {};
      if (activeTokens) {
        headers['x-goog-tokens'] = JSON.stringify(activeTokens);
      }
      const res = await fetch(`${API_BASE_URL}/api/drive/breakdown`, { headers, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setStorageBreakdown(data);
      }
    } catch (err) {
      console.error('Error fetching storage breakdown:', err);
    }
  };

  const fetchRecentFiles = async (currentTokens?: any) => {
    const activeTokens = currentTokens || tokens;
    try {
      const headers: any = {};
      if (activeTokens) {
        headers['x-goog-tokens'] = JSON.stringify(activeTokens);
      }
      const res = await fetch(`${API_BASE_URL}/api/drive/files`, { headers, credentials: 'include' });
      if (res.ok) {
        const driveFiles = await res.json();
        const mapped = mapDriveFiles(driveFiles);
        setRecentFiles(mapped);
      }
    } catch (err) {
      console.error('Error fetching recent files:', err);
    }
  };

  const fetchTrash = async (currentTokens?: any) => {
    const activeTokens = currentTokens || tokens;
    try {
      const headers: any = {};
      if (activeTokens) {
        headers['x-goog-tokens'] = JSON.stringify(activeTokens);
      }
      const res = await fetch(`${API_BASE_URL}/api/drive/trash`, { headers, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setTrashedFiles(mapDriveFiles(data));
      }
    } catch (err) {
      console.error('Error fetching trash:', err);
    }
  };

  const fetchHiddenFiles = async (currentTokens?: any) => {
    const activeTokens = currentTokens || tokens;
    try {
      const headers: any = {};
      if (activeTokens) headers['x-goog-tokens'] = JSON.stringify(activeTokens);
      const res = await fetch(`${API_BASE_URL}/api/drive/hidden`, { headers, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setHiddenFiles(mapDriveFiles(data));
      }
    } catch (err) {
      console.error('Error fetching hidden files:', err);
    }
  };

  const mapDriveFiles = (driveFiles: any[]): FileItem[] => {
    return driveFiles.map((f: any) => {
      let type: FileItem['type'] = 'other';
      if (f.mimeType === 'application/vnd.google-apps.folder') {
        type = 'folder';
      } else if (f.mimeType.includes('image')) {
        type = 'image';
      } else if (f.mimeType.includes('video')) {
        type = 'video';
      } else if (f.mimeType.includes('audio')) {
        type = 'audio';
      } else if (f.mimeType.includes('pdf') || f.mimeType.includes('document') || f.mimeType.includes('spreadsheet') || f.mimeType.includes('presentation') || f.mimeType.includes('text/')) {
        type = 'document';
      } else if (f.mimeType === 'application/vnd.android.package-archive' || f.name.toLowerCase().endsWith('.apk')) {
        type = 'apk';
      } else if (f.mimeType.includes('zip') || f.mimeType.includes('rar') || f.mimeType.includes('tar') || f.mimeType.includes('7z')) {
        type = 'archive';
      }

      return {
        id: f.id,
        name: f.name,
        type,
        size: f.size ? formatBytes(parseInt(f.size)) : (type === 'folder' ? 'Folder' : '0 B'),
        sizeBytes: parseInt(f.size || '0'),
        date: new Date(f.createdTime).toLocaleDateString(),
        timestamp: new Date(f.createdTime).getTime(),
        thumbnail: f.thumbnailLink,
        webViewLink: f.webViewLink,
        starred: f.starred,
        shared: f.shared,
        isHidden: f.properties?.isHidden === 'true',
        createdTime: f.createdTime,
        modifiedTime: f.modifiedTime,
        parents: f.parents
      };
    });
  };

  const fetchFiles = async (folderId: string = 'root', currentTokens?: any, filter?: string) => {
    const activeTokens = currentTokens || tokens;
    console.log(`[App] Fetching Drive files for folder: ${folderId}, filter: ${filter}`);
    try {
      const headers: any = {};
      if (activeTokens) {
        headers['x-goog-tokens'] = JSON.stringify(activeTokens);
      }

      let url = `/api/drive/files?folderId=${folderId}`;
      if (filter) url += `&filter=${filter}`;

      const res = await fetch(`${API_BASE_URL}${url}`, { 
        headers,
        credentials: 'include' 
      });
      
      if (res.ok) {
        const driveFiles = await res.json();
        const mappedFiles = mapDriveFiles(driveFiles);
        setFiles(mappedFiles);
      } else {
        console.error('[App] Failed to fetch files:', res.status);
      }
    } catch (err) {
      console.error('[App] Error fetching files:', err);
    }
  };

  const navigateToFolder = (folderId: string, folderName: string, isBacking: boolean = false) => {
    setCurrentFolderId(folderId);
    currentFolderIdRef.current = folderId; // keep ref in sync
    setFileFilter('all');
    fileFilterRef.current = 'all';
    setBreadcrumb(prev => {
      const index = prev.findIndex(b => b.id === folderId);
      let newBreadcrumb = prev;
      if (index !== -1) {
        newBreadcrumb = prev.slice(0, index + 1);
      } else {
        newBreadcrumb = [...prev, {id: folderId, name: folderName}];
      }
      
      if (!isBacking) {
        window.history.pushState({ folderId, folderName }, '', '');
      }
      
      return newBreadcrumb;
    });
    fetchFiles(folderId);
  };

  // ── MOUNT ONLY: fetch user + attach event listeners ──────────────────────
  // This runs ONCE. Do NOT add currentFolderId or user here — that would
  // restart the whole effect (and re-add listeners) on every navigation.
  useEffect(() => {
    fetchUser();

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const newTokens = event.data.tokens;
        if (newTokens) {
          setIsLoading(true);
          setTokens(newTokens);
          localStorage.setItem('drive_vault_tokens', JSON.stringify(newTokens));
          toast.success('Successfully signed in with Google');
          fetchUser(newTokens);
        } else {
          setIsLoading(true);
          toast.success('Successfully signed in with Google');
          setTimeout(() => fetchUser(), 800);
        }
      }
    };

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.folderId) {
        navigateToFolder(event.state.folderId, event.state.folderName, true);
      }
      // Ignore null states. If the file picker or OS triggers a spurious popstate,
      // we don't want to forcefully throw the user out to 'root'.
    };

    window.addEventListener('message', handleMessage);
    window.addEventListener('popstate', handlePopState);
    window.history.replaceState({ folderId: 'root', folderName: 'My Drive' }, '', '');

    return () => {
      window.removeEventListener('message', handleMessage);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []); // ← empty deps: truly runs once on mount

  // ── ANDROID BACK GESTURE / BUTTON ─────────────────────────────────
  // Priority order:
  //   1. Close any open dialog (move/share)
  //   2. Navigate up in folder hierarchy
  //   3. Go back to Home tab
  //   4. Minimize app (don't kill it)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const setupAppBackListener = async () => {
      const listener = await CapApp.addListener('backButton', async ({ canGoBack }) => {
        // Dispatch custom event to see if any sub-component wants to consume the back gesture
        const backEvent = new CustomEvent('vault-back', { 
          cancelable: true,
          detail: { canGoBack }
        });
        window.dispatchEvent(backEvent);

        // If a component called preventDefault(), it "consumed" the back press
        if (backEvent.defaultPrevented) return;

        // --- Fallback Global Priorities ---
        
        // 1. Close global dialogs managed in App.tsx
        if (isInfoOpen) { setIsInfoOpen(false); return; }
        if (isMoveOpen) { setIsMoveOpen(false); return; }
        if (isShareOpen) { setIsShareOpen(false); return; }

        // 2. Navigate up in folders (Stay in Files tab context)
        if (breadcrumb.length > 1) {
          const parent = breadcrumb[breadcrumb.length - 2];
          navigateToFolder(parent.id, parent.name, true);
          return;
        }

        // 3. If on a non-home tab, go to home
        if (activeTab !== 'home') {
          setActiveTab('home');
          return;
        }

        // 4. Finally, minimize
        CapApp.minimizeApp();
      });
      return listener;
    };

    const listenerPromise = setupAppBackListener();
    return () => {
      listenerPromise.then(l => l.remove());
    };
  }, [breadcrumb, activeTab, isMoveOpen, isShareOpen, isInfoOpen]);

  // ── BACKGROUND POLLING: only when logged in, paused when screen is off ───
  // Polls every 5 minutes (not 30s) to avoid battery drain and heating.
  // Pauses automatically when the app goes to background (screen off,
  // app switched, etc.) via the Page Visibility API.
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user || !tokens) return; // Don't poll if not authenticated

    const POLL_MS = 5 * 60 * 1000; // 5 minutes

    const runPoll = () => {
      if (document.hidden) return; // Skip if app is in background
      fetchStorage();
      fetchRecentFiles();
      // Only send filter if we are in root. In subfolders, we want the whole folder content so local filter works.
      const filterToSend = currentFolderIdRef.current === 'root' ? fileFilterRef.current : undefined;
      fetchFiles(currentFolderIdRef.current, undefined, filterToSend);
      // NOTE: fetchStorageBreakdown intentionally excluded from polling —
      // it scans every file in Drive and is too expensive for background use.
    };

    const startPolling = () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = setInterval(runPoll, POLL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App went to background — stop polling to save battery
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      } else {
        // App came back to foreground — refresh immediately then restart poll
        runPoll();
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, tokens]); // Only restart polling when auth state changes

  // ── RENDER KEEP-ALIVE: Ping every 10 min to prevent cold starts ─────────
  // Render free tier sleeps after 15 min of inactivity causing 401/timeout
  // on next login. This silent ping keeps the server warm.
  useEffect(() => {
    if (!user) return; // Only ping when logged in
    const KEEP_ALIVE_MS = 10 * 60 * 1000; // 10 minutes
    const ping = () => {
      if (document.hidden) return; // Don't ping if app is in background
      fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: tokens ? { 'x-goog-tokens': JSON.stringify(tokens) } : {},
        credentials: 'include',
      }).catch(() => {}); // Silently ignore errors
    };
    const id = setInterval(ping, KEEP_ALIVE_MS);
    return () => clearInterval(id);
  }, [user, tokens]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', isDarkMode.toString());
  }, [isDarkMode]);

  const handleHideFile = async (id: string) => {
    try {
      const headers: any = {};
      if (tokens) headers['x-goog-tokens'] = JSON.stringify(tokens);
      
      const res = await fetch(`${API_BASE_URL}/api/drive/files/${id}/hide`, { 
        method: 'POST',
        headers,
        credentials: 'include' 
      });
      
      if (res.ok) {
        setFiles(prev => prev.filter(f => f.id !== id));
        setRecentFiles(prev => prev.filter(f => f.id !== id));
        fetchHiddenFiles();
        toast.success('File hidden');
      } else {
        const errText = await res.text();
        throw new Error(errText || 'Server returned an error');
      }
    } catch (err: any) {
      console.error('Error hiding file:', err);
      toast.error('Failed to hide file: ' + err.message);
    }
  };

  // Bulk unhide array
  const handleUnhideFiles = async (ids: string[]) => {
    try {
      const headers: any = {};
      if (tokens) headers['x-goog-tokens'] = JSON.stringify(tokens);
      
      const promises = ids.map(id => fetch(`${API_BASE_URL}/api/drive/files/${id}/unhide`, {
        method: 'POST',
        headers,
        credentials: 'include'
      }));

      await Promise.all(promises);
      
      // Update hidden files immediately locally
      setHiddenFiles(prev => prev.filter(f => !ids.includes(f.id)));
      fetchFiles(currentFolderId);
      fetchRecentFiles();
      toast.success(`${ids.length} files unhidden`);
    } catch (err) {
      console.error('Error unhiding files:', err);
      toast.error('Failed to unhide files');
    }
  };

  const handleDeleteFile = async (id: string) => {
    try {
      const headers: any = {};
      if (tokens) headers['x-goog-tokens'] = JSON.stringify(tokens);
      
      const res = await fetch(`${API_BASE_URL}/api/drive/files/${id}`, { 
        method: 'DELETE',
        headers,
        credentials: 'include' 
      });
      
      if (res.ok) {
        setFiles(prev => prev.filter(f => f.id !== id));
        fetchRecentFiles();
        fetchTrash();
        
        // Use a 1.5s delay to let Google Drive index catch up, then fetch real counts
        setTimeout(() => {
          fetchStorage();
          fetchStorageBreakdown();
        }, 1500);

        toast.success('Moved to trash');
      }
    } catch (err) {
      console.error('Error deleting file:', err);
    }
  };

  const handleRestoreFile = async (id: string) => {
    try {
      const headers: any = {};
      if (tokens) headers['x-goog-tokens'] = JSON.stringify(tokens);
      
      const res = await fetch(`${API_BASE_URL}/api/drive/files/${id}/restore`, { 
        method: 'POST',
        headers,
        credentials: 'include' 
      });
      
      if (res.ok) {
        setTrashedFiles(prev => prev.filter(f => f.id !== id));
        fetchFiles(currentFolderId);
        fetchRecentFiles();

        // Use a 1.5s delay to let Google Drive index catch up, then fetch real counts
        setTimeout(() => {
          fetchStorage();
          fetchStorageBreakdown();
        }, 1500);

        toast.success('File restored');
      }
    } catch (err) {
      console.error('Error restoring file:', err);
    }
  };

  const handlePermanentDelete = async (id: string) => {
    try {
      const headers: any = {};
      if (tokens) headers['x-goog-tokens'] = JSON.stringify(tokens);
      
      const res = await fetch(`${API_BASE_URL}/api/drive/files/${id}/permanent`, { 
        method: 'DELETE',
        headers,
        credentials: 'include' 
      });
      
      if (res.ok) {
        setTrashedFiles(prev => prev.filter(f => f.id !== id));
        fetchStorageBreakdown();
        toast.success('Permanently deleted');
      }
    } catch (err) {
      console.error('Error permanent delete:', err);
    }
  };



  useEffect(() => {
    fetchUser();

    // Request notification permission if native platform and notification toggle is enabled
    const requestNotificationPermission = async () => {
      try {
        const saved = localStorage.getItem('drive_vault_notification_enabled');
        const isEnabled = saved !== null ? saved === 'true' : true;
        if (isEnabled && Capacitor.isNativePlatform()) {
          const state = await UploadNotification.checkPermissions();
          if (state.notifications !== 'granted') {
            await UploadNotification.requestPermissions({ permissions: ['notifications'] });
          }
        }
      } catch (err) {
        console.error('Error requesting notification permission:', err);
      }
    };
    requestNotificationPermission();

    // Check launch intent on startup
    const checkLaunchIntent = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const res = await UploadNotification.checkLaunchIntent();
          if (res && res.openTab === 'settings_history') {
            setActiveTab('settings');
            setDefaultOpenTransfers(true);
          }
        }
      } catch (err) {
        console.error('Error checking native launch intent:', err);
      }
    };
    checkLaunchIntent();

    // Re-check intent when app comes to foreground
    let appStateListener: any;
    if (Capacitor.isNativePlatform()) {
      CapApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          checkLaunchIntent();
        }
      }).then(l => appStateListener = l);
    }

    // Register active notification callbacks
    let notifListener: any;
    try {
      if (Capacitor.isNativePlatform()) {
        UploadNotification.addListener('onNotificationAction', (data: any) => {
          const { action, id } = data;
          if (action === 'pause') {
            handlePauseTransfer(id);
          } else if (action === 'resume') {
            handleResumeTransfer(id);
          } else if (action === 'cancel') {
            handleCancelTransfer(id);
          }
        }).then(l => notifListener = l);
      }
    } catch (err) {
      console.error('Error registering native notification action listeners:', err);
    }

    return () => {
      if (appStateListener) appStateListener.remove();
      if (notifListener) notifListener.remove();
    };
  }, []);

  const handleShareFile = async (id: string) => {
    const file = files.find(f => f.id === id) || recentFiles.find(f => f.id === id);
    if (file) {
      setFileToShare(file);
      setIsShareOpen(true);
    }
  };

  const handleTabChange = (tab: string) => {
    setCurrentFilter(tab);
    if (tab === 'all') {
      fetchFiles(currentFolderId);
    } else {
      // Switching to recent/starred/shared resets folder to root
      setBreadcrumb([{id: 'root', name: 'My Drive'}]);
      setCurrentFolderId('root');
      currentFolderIdRef.current = 'root'; // keep ref in sync
      fetchFiles('root', undefined, tab);
    }
  };

  const performResumableUpload = (transferId: string, uploadUrl: string, file: File, nextByte: number, uploadToFolder: string) => {
    uploadSessionsRef.current[transferId] = { uploadUrl, file, currentFolderId: uploadToFolder };

    // 8MB chunk size to completely prevent bridge bottlenecks and excessive memory usage
    const CHUNK_SIZE = 8 * 1024 * 1024;
    const chunkStart = nextByte;
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, file.size);
    const chunkLength = chunkEnd - chunkStart;
    const fileSlice = file.slice(chunkStart, chunkEnd);

    const xhr = new XMLHttpRequest();
    activeUploadsRef.current[transferId] = xhr;

    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Range', `bytes ${chunkStart}-${chunkEnd - 1}/${file.size}`);
    xhr.setRequestHeader('Content-Length', chunkLength.toString());
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    let startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const now = Date.now();
        const timeDiff = (now - lastTime) / 1000;
        
        if (timeDiff > 0.3 || event.loaded === event.total) {
          const absoluteLoaded = chunkStart + event.loaded;
          const absoluteTotal = file.size;
          const bytesDiff = absoluteLoaded - (lastLoaded + chunkStart);
          const instantSpeed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
          
          // Smoothen the speed using Exponential Moving Average (EMA) with alpha = 0.15
          const prevSpeed = uploadSpeedsRef.current[transferId] || 0;
          const speed = prevSpeed === 0 ? instantSpeed : (0.15 * instantSpeed) + (0.85 * prevSpeed);
          uploadSpeedsRef.current[transferId] = speed;

          const remainingBytes = absoluteTotal - absoluteLoaded;
          const remainingSeconds = speed > 0 ? remainingBytes / speed : 0;
          const progress = Math.round((absoluteLoaded / absoluteTotal) * 100);
          
          lastLoaded = event.loaded;
          lastTime = now;

          setTransfers(prev => prev.map(t => t.id === transferId ? { 
            ...t, 
            progress,
            speed,
            remainingSeconds,
            loaded: absoluteLoaded,
            total: absoluteTotal
          } : t));

          // Native notification progress
          try {
            if (Capacitor.isNativePlatform() && isNotificationEnabled) {
              const speedText = speed > 1048576 ? `${(speed / 1048576).toFixed(1)} MB/s` : `${(speed / 1024).toFixed(0)} KB/s`;
              const etaText = remainingSeconds > 60 ? `${Math.floor(remainingSeconds/60)}m left` : `${Math.round(remainingSeconds)}s left`;
              
              UploadNotification.showProgressNotification({
                id: transferId,
                title: file.name,
                progress,
                speedText: `${speedText} • ${etaText}`,
                isPaused: false
              });
            }
          } catch {}
        }
      }
    };

    xhr.onload = () => {
      delete activeUploadsRef.current[transferId];
      if (xhr.status === 200 || xhr.status === 201 || xhr.status === 308) {
        if (xhr.status === 200 || xhr.status === 201 || chunkEnd >= file.size) {
          setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'completed', progress: 100 } : t));
          delete uploadSessionsRef.current[transferId];
          delete uploadSpeedsRef.current[transferId];

          try {
            if (Capacitor.isNativePlatform() && isNotificationEnabled) {
              UploadNotification.showSuccessNotification({
                id: transferId,
                title: file.name
              });
            }
          } catch {}

          const folderLabel = uploadToFolder === 'root' ? 'My Drive' : (breadcrumb[breadcrumb.length - 1]?.name || 'Folder');
          const histEntry = { id: transferId, name: file.name, folderId: uploadToFolder, folderName: folderLabel, date: new Date().toISOString(), size: file.size };
          try {
            const hist = JSON.parse(localStorage.getItem('drive_vault_upload_history') || '[]');
            hist.unshift(histEntry);
            localStorage.setItem('drive_vault_upload_history', JSON.stringify(hist.slice(0, 200)));
          } catch {}
          toast.success(`Uploaded ${file.name} to ${folderLabel}`);
          if (uploadToFolder === currentFolderIdRef.current) {
            fetchFiles(uploadToFolder, undefined, fileFilterRef.current);
          }
          fetchStorage();
          fetchStorageBreakdown(); 
          fetchRecentFiles();
        } else {
          // Google resumable redirect response indicates next chunk index range
          let rangeHeader = xhr.getResponseHeader('Range');
          let nextStart = chunkEnd;
          if (rangeHeader) {
            const parts = rangeHeader.split('-');
            if (parts.length > 1) {
              nextStart = parseInt(parts[1], 10) + 1;
            }
          }
          // Recursively push subsequent chunk
          performResumableUpload(transferId, uploadUrl, file, nextStart, uploadToFolder);
        }
      } else {
        delete uploadSpeedsRef.current[transferId];
        setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'error' } : t));
        toast.error(`Failed to upload ${file.name}`);
      }
    };

    xhr.onerror = () => {
      delete activeUploadsRef.current[transferId];
      delete uploadSpeedsRef.current[transferId];
      setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'error' } : t));
      toast.error(`Error uploading ${file.name}`);
    };

    xhr.onabort = () => {
      delete activeUploadsRef.current[transferId];
      delete uploadSpeedsRef.current[transferId];
    };

    xhr.send(fileSlice);
  };

  const handleUploadFile = async (file: File, relativePath?: string, targetFolderId?: string) => {
    const uploadToFolder = targetFolderId ?? currentFolderIdRef.current ?? 'root';
    const transferId = Math.random().toString(36).substring(7);
    
    setTransfers(prev => [...prev, {
      id: transferId,
      name: file.name,
      progress: 0,
      status: 'pending',
      type: 'upload'
    }]);

    try {
      setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'uploading' } : t));

      const initRes = await fetch(`${API_BASE_URL}/api/drive/upload-init`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(tokens ? { 'x-goog-tokens': JSON.stringify(tokens) } : {})
        },
        body: JSON.stringify({
          parentId: uploadToFolder,
          relativePath: relativePath,
          filename: file.name
        }),
        credentials: 'include'
      });

      if (!initRes.ok) throw new Error('Failed to initialize upload');
      const { targetFolderId, accessToken } = await initRes.json();

      const sessionRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': file.type || 'application/octet-stream',
          'X-Upload-Content-Length': file.size.toString()
        },
        body: JSON.stringify({
          name: file.name,
          parents: [targetFolderId]
        })
      });

      if (!sessionRes.ok) throw new Error('Failed to start Google Drive upload session');
      const uploadUrl = sessionRes.headers.get('Location');
      if (!uploadUrl) throw new Error('No upload URL returned from Google');

      performResumableUpload(transferId, uploadUrl, file, 0, uploadToFolder);
    } catch (err) {
      console.error('Error initiating upload:', err);
      setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'error' } : t));
      toast.error(`Error uploading ${file.name}`);
    }
  };

  const handlePauseTransfer = (id: string) => {
    const xhr = activeUploadsRef.current[id];
    if (xhr) {
      xhr.abort();
    }
    setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'paused' } : t));
    
    try {
      if (Capacitor.isNativePlatform() && isNotificationEnabled) {
        const transfer = transfers.find(t => t.id === id);
        UploadNotification.showProgressNotification({
          id,
          title: transfer?.name || 'File Upload',
          progress: transfer?.progress || 0,
          speedText: 'Paused',
          isPaused: true
        });
      }
    } catch {}
  };

  const handleResumeTransfer = async (id: string) => {
    const session = uploadSessionsRef.current[id];
    if (!session) {
      toast.error('Cannot resume: Upload session expired');
      return;
    }

    setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'uploading' } : t));

    try {
      if (Capacitor.isNativePlatform() && isNotificationEnabled) {
        UploadNotification.showProgressNotification({
          id,
          title: session.file.name,
          progress: transfers.find(t => t.id === id)?.progress || 0,
          speedText: 'Resuming...',
          isPaused: false
        });
      }
    } catch {}

    try {
      const checkRes = await fetch(session.uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Range': `bytes */${session.file.size}`
        }
      });

      if (checkRes.status === 200 || checkRes.status === 201) {
        setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'completed', progress: 100 } : t));
        delete uploadSessionsRef.current[id];
        toast.success(`Uploaded ${session.file.name}`);
        return;
      }

      let nextByte = 0;
      if (checkRes.status === 308) {
        const rangeHeader = checkRes.headers.get('Range');
        if (rangeHeader) {
          const match = rangeHeader.match(/bytes=0-(\d+)/);
          if (match && match[1]) {
            nextByte = parseInt(match[1]) + 1;
          }
        }
      } else {
        throw new Error('Google resumed upload status check failed');
      }

      performResumableUpload(id, session.uploadUrl, session.file, nextByte, session.currentFolderId);
    } catch (err) {
      console.error('Error resuming transfer:', err);
      setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'error' } : t));
      toast.error(`Error resuming upload of ${session.file.name}`);
    }
  };

  const handleCancelTransfer = (id: string) => {
    const xhr = activeUploadsRef.current[id];
    if (xhr) {
      xhr.abort();
    }
    setTransfers(prev => prev.map(t => t.id === id ? { ...t, status: 'error', name: `${t.name} (Cancelled)` } : t));
    delete uploadSessionsRef.current[id];
    
    try {
      if (Capacitor.isNativePlatform()) {
        UploadNotification.cancelNotification({ id });
      }
    } catch {}
    toast.error('Upload cancelled');
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (Capacitor.isNativePlatform()) return;
    dragCounter.current++;
    if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
      setIsGlobalDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (Capacitor.isNativePlatform()) return;
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsGlobalDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (Capacitor.isNativePlatform()) return;
    
    setIsGlobalDragging(false);
    dragCounter.current = 0;

    if (!e.dataTransfer) return;

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) return;

    const traverseFileTree = async (item: any, path: string = '') => {
      if (item.isFile) {
        item.file((file: File) => {
          handleUploadFile(file, path + file.name);
        });
      } else if (item.isDirectory) {
        const dirReader = item.createReader();
        const readEntries = () => {
          dirReader.readEntries(async (entries: any[]) => {
            if (entries.length > 0) {
              for (const entry of entries) {
                await traverseFileTree(entry, path + item.name + '/');
              }
              readEntries(); // Read more entries if directory is large
            }
          });
        };
        readEntries();
      }
    };

    for (let i = 0; i < items.length; i++) {
      const item = items[i].webkitGetAsEntry();
      if (item) {
        traverseFileTree(item);
      }
    }
  };

  const handleCreateFolder = async (name: string, targetFolderId?: string) => {
    try {
      const parentId = targetFolderId || currentFolderId;
      const headers: any = { 'Content-Type': 'application/json' };
      if (tokens) headers['x-goog-tokens'] = JSON.stringify(tokens);
      
      const res = await fetch(`${API_BASE_URL}/api/drive/folders`, { 
        method: 'POST',
        headers,
        body: JSON.stringify({ name, parentId }),
        credentials: 'include' 
      });
      
      if (res.ok) {
        const newFolder = await res.json();
        const mapped = mapDriveFiles([newFolder])[0];
        if (parentId === currentFolderIdRef.current) {
          setFiles(prev => [mapped, ...prev]);
        }
        toast.success(`Folder "${name}" created`);
        fetchStorage();
        fetchStorageBreakdown();
        // Delay fetch slightly to allow Google Drive indexing to update the category counts reliably
        setTimeout(() => {
          fetchStorageBreakdown();
        }, 1500);
      }
    } catch (err) {
      console.error('Error creating folder:', err);
      toast.error('Failed to create folder');
    }
  };

  const handleRenameFile = async (id: string, newName: string) => {
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (tokens) headers['x-goog-tokens'] = JSON.stringify(tokens);
      
      const res = await fetch(`${API_BASE_URL}/api/drive/files/${id}`, { 
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: newName }),
        credentials: 'include' 
      });
      
      if (res.ok) {
        const updatedFile = await res.json();
        const mapped = mapDriveFiles([updatedFile])[0];
        setFiles(prev => prev.map(f => f.id === id ? { ...f, name: mapped.name } : f));
        setRecentFiles(prev => prev.map(f => f.id === id ? { ...f, name: mapped.name } : f));
        toast.success(`Renamed to "${newName}"`);
      }
    } catch (err) {
      console.error('Error renaming file:', err);
      toast.error('Failed to rename');
    }
  };

  const handleStarFile = async (id: string, starred: boolean) => {
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (tokens) headers['x-goog-tokens'] = JSON.stringify(tokens);
      
      const res = await fetch(`${API_BASE_URL}/api/drive/files/${id}/star`, { 
        method: 'POST',
        headers,
        body: JSON.stringify({ starred }),
        credentials: 'include' 
      });
      
      if (res.ok) {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, starred } : f));
        setRecentFiles(prev => prev.map(f => f.id === id ? { ...f, starred } : f));
        toast.success(starred ? 'Added to Starred' : 'Removed from Starred');
      }
    } catch (err) {
      console.error('Error starring file:', err);
      toast.error('Failed to update star');
    }
  };

  const handleMoveFile = async (newParentId: string, ids?: string[]) => {
    const targetIds = ids || (fileToMove ? [fileToMove.id] : []);
    if (targetIds.length === 0) return;

    const moveCount = targetIds.length;
    let successCount = 0;

    const performMove = async (id: string) => {
      const headers: any = { 'Content-Type': 'application/json' };
      if (tokens) headers['x-goog-tokens'] = JSON.stringify(tokens);
      
      const res = await fetch(`${API_BASE_URL}/api/drive/files/${id}/move`, { 
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          newParentId, 
          oldParentId: 'root' // Server handles picking up correct old parents if needed, but 'root' is safe fallback
        }),
        credentials: 'include' 
      });
      return res.ok;
    };

    try {
      if (moveCount > 1) toast.loading(`Moving ${moveCount} items...`, { id: 'move-toast' });
      
      for (const id of targetIds) {
        const success = await performMove(id);
        if (success) successCount++;
      }

      if (successCount > 0) {
        setFiles(prev => prev.filter(f => !targetIds.includes(f.id)));
        setRecentFiles(prev => prev.filter(f => !targetIds.includes(f.id)));
        fetchStorage();
        fetchStorageBreakdown();
        if (moveCount > 1) {
          toast.success(`Moved ${successCount} items successfully`, { id: 'move-toast' });
        } else {
          toast.success('File moved successfully');
        }
      } else {
        if (moveCount > 1) toast.error('Failed to move items', { id: 'move-toast' });
        else toast.error('Failed to move file');
      }
    } catch (err) {
      console.error('Error moving files:', err);
      toast.error('Failed to move items');
    } finally {
      setIsMoveOpen(false);
      setFileToMove(null);
    }
  };

  const handleLogout = async () => {
    const headers: any = {};
    if (tokens) {
      headers['x-goog-tokens'] = JSON.stringify(tokens);
    }
    await fetch(`${API_BASE_URL}/api/auth/logout`, { 
      method: 'POST', 
      headers,
      credentials: 'include' 
    });
    setUser(null);
    setTokens(null);
    setFiles([]);
    localStorage.removeItem('drive_vault_user');
    localStorage.removeItem('drive_vault_tokens');
    sessionStorage.removeItem('drive_vault_active_tab');
    sessionStorage.removeItem('drive_vault_current_folder_id');
    sessionStorage.removeItem('drive_vault_breadcrumb');
    sessionStorage.removeItem('drive_vault_file_filter');
    
    // Reset React state variables back to defaults on logout
    setActiveTab('home');
    setCurrentFolderId('root');
    setBreadcrumb([{id: 'root', name: 'My Drive'}]);
    setFileFilter('all');
    
    if (Capacitor.isNativePlatform()) {
      import('@capawesome/capacitor-google-sign-in').then(({ GoogleSignIn }) => {
        GoogleSignIn.signOut().catch(console.error);
      });
    }
    
    toast.info('Logged out');
  };

  if (!isUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 mb-6 shadow-lg shadow-blue-500/20">
          <Shield size={40} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white mb-2">App Locked</h1>
        <p className="text-slate-500 dark:text-slate-400 text-center mb-10 text-sm font-medium">Please authenticate to access your Drive Vault</p>
        <button 
          onClick={checkBiometric} 
          className="rounded-2xl px-10 h-14 bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xl shadow-blue-500/30 transition-all active:scale-95"
        >
          Unlock App
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-905 bg-slate-900 text-white font-sans">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-semibold text-slate-400">Loading Drive Vault...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Login onLoginSuccess={fetchUser} />
        <Toaster position="top-center" />
      </>
    );
  }

  const handleCategoryClick = (type: string) => {
    setFileFilter(type);
    setCurrentFolderId('root');
    setBreadcrumb([{id: 'root', name: 'My Drive'}]);
    fetchFiles('root', undefined, type); // Pass type so backend searches ALL Drive by mimeType
    setActiveTab('files');
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return (
          <Dashboard 
            user={user} 
            tokens={tokens}
            files={recentFiles} 
            storageInfo={storageInfo} 
            storageBreakdown={storageBreakdown}
            onUpload={handleUploadFile} 
            setActiveTab={setActiveTab} 
            onRefreshStorage={() => {
              fetchStorage();
              fetchStorageBreakdown();
            }} 
            onCategoryClick={handleCategoryClick}
            onCreateFolder={handleCreateFolder}
            onRename={handleRenameFile}
            onDelete={handleDeleteFile}
            onShare={handleShareFile}
            onHide={handleHideFile}
            onStar={handleStarFile}
            onMove={(ids, targetFolderId) => {
              const idList = Array.isArray(ids) ? ids : [ids];
              if (targetFolderId) {
                handleMoveFile(targetFolderId, idList);
              } else {
                const file = recentFiles.find(f => f.id === idList[0]);
                if (file) {
                  setFileToMove(file);
                  setIsMoveOpen(true);
                }
              }
            }}
            onNavigateToFiles={() => setActiveTab('files')}
            isDownloadEnabled={isDownloadEnabled}
            onShowInfo={handleShowInfo}
          />
        );
      case 'files':
        return (
          <FileExplorer 
            files={files} 
            tokens={tokens}
            breadcrumb={breadcrumb}
            filterType={fileFilter}
            onFilterChange={(newType) => {
              setFileFilter(newType);
              fileFilterRef.current = newType;
              if (currentFolderId === 'root') {
                fetchFiles('root', undefined, newType === 'all' ? undefined : newType);
              }
            }}
            onNavigate={navigateToFolder}
            onDelete={handleDeleteFile}
            onUpload={handleUploadFile}
            onCreateFolder={handleCreateFolder}
            onRename={handleRenameFile}
            onShare={handleShareFile}
            onTabChange={handleTabChange}
            onStar={handleStarFile}
            onMove={(ids, targetFolderId) => {
              const idList = Array.isArray(ids) ? ids : [ids];
              if (targetFolderId) {
                handleMoveFile(targetFolderId, idList);
              } else {
                const file = files.find(f => f.id === idList[0]);
                if (file) {
                  setFileToMove(file);
                  setIsMoveOpen(true);
                }
              }
            }}
            onHide={handleHideFile}
            activeSubTab={currentFilter}
            isDownloadEnabled={isDownloadEnabled}
            onShowInfo={handleShowInfo}
          />
        );

      case 'settings':
        return (
          <Settings 
            user={user}
            setUser={setUser}
            isDarkMode={isDarkMode} 
            setIsDarkMode={setIsDarkMode} 
            onLogout={handleLogout}
            trashedFiles={trashedFiles}
            hiddenFiles={hiddenFiles}
            onRestore={handleRestoreFile}
            onUnhide={handleUnhideFiles}
            onPermanentDelete={handlePermanentDelete}
            transfers={transfers}
            onClearTransfers={() => setTransfers([])}
             isDownloadEnabled={isDownloadEnabled}
            setIsDownloadEnabled={(val) => {
              setIsDownloadEnabled(val);
              localStorage.setItem('drive_vault_download_permission', val.toString());
            }}
            isNotificationEnabled={isNotificationEnabled}
            setIsNotificationEnabled={handleToggleNotification}
            onCancelTransfer={handleCancelTransfer}
            onPauseTransfer={handlePauseTransfer}
            onResumeTransfer={handleResumeTransfer}
            defaultOpenTransfers={defaultOpenTransfers}
            onCloseTransfers={() => setDefaultOpenTransfers(false)}
          />
        );
      default:
        return <Dashboard 
          user={user} 
          tokens={tokens}
          files={recentFiles} 
          storageInfo={storageInfo} 
          storageBreakdown={storageBreakdown}
          onUpload={handleUploadFile} 
          setActiveTab={setActiveTab} 
          onRefreshStorage={() => {
            fetchStorage();
            fetchStorageBreakdown();
          }}
          onDelete={handleDeleteFile}
          onShare={handleShareFile}
          onStar={handleStarFile}
          onMove={(ids, targetFolderId) => {
            const idList = Array.isArray(ids) ? ids : [ids];
            if (targetFolderId) {
              handleMoveFile(targetFolderId, idList);
            } else {
              const file = recentFiles.find(f => f.id === idList[0]);
              if (file) {
                setFileToMove(file);
                setIsMoveOpen(true);
              }
            }
          }}
          onShowInfo={handleShowInfo}
        />;
    }
  };

  return (
    <div 
      className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-100 transition-colors duration-300"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="flex flex-col md:flex-row min-h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          user={user} 
          onLogout={handleLogout} 
        />

        {/* Main Content Area */}
        <main 
          ref={mainScrollRef}
          className="flex-1 relative flex flex-col min-h-screen md:max-h-screen overflow-y-auto w-full md:bg-white dark:md:bg-slate-900 md:shadow-2xl md:shadow-slate-200/50 dark:md:shadow-none"
        >
          {/* Mobile centered container look for mobile widths, full width for desktop widths */}
          <div className="w-full max-w-md mx-auto md:max-w-none md:mx-0 flex-1 flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="flex-1 flex flex-col"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
            <div className="h-24 md:hidden shrink-0" /> {/* Spacer for bottom nav */}
          </div>
        </main>

        <BottomNav activeTab={activeTab} setActiveTab={(tab) => {
          if (tab === 'files') {
            // Reset filter to ALL when nav-bar Files is tapped directly
            setFileFilter('all');
            setCurrentFolderId('root');
            setBreadcrumb([{id: 'root', name: 'My Drive'}]);
            fetchFiles('root');
          }
          setActiveTab(tab);
        }} />

        
        <TransferManager 
          transfers={transfers} 
          onDismiss={(id) => setTransfers(prev => prev.filter(t => t.id !== id))}
          onCloseAll={() => setTransfers([])} 
          onCancel={handleCancelTransfer}
          onPause={handlePauseTransfer}
          onResume={handleResumeTransfer}
        />
        
        <MoveDialog 
          isOpen={isMoveOpen}
          onClose={() => {
            setIsMoveOpen(false);
            setTimeout(() => setFileToMove(null), 200);
          }}
          onConfirm={handleMoveFile}
          file={fileToMove}
          folders={files.filter(f => f.type === 'folder')}
          currentFolderId={currentFolderId}
        />

        <ManageAccessDialog 
          isOpen={isShareOpen}
          onClose={() => {
            setIsShareOpen(false);
            setTimeout(() => setFileToShare(null), 200);
          }}
          file={fileToShare}
          tokens={tokens}
        />

        <InfoDialog
          isOpen={isInfoOpen}
          onClose={() => {
            setIsInfoOpen(false);
            setTimeout(() => setFileForInfo(null), 200);
          }}
          file={fileForInfo}
          breadcrumb={breadcrumb}
        />
      </div>
      <Toaster position="top-center" />

      {/* Global Drag & Drop Overlay */}
      {isGlobalDragging && (
        <div className="fixed inset-0 z-[9999] bg-blue-500/20 backdrop-blur-md flex items-center justify-center pointer-events-none transition-all">
          <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-2xl flex flex-col items-center border-4 border-blue-500 border-dashed">
            <div className="w-24 h-24 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500 animate-bounce mb-6">
              <Cloud size={48} />
            </div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2">Drop to Upload</h2>
            <p className="text-slate-500 font-medium">Release your files to upload them instantly</p>
          </div>
        </div>
      )}
    </div>
  );
}



