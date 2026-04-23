import React, { useEffect, useState } from 'react';
import { View, Text, LogBox } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DefaultTheme as NavigationDefaultTheme, NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MD3LightTheme, PaperProvider, adaptNavigationTheme } from 'react-native-paper';

import RootStackNavigator from './src/presentation/navigation/RootStackNavigator';
import { useAuthStore } from './src/presentation/providers/auth_store';
import { appColors } from './src/presentation/theme/appTheme';

// Ignore specific warnings that might be noisy in production
LogBox.ignoreLogs(['new URL()', 'URL.searchParams']);

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

export default function App() {
  const { initialize, error: authError } = useAuthStore();
  const [runtimeError, setRuntimeError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize auth store but catch any errors to prevent crash
    initialize().catch((e: any) => {
      console.error('[App] Init failed:', e);
      setRuntimeError(e?.message || 'Erro de inicializacao');
    });
  }, [initialize]);

  const error = runtimeError || authError;

  if (error && (error.includes('env vars ausentes') || runtimeError)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#FAF8F5' }}>
        <Text style={{ color: '#A8544A', fontWeight: 'bold', fontSize: 20, marginBottom: 12 }}>Ops! Algo deu errado</Text>
        <Text style={{ textAlign: 'center', color: '#3F3833', lineHeight: 20 }}>{error}</Text>
        <Text style={{ marginTop: 24, fontSize: 13, color: '#81756D' }}>Tente fechar e abrir o app novamente.</Text>
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={theme}>
          <NavigationContainer theme={navigationTheme}>
            <RootStackNavigator />
            <StatusBar style="dark" translucent backgroundColor="transparent" />
          </NavigationContainer>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
