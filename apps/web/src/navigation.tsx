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
  | 'dailySummary'
  | 'objectives'
  | 'harmony'
  | 'pomodoro';

type NavigationContextType = {
  screen: Screen;
  navigate: (screen: Screen, params?: Record<string, unknown>) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  params: Record<string, unknown>;
};

const NavigationContext = createContext<NavigationContextType>({
  screen: 'auth',
  navigate: () => {},
  activeTab: 'home',
  setActiveTab: () => {},
  params: {},
});

export function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>('auth');
  const [activeTab, setActiveTab] = useState('home');
  const [params, setParams] = useState<Record<string, unknown>>({});

  const navigate = useCallback((s: Screen, p?: Record<string, unknown>) => {
    setScreen(s);
    setParams(p || {});
    if (s === 'home') setActiveTab('home');
    if (s === 'planner') setActiveTab('planner');
    if (s === 'journal') setActiveTab('journal');
    if (s === 'insights') setActiveTab('insights');
    if (s === 'config') setActiveTab('config');
    if (s === 'objectives') setActiveTab('objectives');
  }, []);

  return (
    <NavigationContext.Provider value={{ screen, navigate, activeTab, setActiveTab, params }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}
