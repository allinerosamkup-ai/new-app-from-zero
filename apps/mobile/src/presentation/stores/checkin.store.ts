import { create } from 'zustand';

import type { Checkin, CheckinFormData } from '@/domain/entities/checkin';
import { checkinRepository } from '@/services/checkin_repository';

type CheckinStoreState = {
  isLoading: boolean;
  todayCheckin?: Checkin;
  recentCheckins: Checkin[];
  error?: string;
  submitCheckin: (data: CheckinFormData) => Promise<void>;
  loadRecentCheckins: (days?: number) => Promise<void>;
  clearError: () => void;
};

export const useCheckinStore = create<CheckinStoreState>((set) => ({
  isLoading: false,
  todayCheckin: undefined,
  recentCheckins: [],
  error: undefined,

  async submitCheckin(data) {
    set({ isLoading: true, error: undefined });

    try {
      const result = await checkinRepository.createCheckin(data);

      set((state) => ({
        isLoading: false,
        todayCheckin: result.checkin,
        recentCheckins: [
          result.checkin,
          ...state.recentCheckins.filter((item) => item.id !== result.checkin.id),
        ],
      }));
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Falha ao enviar check-in.',
      });
    }
  },

  async loadRecentCheckins(days = 7) {
    set({ isLoading: true, error: undefined });

    try {
      const result = await checkinRepository.getRecentCheckins(days);

      set({
        isLoading: false,
        recentCheckins: result.checkins,
        todayCheckin: result.checkins[0],
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Falha ao carregar check-ins.',
      });
    }
  },

  clearError() {
    set({ error: undefined });
  },
}));
