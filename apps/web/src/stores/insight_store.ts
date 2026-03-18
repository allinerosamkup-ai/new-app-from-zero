import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export interface WeeklyInsightRow {
  avg_mood: number | null;
  avg_energy: number | null;
  checkin_count: number;
  insights: {
    patterns?: Array<{ type: string; description: string; confidence: string }>;
    recommendations?: Array<{ category: string; text: string; priority: string }>;
    aiAnalysis?: string;
  } | null;
}

interface InsightState {
  weeklyInsight: WeeklyInsightRow | null;
  isLoading: boolean;
  error: string | null;
  load: (userId: string) => Promise<void>;
}

function currentWeekStart() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export const useInsightStore = create<InsightState>((set) => ({
  weeklyInsight: null,
  isLoading: false,
  error: null,

  async load(userId) {
    set({ isLoading: true, error: null });
    try {
      const weekStart = currentWeekStart();
      const { data, error } = await supabase
        .from('weekly_insights')
        .select('avg_mood, avg_energy, checkin_count, insights')
        .eq('user_id', userId)
        .eq('week_start', weekStart)
        .maybeSingle();

      if (error) throw error;

      set({ weeklyInsight: data as WeeklyInsightRow | null, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Erro ao carregar insights.' });
    }
  },
}));
