import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { DefaultTheme as NavigationDefaultTheme, NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import { View, Text } from 'react-native';
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
 * Inicializa o container de navegação e o suporte a gestos.
 */
export default function App() {
  const { initialize, error } = useAuthStore();
  useNotifications();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  if (error && error.includes('env vars ausentes')) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: appColors.background }}>
        <Text style={{ color: appColors.danger, textAlign: 'center', fontWeight: 'bold' }}>Erro de Configuração</Text>
        <Text style={{ textAlign: 'center', marginTop: 10 }}>{error}</Text>
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
      <PaperProvider theme={theme}>
        <NavigationContainer theme={navigationTheme}>
          <RootStackNavigator />
          <StatusBar style="dark" />
        </NavigationContainer>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
