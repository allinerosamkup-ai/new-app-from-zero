import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import WebAppScreen from '../screens/WebAppScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import { useAuthStore } from '../providers/auth_store';
import { appColors } from '../theme/appTheme';

const Stack = createNativeStackNavigator();

/**
 * RootStackNavigator: Gerencia a navegação global do App.
 * Focado no WebShell para paridade total com o Web App.
 */
export default function RootStackNavigator() {
  const { initialized, isLoading } = useAuthStore();

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
      <Stack.Screen name="WebShell" component={WebAppScreen} />
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
