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
      ) : !onboardingDone ? (
        <Stack.Screen name="Onboarding" component={WebAppScreen} />
      ) : (
        <Stack.Screen name="MainTabs" component={WebAppScreen} />
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
      <Stack.Screen
        name="JournalChat"
        component={JournalChatScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      <Stack.Screen
        name="HrvTest"
        component={HrvTestScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="HrvResult"
        component={HrvResultScreen}
        options={{
          animation: 'slide_from_right',
          gestureEnabled: false,
        }}
      />
      <Stack.Screen
        name="CycleCalendar"
        component={CycleCalendarScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="DailyAgenda"
        component={DailyAgendaScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="EnergyMap"
        component={EnergyMapScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Plans"
        component={PlansScreen}
        options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
      />
      <Stack.Screen
        name="PaymentSuccess"
        component={PaymentSuccessScreen}
        options={{ animation: 'slide_from_right', gestureEnabled: false }}
      />
      <Stack.Screen
        name="GoogleCalendar"
        component={GoogleCalendarScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Habits"
        component={HabitsScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
