import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface DailyCheckinRow {
  id: string;
  local_date: string; // 'YYYY-MM-DD'
  mood_score: number;
  energy_score: number;
  state_label: string | null;
  state_label_type: string | null;
  ai_state: Record<string, unknown> | null;
}

interface CheckinState {
  todayCheckin: DailyCheckinRow | null;
  recentCheckins: DailyCheckinRow[]; // last 7 days
  isLoading: boolean;
  error: string | null;
  load: (userId: string) => Promise<void>;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function sevenDaysAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().slice(0, 10);
}

export const useCheckinStore = create<CheckinState>((set) => ({
  todayCheckin: null,
  recentCheckins: [],
  isLoading: false,
  error: null,

  async load(userId) {
    set({ isLoading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('daily_checkins')
        .select('id, local_date, mood_score, energy_score, state_label, state_label_type, ai_state')
        .eq('user_id', userId)
        .gte('local_date', sevenDaysAgoStr())
        .order('local_date', { ascending: false });

      if (error) throw error;

      const rows = (data ?? []) as DailyCheckinRow[];
      const today = todayStr();
      const todayCheckin = rows.find((r) => r.local_date === today) ?? null;

      set({ recentCheckins: rows, todayCheckin, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Erro ao carregar check-ins.' });
    }
  },
}));
