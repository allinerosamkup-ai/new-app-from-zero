import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LucideHome, LucideCalendar, LucideLineChart, LucideMessageCircle, LucideSettings } from 'lucide-react-native';
import { View } from 'react-native';
import { appColors, appRadius, appSpacing, appTabBarConfig } from '../theme/appTheme';

// Importação das Telas (Componentes que já criamos)
import HomeScreen from '../screens/HomeScreen';
import PlannerScreen from '../screens/PlannerScreen';
import WeeklyInsightsScreen from '../screens/WeeklyInsightsScreen';
import JournalChatScreen from '../screens/JournalChatScreen';
import ConfigScreen from '../screens/ConfigScreen';

const Tab = createBottomTabNavigator();

/**
 * MainTabNavigator: Navegador principal por abas do aplicativo.
 * Tradução do Scaffold + BottomNavigationBar do Flutter.
 */
export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: appColors.primary,
        tabBarInactiveTintColor: appColors.textSecondary,
        tabBarStyle: {
          position: 'absolute',
          left: appSpacing.lg,
          right: appSpacing.lg,
          bottom: appSpacing.lg,
          height: appTabBarConfig.height,
          paddingBottom: appTabBarConfig.paddingBottom,
          paddingTop: appTabBarConfig.paddingTop,
          borderRadius: appRadius.lg,
          backgroundColor: appColors.surface,
          borderWidth: 1,
          borderColor: appColors.borderSubtle,
          elevation: 12,
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          overflow: 'hidden',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: 'bold',
        },
        tabBarBackground: () => (
          <View
            style={{
              flex: 1,
              backgroundColor: appColors.surface,
            }}
          />
        ),
      }}
    >
      <Tab.Screen 
        name="Hoje" 
        component={HomeScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <LucideHome size={size} color={color} />,
        }}
      />
      <Tab.Screen 
        name="Planner" 
        component={PlannerScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <LucideCalendar size={size} color={color} />,
        }}
      />
      <Tab.Screen 
        name="Diário" 
        component={JournalChatScreen} 
        options={{
          tabBarIcon: ({ color, size }) => <LucideMessageCircle size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Insights"
        component={WeeklyInsightsScreen}
        options={{
          tabBarIcon: ({ color, size }) => <LucideLineChart size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Config"
        component={ConfigScreen}
        options={{
          tabBarLabel: 'Config',
          tabBarIcon: ({ color, size }) => <LucideSettings size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}
