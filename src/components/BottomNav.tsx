import { Home, Folder, Settings } from 'lucide-react';
import { motion } from 'motion/react';

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function BottomNav({ activeTab, setActiveTab }: BottomNavProps) {
  const tabs = [
    { id: 'home', icon: Home, label: 'Home' },
    { id: 'files', icon: Folder, label: 'Files' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 px-6 py-3 flex justify-between items-center z-50 transition-colors md:hidden">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex flex-col items-center gap-1 relative px-4 py-2 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <motion.div
              animate={{
                scale: isActive ? 1.2 : 1,
                color: isActive ? '#3b82f6' : '#94a3b8',
              }}
              className="p-1"
            >
              <Icon size={24} />
            </motion.div>
            <span className={`text-[10px] font-medium ${isActive ? 'text-blue-500' : 'text-slate-400'}`}>
              {tab.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute -top-1 w-1 h-1 bg-blue-500 rounded-full"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
