import { api } from '../../lib/api';
import type { RoutineItem, RoutineSession } from './types';

const base = '/routine-builder/sessions';

export const routineBuilderApi = {
  create(input: { focus: string; weekStart: string; timezone: string; locale: string; limits: { wakeTime: string; sleepTime: string; maxDailyLoadMinutes: number; unavailable: never[] } }) {
    return api.post(base, input) as Promise<RoutineSession>;
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
  apply(sessionId: string) {
    return api.post(`${base}/${sessionId}/apply`, {}) as Promise<{ counts: { objectives: number; habits: number; timelineBlocks: number } }>;
  },
};
