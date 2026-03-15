import assert from 'node:assert/strict';

import { AIService } from '../../services/ai_service';
import { useJournalStore } from './journal_store';

async function run() {
  useJournalStore.setState({
    sessionId: null,
    userId: null,
    messages: [],
    isLoading: false,
    isStreaming: false,
    context: null,
    error: null,
  } as any);

  AIService.startJournalSession = async () => ({
    sessionId: '7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11',
    created: true,
    messages: [],
    context: {
      promptSummary: 'Rotina percebida: Costuma render melhor no fim da manhã.',
      topThemes: ['trabalho'],
      topPlannerCategories: ['trabalho'],
      checkinToday: {
        moodScore: 3,
        energyScore: 2,
        stateLabel: 'Dia sensível',
      },
    },
  });

  AIService.streamJournalMessage = async ({ onEvent }: any) => {
    onEvent({ event: 'assistant.delta', data: { chunk: 'Olá, ' } });
    onEvent({
      event: 'assistant.completed',
      data: {
        sessionId: '7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11',
        message: {
          id: 'msg-assistant',
          role: 'assistant',
          content: 'Olá, estou com você.',
          createdAt: new Date('2026-03-13T12:00:05.000Z').toISOString(),
        },
      },
    });
  };

  await useJournalStore.getState().startSession('550e8400-e29b-41d4-a716-446655440000');

  assert.equal(useJournalStore.getState().sessionId, '7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11');
  assert.equal(useJournalStore.getState().context?.checkinToday?.stateLabel, 'Dia sensível');

  await useJournalStore.getState().sendMessage('Hoje eu estou travada.');

  const state = useJournalStore.getState();
  assert.equal(state.messages.length, 2);
  assert.equal(state.messages[0].role, 'user');
  assert.equal(state.messages[1].role, 'assistant');
  assert.equal(state.messages[1].content, 'Olá, estou com você.');
  assert.equal(state.isStreaming, false);
}

run()
  .then(() => {
    console.log('journal_store tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
