import type { Session } from '@supabase/supabase-js';

const FALLBACK_WEB_APP_URL = 'https://airia.pro';

export function getWebAppUrl() {
  return (process.env.EXPO_PUBLIC_WEB_APP_URL || FALLBACK_WEB_APP_URL).replace(/\/+$/, '');
}

export function getWebAppStartPath(onboardingDone: boolean) {
  return onboardingDone ? '/home' : '/onboarding';
}

export function getSupabaseWebStorageKey() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  if (!supabaseUrl) {
    console.warn('EXPO_PUBLIC_SUPABASE_URL ausente para montar a sessao web.');
    return 'sb-missing-url-auth-token';
  }

  const hostname = new URL(supabaseUrl).hostname;
  return `sb-${hostname.split('.')[0]}-auth-token`;
}

export function buildInjectedSessionScript(session: Session | null) {
  const storageKey = getSupabaseWebStorageKey();
  const serializedSession = session ? JSON.stringify(session) : null;

  return `
    (function () {
      try {
        window.__AIRIA_NATIVE_SHELL__ = true;
        document.documentElement.classList.add('airia-native-shell');

        var applyNativeShell = function () {
          if (document.body) {
            document.body.classList.add('airia-native-shell');
          }

          var viewport = document.querySelector('meta[name="viewport"]');
          if (!viewport) {
            viewport = document.createElement('meta');
            viewport.setAttribute('name', 'viewport');
            document.head.appendChild(viewport);
          }

          viewport.setAttribute(
            'content',
            'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
          );
        };

        applyNativeShell();
        document.addEventListener('DOMContentLoaded', applyNativeShell);

        var storageKey = ${JSON.stringify(storageKey)};
        var session = ${serializedSession ? JSON.stringify(serializedSession) : 'null'};

        if (session) {
          localStorage.setItem(storageKey, session);
          window.dispatchEvent(new StorageEvent('storage', { key: storageKey, newValue: session }));
        } else {
          localStorage.removeItem(storageKey);
          window.dispatchEvent(new StorageEvent('storage', { key: storageKey, newValue: null }));
        }
      } catch (error) {
        console.error('AIRIA_NATIVE_INJECT_FAILED', error);
      }
    })();
    true;
  `;
}
