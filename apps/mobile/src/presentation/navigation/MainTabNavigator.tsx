import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { Text } from 'react-native';
import { BottomNavigation } from 'react-native-paper';
import { appColors } from '../theme/appTheme';

// Importação das Telas
import HomeScreen from '../screens/HomeScreen';
import PlannerScreen from '../screens/PlannerScreen';
import WeeklyInsightsScreen from '../screens/WeeklyInsightsScreen';
import JournalHubScreen from '../screens/JournalHubScreen';
import ConfigScreen from '../screens/ConfigScreen';

const Tab = createBottomTabNavigator();

/**
 * MainTabNavigator: Navegador principal por abas do aplicativo com UI do Paper.
 */
export default function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      }}
      tabBar={({ navigation, state, descriptors, insets }) => (
        <BottomNavigation.Bar
          navigationState={state}
          safeAreaInsets={insets}
          onTabPress={({ route }) => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            const focused = state.routes[state.index]?.key === route.key;

            if (!focused && !event.defaultPrevented) {
              navigation.dispatch({
                ...CommonActions.navigate(route.name, route.params),
                target: state.key,
              });
            }
          }}
          renderIcon={({ route, focused, color }) => {
            const { options } = descriptors[route.key];
            if (options.tabBarIcon) {
              return options.tabBarIcon({ focused, color, size: 24 });
            }
            return null;
          }}
          getLabelText={({ route }) => {
            const { options } = descriptors[route.key];
            const label =
              options.tabBarLabel !== undefined
                ? options.tabBarLabel
                : options.title !== undefined
                ? options.title
                : route.name;

            return label as string;
          }}
          style={{
            backgroundColor: appColors.surface,
            borderTopWidth: 1,
            borderTopColor: appColors.borderSubtle,
          }}
          activeColor={appColors.primary}
        />
      )}
    >
      <Tab.Screen 
        name="Hoje" 
        component={HomeScreen} 
        options={{
          tabBarLabel: 'Início',
          tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size }}>○</Text>,
        }}
      />
      <Tab.Screen 
        name="Planner" 
        component={PlannerScreen} 
        options={{
          tabBarLabel: 'Planner',
          tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size }}>▦</Text>,
        }}
      />
      <Tab.Screen
        name="Diário"
        component={JournalHubScreen}
        options={{
          tabBarLabel: 'Diário',
          tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size }}>✎</Text>,
        }}
      />
      <Tab.Screen
        name="Insights"
        component={WeeklyInsightsScreen}
        options={{
          tabBarLabel: 'Análise',
          tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size }}>≈</Text>,
        }}
      />
      <Tab.Screen
        name="Config"
        component={ConfigScreen}
        options={{
          tabBarLabel: 'Ajustes',
          tabBarIcon: ({ color, size }) => <Text style={{ color, fontSize: size }}>⚙</Text>,
        }}
      />
    </Tab.Navigator>
  );
}
