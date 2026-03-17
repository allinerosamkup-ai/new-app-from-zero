import { create } from 'zustand';
import { AIService, CheckinResponse } from '../../services/ai_service';

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
   * Carrega os check-ins recentes (Placeholder para implementação futura da API)
   */
  loadRecentCheckins: async (userId: string, days = 7) => {
    set({ isLoading: true });
    try {
      // TODO: Implementar endpoint GET /api/checkins/recent no backend
      set({ isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  clearError: () => set({ error: null }),
}));
