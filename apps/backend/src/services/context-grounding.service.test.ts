import assert from 'node:assert/strict';

import { ContextGroundingService } from './context-grounding.service';

async function run() {
  const prisma = {
    timelineBlock: {
      findMany: async () => [
        { title: 'Responder cliente da agenda', status: 'planned' },
        { title: 'Treino na Polônia', status: 'completed' },
      ],
    },
    habit: {
      findMany: async () => [
        {
          title: 'Diário',
          frequency: 'daily',
          targetDays: [],
          targetCount: 1,
          completions: [],
        },
        {
          title: 'Treino',
          frequency: 'daily',
          targetDays: [],
          targetCount: 1,
          completions: [{ completionCount: 1 }],
        },
      ],
    },
    objective: {
      findMany: async () => [
        {
          title: 'Preparar proposta da Airia',
          progress: 40,
          subgoals: [{ title: 'Separar prints', done: true }],
        },
      ],
    },
    onboardingResponse: {
      findUnique: async () => ({
        aiProfilePayload: {
          aiActionFeedback: [
            {
              key: 'ligar para proprietaria',
              title: 'Ligar para proprietária',
              status: 'deleted',
              surface: 'home',
              createdAt: '2026-04-30T09:00:00.000Z',
            },
          ],
        },
      }),
    },
  };

  const service = new ContextGroundingService(prisma as any);
  const context = await service.buildForSuggest({
    userId: 'user-1',
    type: 'stability-analysis',
    context: {
      localDate: '2026-04-30',
      pendingTaskTitles: ['Mandar mensagem para Matteo'],
      homeAutonomyFeedback: [{ title: 'Separar roupa de treino', status: 'dismissed' }],
    },
    recentSuggestionItems: [
      {
        key: 'arrumar kit do treino',
        text: 'Arrumar kit do treino',
        theme: 'execucao',
        sourceSurface: 'home',
        createdAt: '2026-04-30T10:00:00.000Z',
      },
    ],
    ragContext: 'MEMÓRIA: em semanas anteriores, treino ajudou quando a energia subiu.',
  });

  assert.deepEqual(context.pendingTaskTitles, ['Mandar mensagem para Matteo', 'Responder cliente da agenda']);
  assert.deepEqual(context.pendingHabitTitles, ['Diário']);
  assert.deepEqual(context.completedHabitTitles, ['Treino']);
  assert.deepEqual(context.completedTaskTitles, ['Treino na Polônia']);
  assert.deepEqual(context.completedSubgoalTitles, ['Separar prints']);
  assert.deepEqual(context.todayAnchorTitles, ['Mandar mensagem para Matteo', 'Responder cliente da agenda', 'Diário', 'Preparar proposta da Airia']);
  assert.match(String(context.groundingContext), /Memórias RAG entram como padrão\/contexto/);
  assert.doesNotMatch((context.todayAnchorTitles as string[]).join(' | '), /treino/i);
  assert.ok((context.blockedActionTitles as string[]).includes('Arrumar kit do treino'));
  assert.ok((context.blockedActionTitles as string[]).includes('Separar roupa de treino'));
  assert.ok((context.blockedActionTitles as string[]).includes('Ligar para proprietária'));
}

run().then(() => {
  console.log('context-grounding.service tests passed');
});
