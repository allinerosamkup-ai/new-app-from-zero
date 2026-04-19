import { create } from 'zustand';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '../../lib/supabase';
import { getSessionUserId, type SessionSnapshot } from './auth_session';

interface AuthState {
  userId: string | null;
  fullName: string | null;
  onboardingDone: boolean;
  isLoading: boolean;
  initialized: boolean;
  error: string | null;
  infoMessage: string | null;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signInWithGoogle: () => Promise<boolean>;
  signUp: (input: { fullName: string; email: string; password: string }) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearMessages: () => void;
}

let authSubscriptionInitialized = false;
WebBrowser.maybeCompleteAuthSession();

async function fetchProfile(userId: string): Promise<{ fullName: string | null; onboardingDone: boolean }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, onboarding_done')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    fullName: data?.full_name ?? null,
    onboardingDone: data?.onboarding_done ?? false,
  };
}

async function readSessionUserId(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return getSessionUserId(data as SessionSnapshot);
}

async function syncAuthState(
  set: (partial: Partial<AuthState>) => void,
  sessionUserId: string | null,
) {
  if (!sessionUserId) {
    set({
      userId: null,
      fullName: null,
      onboardingDone: false,
      initialized: true,
      isLoading: false,
    });
    return;
  }

  const profile = await fetchProfile(sessionUserId);

  set({
    userId: sessionUserId,
    fullName: profile.fullName,
    onboardingDone: profile.onboardingDone,
    initialized: true,
    isLoading: false,
  });
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  fullName: null,
  onboardingDone: false,
  isLoading: false,
  initialized: false,
  error: null,
  infoMessage: null,

  async initialize() {
    if (!authSubscriptionInitialized) {
      supabase.auth.onAuthStateChange((_event: any, session: any) => {
        void syncAuthState(set, session?.user?.id ?? null).catch((error) => {
          set({
            initialized: true,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Falha ao sincronizar sessão.',
          });
        });
      });
      authSubscriptionInitialized = true;
    }

    set({ isLoading: true, error: null, infoMessage: null });

    try {
      const userId = await readSessionUserId();
      await syncAuthState(set, userId);
    } catch (error) {
      set({
        isLoading: false,
        initialized: true,
        error: error instanceof Error ? error.message : 'Falha ao carregar sessão.',
      });
    }
  },

  async refresh() {
    set({ isLoading: true, error: null });

    try {
      const userId = await readSessionUserId();
      await syncAuthState(set, userId);
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Falha ao atualizar sessão.',
      });
    }
  },

  async signIn(email, password) {
    set({ isLoading: true, error: null, infoMessage: null });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw error;
      }

      await syncAuthState(set, data.user?.id ?? null);
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Falha ao entrar.',
      });
      return false;
    }
  },

  async signInWithGoogle() {
    set({ isLoading: true, error: null, infoMessage: null });

    try {
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
        set({ isLoading: false });
        return false;
      }

      const callbackUrl = new URL(result.url);
      const code = callbackUrl.searchParams.get('code');

      if (!code) {
        throw new Error('Google nao retornou o codigo de autenticacao.');
      }

      const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        throw exchangeError;
      }

      await syncAuthState(set, sessionData.session?.user?.id ?? sessionData.user?.id ?? null);
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Falha ao entrar com Google.',
      });
      return false;
    }
  },

  async signUp({ fullName, email, password }) {
    set({ isLoading: true, error: null, infoMessage: null });

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
          },
        },
      });

      if (error) {
        throw error;
      }

      if (!data.session) {
        set({
          isLoading: false,
          initialized: true,
          infoMessage: 'Conta criada. Verifique seu email para confirmar o acesso.',
        });
        return true;
      }

      await syncAuthState(set, data.user?.id ?? null);
      return true;
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Falha ao criar conta.',
      });
      return false;
    }
  },

  async signOut() {
    set({ isLoading: true, error: null });

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      set({
        userId: null,
        fullName: null,
        onboardingDone: false,
        isLoading: false,
        initialized: true,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Falha ao encerrar sessão.',
      });
    }
  },

  clearMessages() {
    set({
      error: null,
      infoMessage: null,
    });
  },
}));
