import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DefaultTheme as NavigationDefaultTheme, NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MD3LightTheme, PaperProvider, adaptNavigationTheme } from 'react-native-paper';

import RootStackNavigator from './src/presentation/navigation/RootStackNavigator';
import { useAuthStore } from './src/presentation/providers/auth_store';
import { appColors } from './src/presentation/theme/appTheme';
import { useNotifications } from './src/hooks/useNotifications';

const { LightTheme } = adaptNavigationTheme({
  reactNavigationLight: NavigationDefaultTheme,
});

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: appColors.primary,
    secondary: appColors.textSecondary,
    background: appColors.background,
    surface: appColors.surface,
    outline: appColors.borderSubtle,
    error: appColors.danger,
  },
};

/**
 * App: Ponto de entrada do aplicativo Mobile.
 */
export default function App() {
  const { initialize, error: authError } = useAuthStore();
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  useNotifications();

  useEffect(() => {
    initialize().catch((e: any) => {
      setRuntimeError(e?.message || 'Erro fatal na inicializacao');
    });
  }, [initialize]);

  const error = runtimeError || authError;

  // Tela de erro amigável se as env vars falharem
  if (error && (error.includes('env vars ausentes') || runtimeError)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: appColors.background }}>
        <Text style={{ color: appColors.danger, textAlign: 'center', fontWeight: 'bold', fontSize: 18 }}>Erro na Airia</Text>
        <Text style={{ textAlign: 'center', marginTop: 10, color: '#666' }}>{error}</Text>
        <Text style={{ marginTop: 20, fontSize: 12, color: '#999' }}>Tente reiniciar o app ou verificar sua conexao.</Text>
      </View>
    );
  }

  const navigationTheme = {
    ...LightTheme,
    colors: {
      ...LightTheme.colors,
      background: appColors.background,
      card: appColors.surface,
      text: appColors.textPrimary,
      border: appColors.borderSubtle,
      primary: appColors.primary,
    },
  };

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PaperProvider theme={theme}>
          <NavigationContainer theme={navigationTheme}>
            <RootStackNavigator />
            <StatusBar style="dark" translucent backgroundColor="transparent" />
          </NavigationContainer>
        </PaperProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
