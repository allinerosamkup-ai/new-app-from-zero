import React from 'react';
import { NavigationProvider, useNavigation } from './navigation';
import { PhoneFrame } from './components/PhoneFrame';
import { TabBar } from './components/TabBar';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import HomeScreen from './screens/HomeScreen';
import CheckinScreen from './screens/CheckinScreen';
import CheckinResultScreen from './screens/CheckinResultScreen';
import PlannerScreen from './screens/PlannerScreen';
import JournalScreen from './screens/JournalScreen';
import InsightsScreen from './screens/InsightsScreen';
import ConfigScreen from './screens/ConfigScreen';
import DailySummaryScreen from './screens/DailySummaryScreen';
import ObjectivesScreen from './screens/ObjectivesScreen';
import HarmonyCircleScreen from './screens/HarmonyCircleScreen';
import PomodoroScreen from './screens/PomodoroScreen';

function ScreenRouter() {
  const { screen } = useNavigation();

  const mainTabs = ['home', 'planner', 'journal', 'insights', 'config', 'objectives'];
  const showTabs = mainTabs.includes(screen);

  const renderScreen = () => {
    switch (screen) {
      case 'auth': return <AuthScreen />;
      case 'onboarding': return <OnboardingScreen />;
      case 'home': return <HomeScreen />;
      case 'checkin': return <CheckinScreen />;
      case 'checkinResult': return <CheckinResultScreen />;
      case 'planner': return <PlannerScreen />;
      case 'journal': return <JournalScreen />;
      case 'insights': return <InsightsScreen />;
      case 'config': return <ConfigScreen />;
      case 'dailySummary': return <DailySummaryScreen />;
      case 'objectives': return <ObjectivesScreen />;
      case 'harmony': return <HarmonyCircleScreen />;
      case 'pomodoro': return <PomodoroScreen />;
      default: return <HomeScreen />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-hidden relative">
        {renderScreen()}
      </div>
      {showTabs && <TabBar />}
    </div>
  );
}

export default function App() {
  return (
    <NavigationProvider>
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#e8e4de' }}>
        <PhoneFrame>
          <ScreenRouter />
        </PhoneFrame>
      </div>
    </NavigationProvider>
  );
}
