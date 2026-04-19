import 'react-native-url-polyfill/auto';
import { registerRootComponent } from 'expo';
import { AppRegistry, Platform } from 'react-native';
import App from './App';

/**
 * Airia Mobile EntryPoint
 * Blindado contra crashes de inicializacao.
 */
function Root() {
  return <App />;
}

if (Platform.OS === 'android') {
  // Garante registro duplo para evitar crash de 'component not registered'
  AppRegistry.registerComponent('main', () => App);
}

registerRootComponent(App);
