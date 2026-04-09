import { create } from 'zustand';
import { AIService, CheckinResponse } from '../../services/ai_service';
import api from '../../services/api_service';

/**
 * Entidade de dados para o formulário de Check-in (Clean Architecture)
 */
export interface CheckinFormData {
  userId: string;
  localDate: string;
  moodScore: number;
  energyScore: number;
  clarityScore: number;
  irritabilityScore: number;
  note?: string;
  address?: string;
}

/**
 * Interface de Estado (State) equivalente ao CheckinState do Flutter
 */
interface CheckinState {
  isLoading: boolean;
  todayCheckin: CheckinResponse | null;
  recentCheckins: CheckinResponse[];
  error: string | null;

  // Actions (Notifiers)
  submitCheckin: (data: CheckinFormData) => Promise<void>;
  loadRecentCheckins: (userId: string, days?: number) => Promise<void>;
  clearError: () => void;
}

/**
 * Zustand Store: O equivalente ao StateNotifierProvider do Riverpod.
 * Gerencia o estado global do Check-in no Mobile.
 */
export const useCheckinStore = create<CheckinState>((set, get) => ({
  isLoading: false,
  todayCheckin: null,
  recentCheckins: [],
  error: null,

  /**
   * Submete o Check-in e atualiza o estado com o resultado da IA.
   */
  submitCheckin: async (data: CheckinFormData) => {
    set({ isLoading: true, error: null });
    try {
      // Chamada via AIService (Repository Pattern)
      const result = await AIService.submitCheckin(data);

      set({
        isLoading: false,
        todayCheckin: { ...result, address: data.address },
      });

      // Aqui poderíamos disparar a navegação para a tela de resultado
    } catch (err: any) {
      set({ 
        isLoading: false, 
        error: err.message || 'Falha ao processar check-in' 
      });
    }
  },

  /**
   * Carrega os check-ins recentes da API
   */
  loadRecentCheckins: async (userId: string, days = 7) => {
    set({ isLoading: true });
    try {
      const response = await api.get('/api/checkins/recent', {
        params: { userId, days }
      });
      const checkins = response.data.checkins || [];
      
      // Identificar o check-in de hoje (último slot do dia atual)
      const today = new Date().toISOString().split('T')[0];
      const todayCheckin = checkins
        .filter((c: any) => c.localDate.startsWith(today))
        .sort((a: any, b: any) => {
          const slotOrder = { morning: 1, midday: 2, evening: 3 };
          return (slotOrder[a.checkinSlot as keyof typeof slotOrder] || 0) - 
                 (slotOrder[b.checkinSlot as keyof typeof slotOrder] || 0);
        })
        .pop() || null;

      set({ 
        isLoading: false,
        recentCheckins: checkins,
        todayCheckin: todayCheckin ? {
          ...todayCheckin,
          aiState: todayCheckin.aiState || {
            analysis: todayCheckin.stateSummary || '',
            recommendations: [],
            suggestedIntensity: 'M',
            rationale: ''
          }
        } : null
      });
    } catch (err: any) {
      set({ 
        isLoading: false, 
        error: err.response?.data?.error || 'Falha ao carregar check-ins' 
      });
    }
  },

  clearError: () => set({ error: null }),
}));
