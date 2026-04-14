import { Home, Folder, Settings, Cloud, LogOut, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';
import React from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  onLogout: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, user, onLogout }: SidebarProps) {
  const tabs = [
    { id: 'home', icon: Home, label: 'Dashboard' },
    { id: 'files', icon: Folder, label: 'My Files' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <aside className="hidden md:flex flex-col w-72 h-screen bg-white dark:bg-slate-900 border-r border-slate-100 dark:border-slate-800 sticky top-0 transition-colors z-40">
      <div className="p-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Cloud size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white leading-none">DriveVault</h1>
            <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase mt-1">Cloud Storage</p>
          </div>
        </div>

        <nav className="space-y-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group relative
                  ${isActive 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }
                `}
              >
                <Icon size={22} className={isActive ? 'text-blue-600' : 'group-hover:text-slate-600 dark:group-hover:text-slate-300'} />
                <span className="font-semibold text-sm">{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="sidebarActive"
                    className="absolute left-0 w-1 h-6 bg-blue-600 rounded-r-full"
                  />
                )}
                <ChevronRight size={16} className={`ml-auto transition-transform ${isActive ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}`} />
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-slate-50 dark:border-slate-800">
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 mb-4">
          <img 
            src={user?.photo || `https://ui-avatars.com/api/?name=${user?.name || 'User'}&background=random`} 
            alt="Profile" 
            className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-700 shadow-sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.name}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors font-semibold text-sm"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
