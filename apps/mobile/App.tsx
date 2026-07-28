import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Linking, NativeModules, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import { ActivityIndicator } from 'react-native-paper';
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from 'react-native-webview';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import * as Updates from 'expo-updates';

import { supabase } from './src/lib/supabase';
import { buildInjectedSessionScript, getSupabaseWebStorageKey } from './src/lib/web-app';
import { publishTodayWidgetData, sanitizeTodayWidgetPayload } from './src/widgets/todayWidgetData';
import { useNotifications, usePushNotifications } from './src/hooks/useNotifications';

WebBrowser.maybeCompleteAuthSession();

const WEB_APP_URL = (process.env.EXPO_PUBLIC_WEB_APP_URL || 'https://airia.pro').replace(/\/+$/, '');
const START_URL = `${WEB_APP_URL}/home?airia_native=1`;
const MOBILE_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 AiriaNative/1.0';

type NativeShellEvent =
  | { type: 'auth.signOut' }
  | { type: 'auth.googleSignIn' }
  | { type: 'external.open'; url: string }
  | { type: 'widget.sync'; payload: unknown }
  | { type: 'health.connectSync'; requestId: string };

type HealthSnapshot = {
  source: 'health_connect';
  localDate: string;
  sleepMinutes?: number;
  sleepScore?: number;
  steps?: number;
  avgHeartRate?: number;
  exerciseMinutes?: number;
  syncedAt?: string;
};

async function syncHealthSnapshotToBackend(snapshot: HealthSnapshot) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Sessao ausente para sincronizar Health Connect.');
  }

  const apiUrl = (process.env.EXPO_PUBLIC_API_URL || 'https://airia.pro').replace(/\/+$/, '');
  const response = await fetch(`${apiUrl}/api/health-connect/sync`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(snapshot),
  });

  if (!response.ok) {
    throw new Error(`Falha ao salvar Health Connect (${response.status}).`);
  }

  return response.json();
}

async function checkForOtaUpdate() {
  // Em dev (__DEV__) ou ambiente Expo Go, expo-updates não funciona — pula silenciosamente
  if (__DEV__) return;
  try {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      // Reload imediato pra aplicar — ao próximo abrir, está com a versão nova
      await Updates.reloadAsync();
    }
  } catch (error) {
    console.warn('[updates] check failed:', error);
  }
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const canGoBackRef = useRef(false);
  const isMountedRef = useRef(true);
  const [webSession, setWebSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [hasLoadError, setHasLoadError] = useState(false);

  const injectedSessionScript = useMemo(() => buildInjectedSessionScript(webSession), [webSession]);

  // Notificações locais (check-in 20h, hábitos 8h, insight semanal segunda 10h)
  useNotifications();
  // Push Expo nativo — registra token no backend assim que houver userId
  usePushNotifications(webSession?.user?.id ?? null);

  // OTA auto-update — checa ao abrir e baixa silenciosamente, reinicia pra aplicar
  useEffect(() => {
    void checkForOtaUpdate();
  }, []);

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
      setSessionReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (!isMountedRef.current) return;
      setWebSession(session);

      if (!webViewRef.current) return;

      const storageKey = getSupabaseWebStorageKey();
      const sessionStr = session ? JSON.stringify(JSON.stringify(session)) : 'null';
      const script = session
        ? `localStorage.setItem("${storageKey}", ${sessionStr}); window.dispatchEvent(new StorageEvent("storage", { key: "${storageKey}", newValue: ${sessionStr} })); true;`
        : event === 'SIGNED_OUT'
          ? `localStorage.removeItem("${storageKey}"); window.dispatchEvent(new StorageEvent("storage", { key: "${storageKey}", newValue: null })); true;`
          : 'true;';
      webViewRef.current.injectJavaScript(script);
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

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = makeRedirectUri({
      scheme: 'airia',
      path: 'auth/callback',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw error;
    }

    if (!data?.url) {
      throw new Error('Nao foi possivel iniciar o login com Google.');
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) {
      return;
    }

    const callbackUrl = new URL(result.url);
    const code = callbackUrl.searchParams.get('code');
    if (!code) {
      throw new Error('Google nao retornou o codigo de autenticacao.');
    }

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      throw exchangeError;
    }
  }, []);

  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    const emitHealthResult = (requestId: string, payload: { ok: boolean; snapshot?: unknown; error?: string }) => {
      const detail = JSON.stringify({ requestId, ...payload });
      webViewRef.current?.injectJavaScript(`
        window.dispatchEvent(new CustomEvent('airia:health-connect-sync', { detail: ${detail} }));
        true;
      `);
    };

    try {
      const message = JSON.parse(event.nativeEvent.data) as NativeShellEvent;

      if (message.type === 'auth.signOut') {
        await supabase.auth.signOut();
        return;
      }

      if (message.type === 'auth.googleSignIn') {
        await signInWithGoogle();
        return;
      }

      if (message.type === 'external.open' && message.url) {
        await Linking.openURL(message.url);
        return;
      }

      if (message.type === 'widget.sync') {
        const payload = sanitizeTodayWidgetPayload(message.payload);
        if (!payload) return;
        await publishTodayWidgetData(payload);
        return;
      }

      if (message.type === 'health.connectSync') {
        try {
          const module = NativeModules.AiriaHealthConnectModule;
          if (!module?.requestPermissionsAndReadToday) {
            throw new Error('Health Connect nao esta disponivel nesta versao do app.');
          }
          const snapshot = await module.requestPermissionsAndReadToday();
          const saved = await syncHealthSnapshotToBackend(snapshot as HealthSnapshot);
          emitHealthResult(message.requestId, { ok: true, snapshot: saved?.snapshot ?? snapshot });
        } catch (error) {
          emitHealthResult(message.requestId, {
            ok: false,
            error: error instanceof Error ? error.message : 'Nao consegui sincronizar o Health Connect.',
          });
        }
      }
    } catch (error) {
      console.warn('AIRIA_NATIVE_MESSAGE_FAILED', error);
    }
  }, [signInWithGoogle]);

  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    if (request.url.startsWith(WEB_APP_URL) || request.url.includes('supabase.co')) {
      return true;
    }

    if (request.url.includes('google.com/calendar') || !request.url.startsWith('http')) {
      void Linking.openURL(request.url);
      return false;
    }

    return true;
  }, []);

  if (!sessionReady) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator animating size="large" color="#D7897F" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <WebView
        ref={webViewRef}
        source={{ uri: START_URL }}
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
        onLoadEnd={() => setHasLoadError(false)}
        onError={() => setHasLoadError(true)}
        onNavigationStateChange={handleNavigationChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onMessage={handleMessage}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loader}>
            <ActivityIndicator animating size="large" color="#D7897F" />
          </View>
        )}
        pullToRefreshEnabled
        style={styles.webview}
        containerStyle={styles.webview}
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
    backgroundColor: '#FAF8F5',
    paddingTop: Platform.OS === 'android' ? 0 : undefined,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF8F5',
  },
  webview: {
    flex: 1,
    backgroundColor: '#FAF8F5',
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
