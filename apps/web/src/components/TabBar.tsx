import React from 'react';
import { Home, Calendar, MessageCircle, LineChart, Settings } from 'lucide-react';
import { useNavigation, type Screen } from '../navigation';

const tabs: { id: string; label: string; icon: typeof Home; screen: Screen }[] = [
  { id: 'home', label: 'Hoje', icon: Home, screen: 'home' },
  { id: 'planner', label: 'Planner', icon: Calendar, screen: 'planner' },
  { id: 'journal', label: 'Diário', icon: MessageCircle, screen: 'journal' },
  { id: 'insights', label: 'Insights', icon: LineChart, screen: 'insights' },
  { id: 'config', label: 'Config', icon: Settings, screen: 'config' },
];

export function TabBar() {
  const { activeTab, navigate, setActiveTab } = useNavigation();

  return (
    <div className="flex items-center justify-around h-16 border-t border-gray-100 bg-white px-2">
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
            className="flex flex-col items-center gap-0.5 py-1 px-3"
          >
            <Icon size={22} className={isActive ? 'text-blue-500' : 'text-gray-400'} />
            <span className={`text-[10px] font-bold ${isActive ? 'text-blue-500' : 'text-gray-400'}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
