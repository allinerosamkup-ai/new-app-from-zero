import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar as RNStatusBar } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { DefaultTheme as NavigationDefaultTheme, NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MD3LightTheme, PaperProvider, adaptNavigationTheme } from 'react-native-paper';

import RootStackNavigator from './src/presentation/navigation/RootStackNavigator';
import { useAuthStore } from './src/presentation/providers/auth_store';
import { appColors } from './src/presentation/theme/appTheme';

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

// Global Error Boundary (Functional-ish)
function AppErrorFallback({ error }: { error: string }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Ocorreu um erro inesperado</Text>
      <Text style={styles.errorMsg}>{error}</Text>
      <Text style={styles.errorSub}>Por favor, reinicie o aplicativo.</Text>
    </View>
  );
}

export default function App() {
  const { initialize, error: authError } = useAuthStore();
  const [initError, setInitError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await initialize();
        setIsReady(true);
      } catch (e: any) {
        console.error('[App] Init failed:', e);
        setInitError(e?.message || 'Falha na inicializacao nativa');
      }
    }
    void prepare();
  }, [initialize]);

  const activeError = initError || authError;

  if (activeError) {
    return <AppErrorFallback error={activeError} />;
  }

  if (!isReady) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar style="dark" />
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

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#FAF8F5',
  },
  errorTitle: {
    color: '#A8544A',
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorMsg: {
    color: '#3F3833',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorSub: {
    fontSize: 13,
    color: '#81756D',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
});
