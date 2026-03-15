import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';
import RootStackNavigator from './src/presentation/navigation/RootStackNavigator';
import { useAuthStore } from './src/presentation/providers/auth_store';

/**
 * App: Ponto de entrada do aplicativo Mobile.
 * Inicializa o container de navegação e o suporte a gestos.
 */
export default function App() {
  const { initialize } = useAuthStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <RootStackNavigator />
        <StatusBar style="auto" />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}
