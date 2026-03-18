import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AuthState {
  userId: string | null;
  fullName: string | null;
  email: string | null;
  onboardingDone: boolean;
  isLoading: boolean;
  initialized: boolean;
  error: string | null;
  infoMessage: string | null;
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (input: { fullName: string; email: string; password: string }) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearMessages: () => void;
}

let subscriptionInitialized = false;

async function fetchProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, onboarding_done')
    .eq('id', userId)
    .maybeSingle();

  return {
    fullName: (data?.full_name as string) ?? null,
    onboardingDone: (data?.onboarding_done as boolean) ?? false,
  };
}

async function syncState(
  set: (p: Partial<AuthState>) => void,
  session: { user?: { id?: string; email?: string } } | null,
) {
  if (!session?.user?.id) {
    set({ userId: null, fullName: null, email: null, onboardingDone: false, initialized: true, isLoading: false });
    return;
  }

  const { fullName, onboardingDone } = await fetchProfile(session.user.id);
  set({
    userId: session.user.id,
    email: session.user.email ?? null,
    fullName,
    onboardingDone,
    initialized: true,
    isLoading: false,
  });
}

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  fullName: null,
  email: null,
  onboardingDone: false,
  isLoading: false,
  initialized: false,
  error: null,
  infoMessage: null,

  async initialize() {
    if (!subscriptionInitialized) {
      supabase.auth.onAuthStateChange((_event, session) => {
        void syncState(set, session).catch(() => set({ initialized: true, isLoading: false }));
      });
      subscriptionInitialized = true;
    }

    set({ isLoading: true, error: null });

    try {
      const { data } = await supabase.auth.getSession();
      await syncState(set, data.session);
    } catch {
      set({ isLoading: false, initialized: true, error: 'Falha ao carregar sessão.' });
    }
  },

  async signIn(email, password) {
    set({ isLoading: true, error: null, infoMessage: null });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      await syncState(set, data.session);
      return true;
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Falha ao entrar.' });
      return false;
    }
  },

  async signUp({ fullName, email, password }) {
    set({ isLoading: true, error: null, infoMessage: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) throw error;
      if (!data.session) {
        set({ isLoading: false, initialized: true, infoMessage: 'Conta criada. Verifique seu email para confirmar.' });
        return true;
      }
      await syncState(set, data.session);
      return true;
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Falha ao criar conta.' });
      return false;
    }
  },

  async signOut() {
    set({ isLoading: true, error: null });
    try {
      await supabase.auth.signOut();
      set({ userId: null, fullName: null, email: null, onboardingDone: false, isLoading: false, initialized: true });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Falha ao sair.' });
    }
  },

  clearMessages() {
    set({ error: null, infoMessage: null });
  },
}));
