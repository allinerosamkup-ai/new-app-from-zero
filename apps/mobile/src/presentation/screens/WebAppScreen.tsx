import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Linking, StyleSheet, View } from 'react-native';
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

export default function WebAppScreen() {
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const isMountedRef = useRef(true);
  const { onboardingDone, signOut } = useAuthStore();
  const [webSession, setWebSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);

  const startUrl = useMemo(() => {
    return `${getWebAppUrl()}${getWebAppStartPath(onboardingDone)}`;
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

    void syncSession();

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
    if (request.url.startsWith('http://') || request.url.startsWith('https://')) {
      return true;
    }

    void Linking.openURL(request.url);
    return false;
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
