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
    throw new Error('EXPO_PUBLIC_SUPABASE_URL ausente para montar a sessao web.');
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

