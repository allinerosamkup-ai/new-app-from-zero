import assert from 'node:assert/strict';

import { AiActionFeedbackService } from './ai-action-feedback.service';

async function run() {
  let payload: Record<string, unknown> = {};
  const prisma = {
    onboardingResponse: {
      findUnique: async () => ({ aiProfilePayload: payload }),
      upsert: async (args: any) => {
        payload = args.update.aiProfilePayload;
        return { aiProfilePayload: payload };
      },
    },
  };

  const stored = await AiActionFeedbackService.append(prisma, 'user-1', {
    title: 'Separar roupa de treino',
    status: 'dismissed',
    surface: 'home',
    sourceType: 'stability-analysis',
    localDate: '2026-04-30',
  });

  assert.equal(stored?.key, 'separar roupa de treino');
  assert.equal(stored?.status, 'dismissed');

  const recent = await AiActionFeedbackService.getRecent(prisma, 'user-1');
  assert.equal(recent.length, 1);
  assert.equal(recent[0]?.title, 'Separar roupa de treino');
  assert.equal(AiActionFeedbackService.blocksFutureSuggestion(recent[0]?.status ?? ''), true);

  await AiActionFeedbackService.append(prisma, 'user-1', {
    title: 'Separar roupa de treino',
    status: 'done',
    surface: 'home',
  });

  const deduped = await AiActionFeedbackService.getRecent(prisma, 'user-1');
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0]?.status, 'done');
}

run().then(() => {
  console.log('ai-action-feedback.service tests passed');
});
