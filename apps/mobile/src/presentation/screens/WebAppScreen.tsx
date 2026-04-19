import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Linking, Platform, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '../../lib/supabase';
import { buildInjectedSessionScript, getWebAppStartPath, getWebAppUrl } from '../../lib/web-app';
import { useAuthStore } from '../providers/auth_store';
import { appColors } from '../theme/appTheme';

type NativeShellEvent =
  | { type: 'auth.signOut' }
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
  const { onboardingDone, signOut } = useAuthStore();
  const [webSession, setWebSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);

  const startUrl = useMemo(() => {
    const fallbackUrl = `${getWebAppUrl()}${getWebAppStartPath(onboardingDone)}?airia_native=1`;

    try {
      const url = new URL(`${getWebAppUrl()}${getWebAppStartPath(onboardingDone)}`);
      url.searchParams.set('airia_native', '1');
      return url.toString();
    } catch {
      return fallbackUrl;
    }
  }, [onboardingDone]);

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

        if (message.type === 'external.open' && message.url) {
          await Linking.openURL(message.url);
        }
      } catch {
        // Ignore non-JSON messages emitted by the page.
      }
    },
    [signOut],
  );

  const handleShouldStartLoad = useCallback((request: WebViewLoadRequest) => {
    // Se for a URL da Airia, carrega na WebView
    if (request.url.startsWith(getWebAppUrl()) || request.url.includes('supabase.co')) {
      return true;
    }

    // Se for Google Auth ou links externos, abre no navegador externo
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
      <WebView
        ref={webViewRef}
        source={{ uri: startUrl }}
        originWhitelist={['*']}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        javaScriptEnabled
        domStorageEnabled
        userAgent={Platform.OS === 'android' ? MOBILE_USER_AGENT : undefined}
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
