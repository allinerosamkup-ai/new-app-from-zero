import { create } from 'zustand';
import { apiGet, apiPost, apiFetch } from '../lib/api';

export interface SubGoal {
  id: string;
  title: string;
  done: boolean;
  aiGenerated: boolean;
}

export interface Objective {
  id: string;
  title: string;
  description?: string;
  category: string;
  progress: number;
  subgoals: SubGoal[];
  aiInsight?: string;
  createdAt: string;
}

interface ObjectivesState {
  objectives: Objective[];
  isLoading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (data: { title: string; description?: string; category: string; subgoals?: SubGoal[] }) => Promise<Objective | null>;
  update: (id: string, patch: Partial<Omit<Objective, 'id' | 'createdAt'>>) => Promise<void>;
  toggleSubGoal: (objectiveId: string, subGoalId: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function computeProgress(subgoals: SubGoal[]): number {
  if (!subgoals.length) return 0;
  return Math.round((subgoals.filter((s) => s.done).length / subgoals.length) * 100);
}

export const useObjectivesStore = create<ObjectivesState>((set, get) => ({
  objectives: [],
  isLoading: false,
  error: null,

  async load() {
    set({ isLoading: true, error: null });
    try {
      const data = await apiGet<Objective[]>('/api/objectives');
      set({ objectives: data, isLoading: false });
    } catch (e) {
      set({ isLoading: false, error: e instanceof Error ? e.message : 'Erro ao carregar objetivos.' });
    }
  },

  async create(data) {
    try {
      const obj = await apiPost<Objective>('/api/objectives', data);
      set((s) => ({ objectives: [...s.objectives, obj] }));
      return obj;
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Erro ao criar objetivo.' });
      return null;
    }
  },

  async update(id, patch) {
    const prev = get().objectives;
    // optimistic update
    set((s) => ({
      objectives: s.objectives.map((o) =>
        o.id === id ? { ...o, ...patch } : o
      ),
    }));
    try {
      const res = await apiFetch(`/api/objectives/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error('Falha ao atualizar objetivo');
    } catch (e) {
      set({ objectives: prev, error: e instanceof Error ? e.message : 'Erro ao atualizar.' });
    }
  },

  async toggleSubGoal(objectiveId, subGoalId) {
    const obj = get().objectives.find((o) => o.id === objectiveId);
    if (!obj) return;
    const newSubgoals = obj.subgoals.map((s) =>
      s.id === subGoalId ? { ...s, done: !s.done } : s
    );
    const newProgress = computeProgress(newSubgoals);
    await get().update(objectiveId, { subgoals: newSubgoals, progress: newProgress });
  },

  async remove(id) {
    const prev = get().objectives;
    set((s) => ({ objectives: s.objectives.filter((o) => o.id !== id) }));
    try {
      const res = await apiFetch(`/api/objectives/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Falha ao remover objetivo');
    } catch (e) {
      set({ objectives: prev, error: e instanceof Error ? e.message : 'Erro ao remover.' });
    }
  },
}));
