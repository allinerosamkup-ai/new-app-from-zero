import assert from 'node:assert/strict';

import { AiActionFeedbackService } from './ai-action-feedback.service';

async function run() {
  let payload: Record<string, unknown> = {};
  const canonicalMemories: any[] = [];
  const canonicalEvidence: any[] = [];
  const prisma = {
    onboardingResponse: {
      findUnique: async () => ({ aiProfilePayload: payload }),
      upsert: async (args: any) => {
        payload = args.update.aiProfilePayload;
        return { aiProfilePayload: payload };
      },
    },
    userMemory: {
      findFirst: async ({ where }: any) => canonicalMemories.find((item) => item.canonicalKey === where.canonicalKey && item.lifecycle === 'active') ?? null,
      create: async ({ data }: any) => { const item = { id: `m-${canonicalMemories.length + 1}`, ...data }; canonicalMemories.push(item); return item; },
      update: async ({ where, data }: any) => { const item = canonicalMemories.find((row) => row.id === where.id); Object.assign(item, data); return item; },
    },
    userMemoryEvidence: {
      findFirst: async () => null,
      create: async ({ data }: any) => { canonicalEvidence.push(data); return data; },
      findMany: async () => canonicalEvidence,
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
    targetType: 'timeline',
    targetId: 'task-1',
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(canonicalMemories[0]?.negativeState, 'completed');
  assert.equal(canonicalMemories[0]?.targetId, 'task-1');

  const deduped = await AiActionFeedbackService.getRecent(prisma, 'user-1');
  assert.equal(deduped.length, 1);
  assert.equal(deduped[0]?.status, 'done');

  // ─── Fix 4: auto-bloqueio após 3 'shown' sem ação explícita ────────────
  let payload2: Record<string, unknown> = {};
  const prisma2 = {
    onboardingResponse: {
      findUnique: async () => ({ aiProfilePayload: payload2 }),
      upsert: async (args: any) => {
        payload2 = args.update.aiProfilePayload;
        return { aiProfilePayload: payload2 };
      },
    },
  };

  // 1ª exibição
  const shown1 = await AiActionFeedbackService.append(prisma2, 'user-2', {
    title: 'Beber água agora',
    status: 'shown',
    surface: 'home',
  });
  assert.equal(shown1?.status, 'shown');
  assert.equal(shown1?.shownCount, 1);
  assert.equal(AiActionFeedbackService.blocksFutureSuggestion(shown1?.status ?? ''), false);

  // 2ª exibição
  const shown2 = await AiActionFeedbackService.append(prisma2, 'user-2', {
    title: 'Beber água agora',
    status: 'shown',
    surface: 'home',
  });
  assert.equal(shown2?.status, 'shown');
  assert.equal(shown2?.shownCount, 2);
  assert.equal(AiActionFeedbackService.blocksFutureSuggestion(shown2?.status ?? ''), false);

  // 3ª exibição → auto-promove para 'dismissed'
  const shown3 = await AiActionFeedbackService.append(prisma2, 'user-2', {
    title: 'Beber água agora',
    status: 'shown',
    surface: 'home',
  });
  assert.equal(shown3?.status, 'dismissed');
  assert.equal(shown3?.shownCount, 3);
  assert.equal(shown3?.auto, true);
  assert.equal(AiActionFeedbackService.blocksFutureSuggestion(shown3?.status ?? ''), true);

  // Sugestão diferente NÃO é afetada
  const otherShown = await AiActionFeedbackService.append(prisma2, 'user-2', {
    title: 'Pintar parede da sala',
    status: 'shown',
    surface: 'home',
  });
  assert.equal(otherShown?.status, 'shown');
  assert.equal(otherShown?.shownCount, 1);
}

run().then(() => {
  console.log('ai-action-feedback.service tests passed');
});
