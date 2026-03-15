import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import MainTabNavigator from './MainTabNavigator';
import DailySummaryScreen from '../screens/DailySummaryScreen';
import CheckinScreen from '../screens/CheckinScreen';
import CheckInResultScreen from '../screens/CheckInResultScreen';
import AuthScreen from '../screens/AuthScreen';
import OnboardingChatScreen from '../screens/OnboardingChatScreen';
import { useAuthStore } from '../providers/auth_store';

const Stack = createNativeStackNavigator();

/**
 * RootStackNavigator: Gerencia a navegação global do App.
 * Permite alternar entre o fluxo de abas e telas de resumo/onboarding.
 */
export default function RootStackNavigator() {
  const { initialized, isLoading, userId, onboardingDone } = useAuthStore();

  if (!initialized && isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#1f3b32" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!userId ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : !onboardingDone ? (
        <Stack.Screen name="Onboarding" component={OnboardingChatScreen} />
      ) : (
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
      )}
      <Stack.Screen
        name="DailySummary"
        component={DailySummaryScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom'
        }}
      />
      <Stack.Screen
        name="Checkin"
        component={CheckinScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="CheckInResult"
        component={CheckInResultScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
          gestureEnabled: false,
        }}
      />
    </Stack.Navigator>
  );
}
