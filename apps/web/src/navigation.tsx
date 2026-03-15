import React, { createContext, useContext, useState, useCallback } from 'react';

export type Screen =
  | 'auth'
  | 'onboarding'
  | 'home'
  | 'checkin'
  | 'checkinResult'
  | 'planner'
  | 'journal'
  | 'insights'
  | 'config'
  | 'dailySummary';

type NavigationContextType = {
  screen: Screen;
  navigate: (screen: Screen) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
};

const NavigationContext = createContext<NavigationContextType>({
  screen: 'auth',
  navigate: () => {},
  activeTab: 'home',
  setActiveTab: () => {},
});

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>('auth');
  const [activeTab, setActiveTab] = useState('home');

  const navigate = useCallback((s: Screen) => {
    setScreen(s);
    if (s === 'home') setActiveTab('home');
    if (s === 'planner') setActiveTab('planner');
    if (s === 'journal') setActiveTab('journal');
    if (s === 'insights') setActiveTab('insights');
    if (s === 'config') setActiveTab('config');
  }, []);

  return (
    <NavigationContext.Provider value={{ screen, navigate, activeTab, setActiveTab }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}
