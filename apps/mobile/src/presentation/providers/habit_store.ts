import { create } from 'zustand';
import { supabase } from '../../lib/supabase';

export interface Habit {
  id: string;
  title: string;
  description?: string;
  category: string;
  icon?: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  targetDays: number[];
  timeOfDay?: string;
  streakCount: number;
  bestStreak: number;
  totalCompletions: number;
  completions?: HabitCompletion[];
}

export interface HabitCompletion {
  id: string;
  habitId: string;
  date: string;
  completedAt?: string;
}

interface HabitState {
  habits: Habit[];
  isLoading: boolean;
  error: string | null;

  fetchHabits: (userId: string, date: string) => Promise<void>;
  toggleHabit: (userId: string, habitId: string, date: string) => Promise<void>;
  addHabit: (userId: string, habit: Partial<Habit>) => Promise<void>;
}

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: [],
  isLoading: false,
  error: null,

  fetchHabits: async (userId, date) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/habits?date=${date}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to fetch habits');
      const habits = await response.json();
      set({ habits, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  toggleHabit: async (userId, habitId, date) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/habits/${habitId}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ date }),
      });

      if (!response.ok) throw new Error('Failed to toggle habit');
      
      // Atualiza o estado local para refletir a mudança imediatamente
      const updatedHabit = await response.json();
      set((state) => ({
        habits: state.habits.map((h) => (h.id === habitId ? updatedHabit : h)),
      }));
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  addHabit: async (userId, habitData) => {
    set({ isLoading: true, error: null });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/habits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(habitData),
      });

      if (!response.ok) throw new Error('Failed to create habit');
      const newHabit = await response.json();
      set((state) => ({
        habits: [...state.habits, newHabit],
        isLoading: false,
      }));
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
}));
