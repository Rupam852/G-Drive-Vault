// @ts-nocheck
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import Dashboard from './components/Dashboard';
import FileExplorer from './components/FileExplorer';
import Settings from './components/Settings';
import BottomNav from './components/BottomNav';
import Sidebar from './components/Sidebar';
import MoveDialog from './components/MoveDialog';
import ManageAccessDialog from './components/ManageAccessDialog';
import { formatBytes } from './utils';
import TransferManager, { TransferState } from './components/TransferManager';
import Login from './components/Login';
import { FileItem } from './types';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';



// Define API Base URL for mobile and production environments
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [user, setUser] = useState<any>(null);
  const [storageInfo, setStorageInfo] = useState<any>(null);
  const [tokens, setTokens] = useState<any>(() => {
    const saved = localStorage.getItem('drive_vault_tokens');
    return saved ? JSON.parse(saved) : null;
  });
  const [isLoading, setIsLoading] = useState(true);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [recentFiles, setRecentFiles] = useState<FileItem[]>([]);
  const [trashedFiles, setTrashedFiles] = useState<FileItem[]>([]);
  const [hiddenFiles, setHiddenFiles] = useState<FileItem[]>([]);
  const [fileFilter, setFileFilter] = useState<string>('all');
  const [currentFilter, setCurrentFilter] = useState('all');
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const currentFolderIdRef = useRef<string>('root'); // always latest, no stale closure
  const [breadcrumb, setBreadcrumb] = useState<{id: string, name: string}[]>([{id: 'root', name: 'My Drive'}]);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [fileToMove, setFileToMove] = useState<FileItem | null>(null);
  
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [fileToShare, setFileToShare] = useState<FileItem | null>(null);
  
  const [transfers, setTransfers] = useState<TransferState[]>([]);
  const [storageBreakdown, setStorageBreakdown] = useState<any>(null);
  const [isDownloadEnabled, setIsDownloadEnabled] = useState(() => {
    const saved = localStorage.getItem('drive_vault_download_permission');
    return saved !== null ? saved === 'true' : true;
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('darkMode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

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
      
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, { 
        headers,
        credentials: 'include' 
      });
      
      console.log('[App] Fetch user response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('[App] User data received:', data);
        setUser(data);
        fetchFiles('root', activeTokens);
        fetchRecentFiles(activeTokens);
        fetchStorage(activeTokens);
        fetchStorageBreakdown(activeTokens);
        fetchTrash(activeTokens);
        fetchHiddenFiles(activeTokens);
      } else {
        const errText = await res.statusText;
        console.log('[App] User not authenticated:', errText);
        // Only toast if we actually had tokens but it failed (not if just first load)
        if (activeTokens) toast.error(`Failed to fetch profile: ${res.status} ${errText}`);
        setUser(null);
        if (!activeTokens) setIsLoading(false);
      }
    } catch (err: any) {
      console.error('[App] Fetch user error:', err);
      toast.error(`Network error: ${err.message || 'Check your internet connection or backend URL'}`);
      setUser(null);
      setIsLoading(false);
    } finally {
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
        isHidden: f.properties?.isHidden === 'true'
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
          setTokens(newTokens);
          localStorage.setItem('drive_vault_tokens', JSON.stringify(newTokens));
          toast.success('Successfully signed in with Google');
          fetchUser(newTokens);
        } else {
          toast.success('Successfully signed in with Google');
          setTimeout(() => fetchUser(), 800);
        }
      }
    };

    const handlePopState = (event: PopStateEvent) => {
      if (event.state && event.state.folderId) {
        navigateToFolder(event.state.folderId, event.state.folderName, true);
      } else {
        navigateToFolder('root', 'My Drive', true);
      }
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
  }, [breadcrumb, activeTab, isMoveOpen, isShareOpen]);

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
      fetchFiles(currentFolderId);
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
        fetchStorage();
        fetchRecentFiles();
        fetchTrash();
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
        toast.success('Permanently deleted');
      }
    } catch (err) {
      console.error('Error permanent delete:', err);
    }
  };



  useEffect(() => {
    fetchUser();
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
      // If we are looking at specific categories (recent/starred), 
      // it doesn't make sense to show a specific folder breadcrumb.
      setBreadcrumb([{id: 'root', name: 'My Drive'}]);
      setCurrentFolderId('root');
      fetchFiles('root', undefined, tab);
    }
  };

  // targetFolderId allows callers (Dashboard) to force a specific folder (e.g. 'root')
  // When called from FileExplorer, targetFolderId is undefined → uses currentFolderIdRef (current folder)
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
      const formData = new FormData();
      formData.append('file', file);
      formData.append('parentId', uploadToFolder);
      if (relativePath) formData.append('relativePath', relativePath);
      
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/api/drive/upload`, true);
      xhr.withCredentials = true;
      if (tokens) {
        xhr.setRequestHeader('x-goog-tokens', JSON.stringify(tokens));
      }

      setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'uploading' } : t));

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100);
          setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, progress } : t));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const uploadedFile = JSON.parse(xhr.responseText);
          const mapped = mapDriveFiles([uploadedFile])[0];
          setFiles(prev => [mapped, ...prev]);
          fetchStorage();
          fetchRecentFiles();
          setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'completed', progress: 100 } : t));
          toast.success(`Uploaded ${file.name}`);
        } else {
          setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'error' } : t));
          toast.error(`Failed to upload ${file.name}`);
        }
      };

      xhr.onerror = () => {
        setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'error' } : t));
        toast.error(`Error uploading ${file.name}`);
      };

      xhr.send(formData);
    } catch (err) {
      console.error('Error initiating upload:', err);
      setTransfers(prev => prev.map(t => t.id === transferId ? { ...t, status: 'error' } : t));
      toast.error(`Error uploading ${file.name}`);
    }
  };

  const handleCreateFolder = async (name: string) => {
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (tokens) headers['x-goog-tokens'] = JSON.stringify(tokens);
      
      const res = await fetch(`${API_BASE_URL}/api/drive/folders`, { 
        method: 'POST',
        headers,
        body: JSON.stringify({ name, parentId: currentFolderId }),
        credentials: 'include' 
      });
      
      if (res.ok) {
        const newFolder = await res.json();
        const mapped = mapDriveFiles([newFolder])[0];
        setFiles(prev => [mapped, ...prev]);
        toast.success(`Folder "${name}" created`);
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

  const handleMoveFile = async (newParentId: string) => {
    if (!fileToMove) return;
    try {
      const headers: any = { 'Content-Type': 'application/json' };
      if (tokens) headers['x-goog-tokens'] = JSON.stringify(tokens);
      
      const res = await fetch(`${API_BASE_URL}/api/drive/files/${fileToMove.id}/move`, { 
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          newParentId, 
          oldParentId: currentFolderId 
        }),
        credentials: 'include' 
      });
      
      if (res.ok) {
        setFiles(prev => prev.filter(f => f.id !== fileToMove.id));
        toast.success('File moved successfully');
      }
    } catch (err) {
      console.error('Error moving file:', err);
      toast.error('Failed to move file');
    }
  };

  const handleLogout = async () => {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
    setTokens(null);
    setFiles([]);
    localStorage.removeItem('drive_vault_tokens');
    toast.info('Logged out');
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
        />
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
            onMove={(id, _targetFolderId) => {
              const file = files.find(f => f.id === id) || recentFiles.find(f => f.id === id);
              if (file) {
                setFileToMove(file);
                setIsMoveOpen(true);
              }
            }}
            onNavigateToFiles={() => setActiveTab('files')}
            isDownloadEnabled={isDownloadEnabled}
          />
        );
      case 'files':
        return (
          <FileExplorer 
            files={files} 
            tokens={tokens}
            breadcrumb={breadcrumb}
            filterType={fileFilter}
            onFilterChange={setFileFilter}
            onNavigate={navigateToFolder}
            onDelete={handleDeleteFile}
            onUpload={handleUploadFile}
            onCreateFolder={handleCreateFolder}
            onRename={handleRenameFile}
            onShare={handleShareFile}
            onTabChange={handleTabChange}
            onStar={handleStarFile}
            onMove={(id, _targetFolderId) => {
              const file = files.find(f => f.id === id);
              if (file) {
                setFileToMove(file);
                setIsMoveOpen(true);
              }
            }}
            onHide={handleHideFile}
            activeSubTab={currentFilter}
            isDownloadEnabled={isDownloadEnabled}
          />
        );

      case 'settings':
        return (
          <Settings 
            user={user}
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
          onMove={(id, _targetFolderId) => {
            const file = recentFiles.find(f => f.id === id);
            if (file) {
              setFileToMove(file);
              setIsMoveOpen(true);
            }
          }}
        />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-100 transition-colors duration-300">
      <div className="flex flex-col md:flex-row min-h-screen overflow-hidden">
        {/* Desktop Sidebar */}
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          user={user} 
          onLogout={handleLogout} 
        />

        {/* Main Content Area */}
        <main className="flex-1 relative flex flex-col min-h-screen md:max-h-screen overflow-y-auto w-full md:bg-white dark:md:bg-slate-900 md:shadow-2xl md:shadow-slate-200/50 dark:md:shadow-none">
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
            <div className="h-20 md:hidden" /> {/* Spacer for bottom nav */}
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
      </div>
      <Toaster position="top-center" />
    </div>
  );
}



