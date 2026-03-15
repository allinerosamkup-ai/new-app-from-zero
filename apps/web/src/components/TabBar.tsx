import React from 'react';
import { Home, Calendar, MessageCircle, Target, Settings } from 'lucide-react';
import { useNavigation, type Screen } from '../navigation';

const tabs: { id: string; label: string; icon: typeof Home; screen: Screen }[] = [
  { id: 'home', label: 'Hoje', icon: Home, screen: 'home' },
  { id: 'planner', label: 'Planner', icon: Calendar, screen: 'planner' },
  { id: 'journal', label: 'Diário', icon: MessageCircle, screen: 'journal' },
  { id: 'objectives', label: 'Metas', icon: Target, screen: 'objectives' },
  { id: 'config', label: 'Config', icon: Settings, screen: 'config' },
];

export function TabBar() {
  const { activeTab, navigate, setActiveTab } = useNavigation();

  return (
    <div className="glass-strong flex items-center justify-around h-[72px] px-2"
      style={{ borderTop: '1px solid rgba(31, 59, 50, 0.06)' }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              navigate(tab.screen);
            }}
            className="flex flex-col items-center gap-1 py-1 px-3 transition-all duration-200"
          >
            <div className={`p-1.5 rounded-xl transition-all duration-200 ${isActive ? 'bg-[#1f3b32]/10' : ''}`}>
              <Icon size={20} className={`transition-colors duration-200 ${isActive ? 'text-[#1f3b32]' : 'text-[#9b9489]'}`} strokeWidth={isActive ? 2.5 : 1.8} />
            </div>
            <span className={`text-[10px] font-semibold transition-colors duration-200 ${isActive ? 'text-[#1f3b32]' : 'text-[#9b9489]'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
