import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Linking, Platform, StyleSheet, View, StatusBar } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '../../lib/supabase';
import { buildInjectedSessionScript, getSupabaseWebStorageKey, getWebAppStartPath, getWebAppUrl } from '../../lib/web-app';
import { useAuthStore } from '../providers/auth_store';
import { appColors } from '../theme/appTheme';

type NativeShellEvent =
  | { type: 'auth.signOut' }
  | { type: 'auth.googleSignIn' }
  | { type: 'external.open'; url: string };

type WebViewLoadRequest = {
  url: string;
};

const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 AiriaNative/1.0';

export default function WebAppScreen() {
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const isMountedRef = useRef(true);
  const { onboardingDone, signOut, signInWithGoogle, userId } = useAuthStore();
  const [webSession, setWebSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);

  const startUrl = useMemo(() => {
    // Se nao estiver logado no nativo, carrega a splash que vai pro login
    const path = userId ? getWebAppStartPath(onboardingDone) : '/splash';
    try {
      const url = new URL(`${getWebAppUrl()}${path}`);
      url.searchParams.set('airia_native', '1');
      return url.toString();
    } catch {
      return `${getWebAppUrl()}${path}?airia_native=1`;
    }
  }, [onboardingDone, userId]);

  const injectedSessionScript = useMemo(() => {
    return buildInjectedSessionScript(webSession);
  }, [webSession]);

  const syncSession = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    if (!isMountedRef.current) return;

    setWebSession(data.session);
    setSessionReady(true);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    void syncSession().catch((error) => {
      console.error('Falha ao sincronizar sessao web:', error);
      setHasLoadError(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMountedRef.current) return;
      setWebSession(session);
      
      // Se a sessao mudou com a pagina ja aberta, injeta o script de sincronizacao live
      if (webViewRef.current) {
        const storageKey = getSupabaseWebStorageKey();
        const sessionStr = session ? JSON.stringify(JSON.stringify(session)) : 'null';
        const script = session 
          ? `localStorage.setItem("${storageKey}", ${sessionStr}); window.dispatchEvent(new StorageEvent("storage", { key: "${storageKey}", newValue: ${sessionStr} })); true;`
          : `localStorage.removeItem("${storageKey}"); window.dispatchEvent(new StorageEvent("storage", { key: "${storageKey}", newValue: null })); true;`;
        webViewRef.current.injectJavaScript(script);
      }
    });

    return () => {
      isMountedRef.current = false;
      data.subscription.unsubscribe();
    };
  }, [syncSession]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBackRef.current || !webViewRef.current) {
        return false;
      }

      webViewRef.current.goBack();
      return true;
    });

    return () => subscription.remove();
  }, []);

  const handleNavigationChange = useCallback((navigationState: WebViewNavigation) => {
    canGoBackRef.current = navigationState.canGoBack;
  }, []);

  const handleLoadEnd = useCallback(() => {
    setHasLoadError(false);
  }, []);

  const handleLoadError = useCallback(() => {
    setHasLoadError(true);
  }, []);

  const handleMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      try {
        const message = JSON.parse(event.nativeEvent.data) as NativeShellEvent;

        if (message.type === 'auth.signOut') {
          await signOut();
          return;
        }

        if (message.type === 'auth.googleSignIn') {
          await signInWithGoogle();
          return;
        }

        if (message.type === 'external.open' && message.url) {
          await Linking.openURL(message.url);
        }
      } catch {
        // Ignore non-JSON messages emitted by the page.
      }
    },
    [signOut, signInWithGoogle],
  );

  const handleShouldStartLoad = useCallback((request: WebViewLoadRequest) => {
    const webAppUrl = getWebAppUrl();
    
    // Allow the web app and its core services
    if (request.url.startsWith(webAppUrl) || request.url.includes('supabase.co')) {
      return true;
    }

    // External auth or links
    if (
      request.url.includes('accounts.google.com') || 
      request.url.includes('google.com/calendar') ||
      !request.url.startsWith('http')
    ) {
      void Linking.openURL(request.url);
      return false;
    }

    return true;
  }, []);

  if (!sessionReady) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator animating size="large" color={appColors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <WebView
        ref={webViewRef}
        source={{ uri: startUrl }}
        originWhitelist={['*']}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        userAgent={MOBILE_USER_AGENT}
        applicationNameForUserAgent="AiriaNative/1.0"
        scalesPageToFit={false}
        textZoom={100}
        overScrollMode="never"
        bounces={false}
        setSupportMultipleWindows={false}
        injectedJavaScriptBeforeContentLoaded={injectedSessionScript}
        onLoadEnd={handleLoadEnd}
        onError={handleLoadError}
        onNavigationStateChange={handleNavigationChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onMessage={handleMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator animating size="large" color={appColors.primary} />
          </View>
        )}
        pullToRefreshEnabled
        style={{ flex: 1 }}
        containerStyle={{ flex: 1 }}
      />

      {hasLoadError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Nao consegui carregar a Airia agora. Puxa para atualizar.</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: appColors.background,
    // No padding here, we want it to bleed under the status bar
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: appColors.background,
  },
  errorBanner: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(192, 90, 85, 0.94)',
  },
  errorText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
