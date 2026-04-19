import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import DailySummaryScreen from '../screens/DailySummaryScreen';
import CheckinScreen from '../screens/CheckinScreen';
import CheckInResultScreen from '../screens/CheckInResultScreen';
import AuthScreen from '../screens/AuthScreen';
import WebAppScreen from '../screens/WebAppScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import HrvTestScreen from '../screens/HrvTestScreen';
import HrvResultScreen from '../screens/HrvResultScreen';
import CycleCalendarScreen from '../screens/CycleCalendarScreen';
import DailyAgendaScreen from '../screens/DailyAgendaScreen';
import EnergyMapScreen from '../screens/EnergyMapScreen';
import PlansScreen from '../screens/PlansScreen';
import PaymentSuccessScreen from '../screens/PaymentSuccessScreen';
import GoogleCalendarScreen from '../screens/GoogleCalendarScreen';
import JournalChatScreen from '../screens/JournalChatScreen';
import HabitsScreen from '../screens/HabitsScreen';
import { useAuthStore } from '../providers/auth_store';
import { appColors } from '../theme/appTheme';

const Stack = createNativeStackNavigator();

/**
 * RootStackNavigator: Gerencia a navegação global do App com UI do Paper.
 */
export default function RootStackNavigator() {
  const { initialized, isLoading, userId, onboardingDone } = useAuthStore();

  if (!initialized && isLoading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: appColors.background,
        }}
      >
        <ActivityIndicator animating size="large" color={appColors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: appColors.background,
        },
      }}
    >
      {!userId ? (
        <Stack.Screen name="Auth" component={AuthScreen} />
      ) : (
        <Stack.Screen name="WebShell" component={WebAppScreen} />
      )}
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
    </Stack.Navigator>
  );
}
