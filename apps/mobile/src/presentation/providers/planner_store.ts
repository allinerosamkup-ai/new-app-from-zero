import { create } from 'zustand';
import api from '../../services/api_service';
import { useAuthStore } from './auth_store';

export interface TimelineBlock {
  id: string;
  title: string;
  category: 'trabalho' | 'pessoal' | 'autocuidado' | 'social' | 'outro';
  intensity: 'L' | 'M' | 'P';
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  status: 'planned' | 'completed' | 'postponed';
  isAiSuggested: boolean;
  aiReasoning?: string;
}

interface PlannerState {
  selectedDate: string; // YYYY-MM-DD
  blocks: TimelineBlock[];
  isLoading: boolean;
  error: string | null;

  // Actions
  setSelectedDate: (date: string) => void;
  fetchBlocks: (userId: string, date: string) => Promise<void>;
  moveBlock: (blockId: string, newStart: string) => Promise<void>;
  syncBlocks: (userId: string, date: string, blocks: Partial<TimelineBlock>[]) => Promise<void>;
}

/**
 * Store Zustand para gerenciar o Planner Adaptativo.
 * Tradução do timelineProvider do Flutter.
 */
export const usePlannerStore = create<PlannerState>((set, get) => ({
  selectedDate: new Date().toISOString().split('T')[0],
  blocks: [],
  isLoading: false,
  error: null,

  setSelectedDate: (date: string) => set({ selectedDate: date }),

  fetchBlocks: async (userId: string, date: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<TimelineBlock[]>(`/api/timeline/${date}`, {
        params: { userId },
      });
      set({ blocks: response.data, isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  moveBlock: async (blockId: string, newStart: string) => {
    // Atualiza UI instantaneamente (otimista)
    const updatedBlocks = get().blocks.map(b =>
      b.id === blockId ? { ...b, startTime: newStart } : b
    );
    set({ blocks: updatedBlocks });

    // Persiste no backend
    const { selectedDate } = get();
    const userId = useAuthStore.getState().userId;
    if (userId) {
      try {
        await api.post('/api/timeline', {
          userId,
          date: selectedDate,
          forceSave: true,
          blocks: updatedBlocks.map(b => ({
            id: b.id,
            title: b.title,
            startTime: b.startTime,
            endTime: b.endTime,
            category: b.category,
            intensity: b.intensity,
            status: b.status,
          })),
        });
      } catch {
        // Falha silenciosa: UI já reflete o novo estado
      }
    }
  },

  syncBlocks: async (userId: string, date: string, blocks: Partial<TimelineBlock>[]) => {
    set({ isLoading: true });
    try {
      await api.post('/api/timeline', { userId, date, blocks });
      set({ isLoading: false });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },
}));
