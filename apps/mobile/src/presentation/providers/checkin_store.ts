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
  clarityScore?: number | null;
  irritabilityScore?: number | null;
  physicalScore?: number | null;
  socialScore?: number | null;
  sleepScore?: number | null;
  sleepHours?: number | null;
  menstrualPhase?: string;
  cycleDay?: number;
  physicalSymptoms?: string[];
  isFlowing?: boolean;
  flowDay?: number;
  flowIntensity?: 'leve' | 'moderado' | 'intenso';
  symptomLevels?: {
    colica?: 1 | 2 | 3;
    dorCabeca?: 1 | 2 | 3;
  };
  note?: string;
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
        todayCheckin: result 
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
   * Carrega os check-ins recentes do backend (GET /api/checkins?userId=&days=)
   */
  loadRecentCheckins: async (userId: string, days = 7) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<CheckinResponse[]>('/api/checkins', {
        params: { userId, days },
      });
      set({ recentCheckins: response.data, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  clearError: () => set({ error: null }),
}));
