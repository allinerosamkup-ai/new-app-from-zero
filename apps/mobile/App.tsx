import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { DefaultTheme as NavigationDefaultTheme, NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
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

/**
 * App: Ponto de entrada do aplicativo Mobile.
 * Inicializa o container de navegação e o suporte a gestos.
 */
export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

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
