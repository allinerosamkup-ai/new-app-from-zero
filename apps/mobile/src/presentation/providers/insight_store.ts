import { create } from 'zustand';
import api from '../../services/api_service';

export interface WeeklyInsightData {
  summary: {
    avgMood: number;
    avgEnergy: number;
    checkinCount: number;
    journalSessions: number;
    tasksCompleted: number;
    tasksTotal: number;
  };
  patterns: Array<{
    type: 'energy' | 'mood' | 'productivity' | 'sleep';
    description: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
  recommendations: Array<{
    category: 'planning' | 'self-care' | 'social';
    text: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  aiAnalysis: string;
}

interface InsightState {
  weeklyData: WeeklyInsightData | null;
  rawData: any | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchWeeklyInsights: (userId: string, weekStart: string) => Promise<void>;
}

/**
 * Store Zustand para gerenciar os Insights Semanais.
 * Tradução do insightProvider do Flutter.
 */
export const useInsightStore = create<InsightState>((set) => ({
  weeklyData: null,
  rawData: null,
  isLoading: false,
  error: null,

  fetchWeeklyInsights: async (userId: string, weekStart: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/api/insights/weekly', {
        params: { userId, weekStart }
      });
      set({ 
        weeklyData: response.data.insights, 
        rawData: response.data.rawData,
        isLoading: false 
      });
    } catch (err: any) {
      set({ 
        isLoading: false, 
        error: err.response?.data?.error || 'Falha ao carregar insights' 
      });
    }
  },
}));
