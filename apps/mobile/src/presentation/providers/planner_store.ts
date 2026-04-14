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
  syncBlocks: (userId: string, date: string, blocks: Partial<TimelineBlock>[]) => Promise<boolean>;
  completeBlock: (blockId: string) => Promise<void>;
  deleteBlock: (blockId: string) => Promise<void>;
  duplicateBlock: (blockId: string) => Promise<void>;
  updateBlock: (blockId: string, updates: Partial<Omit<TimelineBlock, 'id'>>) => Promise<void>;
}

/** Serializa todos os blocos atuais para persistência no backend. */
function serializeBlocks(blocks: TimelineBlock[]) {
  return blocks.map(b => ({
    id: b.id,
    title: b.title,
    startTime: b.startTime,
    endTime: b.endTime,
    category: b.category,
    intensity: b.intensity,
    status: b.status,
    isAiSuggested: b.isAiSuggested,
  }));
}

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
      set({ isLoading: false, error: err.response?.data?.error || err.message });
    }
  },

  syncBlocks: async (userId: string, date: string, blocks: Partial<TimelineBlock>[]) => {
    set({ isLoading: true, error: null });
    try {
      await api.post('/api/timeline', { userId, date, blocks });
      set({ isLoading: false });
      return true;
    } catch (err: any) {
      set({ isLoading: false, error: err.response?.data?.error || err.message });
      return false;
    }
  },

  completeBlock: async (blockId: string) => {
    const { blocks, selectedDate } = get();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const newStatus = block.status === 'completed' ? 'planned' : 'completed';
    const updatedBlocks = blocks.map(b =>
      b.id === blockId ? { ...b, status: newStatus } : b
    );
    set({ blocks: updatedBlocks });

    const userId = useAuthStore.getState().userId;
    if (userId) {
      try {
        await api.post('/api/timeline', {
          userId,
          date: selectedDate,
          forceSave: true,
          blocks: serializeBlocks(updatedBlocks),
        });
      } catch { /* optimistic — UI já atualizado */ }
    }
  },

  deleteBlock: async (blockId: string) => {
    const { blocks, selectedDate } = get();
    const updatedBlocks = blocks.filter(b => b.id !== blockId);
    set({ blocks: updatedBlocks });

    const userId = useAuthStore.getState().userId;
    if (userId) {
      try {
        await api.post('/api/timeline', {
          userId,
          date: selectedDate,
          forceSave: true,
          blocks: serializeBlocks(updatedBlocks),
        });
      } catch { /* silent */ }
    }
  },

  duplicateBlock: async (blockId: string) => {
    const { blocks, selectedDate } = get();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const copy: TimelineBlock = {
      ...block,
      id: `dup-${Date.now()}`,
      title: `${block.title} (cópia)`,
      status: 'planned',
    };

    const updatedBlocks = [...blocks, copy].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
    set({ blocks: updatedBlocks });

    const userId = useAuthStore.getState().userId;
    if (userId) {
      try {
        await api.post('/api/timeline', {
          userId,
          date: selectedDate,
          forceSave: true,
          blocks: serializeBlocks(updatedBlocks),
        });
      } catch { /* silent */ }
    }
  },

  updateBlock: async (blockId: string, updates: Partial<Omit<TimelineBlock, 'id'>>) => {
    const { blocks, selectedDate } = get();
    const updatedBlocks = blocks.map(b =>
      b.id === blockId ? { ...b, ...updates } : b
    );
    set({ blocks: updatedBlocks });

    const userId = useAuthStore.getState().userId;
    if (userId) {
      try {
        await api.post('/api/timeline', {
          userId,
          date: selectedDate,
          forceSave: true,
          blocks: serializeBlocks(updatedBlocks),
        });
      } catch { /* silent */ }
    }
  },
}));
