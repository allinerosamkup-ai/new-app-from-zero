import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { LucideHome, LucideCalendar, LucideLineChart, LucideMessageCircle, LucideSettings } from 'lucide-react-native';

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
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          paddingBottom: 8,
          paddingTop: 8,
          height: 64,
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: 'bold',
        }
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
