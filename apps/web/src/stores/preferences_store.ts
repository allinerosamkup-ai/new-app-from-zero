import { create } from 'zustand';
import { apiGet, apiFetch } from '../lib/api';

export interface UserPrefs {
  timezone: string;
  wakeTime: string | null;
  sleepTime: string | null;
  notificationsOn: boolean;
  aiTone: string;
}

interface PrefsState {
  prefs: UserPrefs | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  load: () => Promise<void>;
  save: (patch: Partial<UserPrefs>) => Promise<void>;
}

const DEFAULTS: UserPrefs = {
  timezone: 'America/Sao_Paulo',
  wakeTime: '07:00',
  sleepTime: '23:00',
  notificationsOn: true,
  aiTone: 'warm',
};

export const usePrefsStore = create<PrefsState>((set, get) => ({
  prefs: null,
  isLoading: false,
  isSaving: false,
  error: null,

  async load() {
    set({ isLoading: true, error: null });
    try {
      const data = await apiGet<UserPrefs>('/api/preferences');
      set({ prefs: { ...DEFAULTS, ...data }, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Erro ao carregar preferências.' });
    }
  },

  async save(patch) {
    const current = get().prefs ?? DEFAULTS;
    const optimistic = { ...current, ...patch };
    set({ prefs: optimistic, isSaving: true, error: null });
    try {
      const res = await apiFetch('/api/preferences', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Falha ao salvar preferências');
      const saved = await res.json() as UserPrefs;
      set({ prefs: { ...DEFAULTS, ...saved }, isSaving: false });
    } catch (e) {
      // rollback
      set({ prefs: current, isSaving: false, error: e instanceof Error ? e.message : 'Erro ao salvar.' });
    }
  },
}));
