import { api } from '../../lib/api';
import type { GuidedAnswers, GuidedLibrary } from '../guided-onboarding/types';
import type { RoutineItem, RoutineSession } from './types';

const base = '/routine-builder/sessions';

export const routineBuilderApi = {
  create(input: { focus: string; weekStart: string; timezone: string; locale: string; limits: { wakeTime: string; sleepTime: string; maxDailyLoadMinutes: number; unavailable: never[] } }) {
    return api.post(base, input) as Promise<RoutineSession>;
  },
  /** Catálogo de opções do onboarding guiado — uma chamada, tudo que a tela de botões precisa. */
  library() {
    return api.get('/routine-builder/library') as Promise<GuidedLibrary>;
  },
  /** Abre a sessão do fluxo guiado: sem documento e sem foco escrito. */
  createGuided(input: { weekStart: string; timezone: string }) {
    return api.post(base, { mode: 'guided', locale: 'pt-BR', ...input }) as Promise<RoutineSession>;
  },
  submitGuided(sessionId: string, answers: GuidedAnswers, today: string) {
    return api.post(`${base}/${sessionId}/guided`, { answers, today }) as Promise<RoutineSession>;
  },
  get(sessionId: string) {
    return api.get(`${base}/${sessionId}`) as Promise<RoutineSession>;
  },
  sendText(sessionId: string, text: string) {
    return api.post(`${base}/${sessionId}/source`, { sourceType: 'text', text }) as Promise<RoutineSession>;
  },
  upload(sessionId: string, file: File) {
    return api.upload(`${base}/${sessionId}/source`, file) as Promise<RoutineSession>;
  },
  updateItems(sessionId: string, items: RoutineItem[]) {
    return api.patch(`${base}/${sessionId}/items`, { items }) as Promise<RoutineSession>;
  },
  answer(sessionId: string, answers: Array<{ questionId: string; answer: string }>) {
    return api.post(`${base}/${sessionId}/clarifications`, { answers }) as Promise<RoutineSession>;
  },
  compose(sessionId: string) {
    return api.post(`${base}/${sessionId}/compose`, {}) as Promise<RoutineSession>;
  },
  apply(sessionId: string, sourceItemIds?: string[]) {
    return api.post(
      `${base}/${sessionId}/apply`,
      sourceItemIds ? { sourceItemIds } : {},
    ) as Promise<{
      counts: { objectives: number; habits: number; timelineBlocks: number };
      ids: { objectives: string[]; habits: string[]; timelineBlocks: string[] };
      appliedSourceItemIds: string[];
    }>;
  },
};
