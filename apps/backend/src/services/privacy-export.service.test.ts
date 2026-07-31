import assert from 'node:assert/strict';

import { buildPrivacyExport } from './privacy-export.service';
import { deleteAllMemoryData } from './memory.service';

async function run() {
  const calls: string[] = [];
  const prisma = {
    profile: {
      findUnique: async () => {
        calls.push('profile');
        return { id: 'user-1', email: 'a@example.com', fullName: 'Alline' };
      },
    },
    onboardingResponse: { findUnique: async () => ({ userId: 'user-1', answers: { pace: 'low' } }) },
    userPreference: {
      findUnique: async () => ({
        userId: 'user-1',
        timezone: 'America/Sao_Paulo',
        gcalAccessToken: 'secret-access',
        gcalRefreshToken: 'secret-refresh',
      }),
    },
    consent: { findMany: async () => [{ consentType: 'privacy', granted: true }] },
    dailyCheckin: { findMany: async () => [{
      moodScore: 4,
      energyScore: 2,
      sleepHours: 6.5,
      source: 'aura_text',
      sourceMessageId: 'message-private-1',
      idempotencyKey: 'session-private:message-private-1',
      signalMetadata: { mood: { provenance: 'inferred' } },
    }] },
    journalSession: { findMany: async () => [{ id: 'session-1', summary: 'Dia pesado' }] },
    journalMessage: { findMany: async () => [{ id: 'message-1', content: 'texto da usuaria' }] },
    timelineBlock: { findMany: async () => [{ id: 'block-1', title: 'Foco', status: 'pending' }] },
    auraCommandSession: { findMany: async () => [{ id: 'command-session-1', status: 'active' }] },
    auraCommandMessage: { findMany: async () => [{ id: 'command-message-1', content: 'marque dentista' }] },
    auraCommandPlan: { findMany: async () => [{ id: 'command-plan-1', status: 'applied' }] },
    auraCommandOperation: { findMany: async () => [{ id: 'command-operation-1', type: 'create_calendar_event' }] },
    capture: { findMany: async () => [{ id: 'capture-1', title: 'Lista da viagem' }] },
    objective: { findMany: async () => [{ id: 'goal-1', title: 'Dormir melhor' }] },
    habit: { findMany: async () => [{ id: 'habit-1', title: 'Agua', completions: [] }] },
    weeklyInsight: { findMany: async () => [{ id: 'insight-1', summary: 'Semana oscilou' }] },
    memoryEmbedding: { findMany: async () => [{ id: 'mem-1', content: 'preferencia registrada' }] },
    userMemory: { findMany: async () => [{ id: 'canonical-1', canonicalKey: 'routine.focus' }] },
    userMemoryEvidence: { findMany: async () => [{ id: 'evidence-1', memoryId: 'canonical-1' }] },
    userEntity: { findMany: async () => [{ id: 'entity-1', canonicalName: 'trabalho' }] },
    userFact: { findMany: async () => [{ id: 'fact-1', statement: 'trabalha a tarde' }] },
    userPattern: { findMany: async () => [{ id: 'pattern-1', pattern: 'foco tarde' }] },
    userOpenDecision: { findMany: async () => [{ id: 'decision-1', question: 'quando focar?' }] },
    eventLog: { findMany: async () => [{ id: 'event-1', eventName: 'risk_protocol_triggered' }] },
    pushSubscription: { findMany: async () => [{ id: 'push-1', endpoint: 'push-endpoint' }] },
  };

  const payload = await buildPrivacyExport(prisma, 'user-1');

  assert.equal(payload.userId, 'user-1');
  assert.equal(payload.profile?.fullName, 'Alline');
  assert.equal(payload.preferences?.googleCalendarConnected, true);
  assert.equal(payload.preferences?.gcalAccessToken, undefined);
  assert.equal(payload.preferences?.gcalRefreshToken, undefined);
  assert.equal(payload.data.checkins.length, 1);
  const firstCheckin = payload.data.checkins[0] as Record<string, unknown>;
  assert.equal(firstCheckin.sleepHours, 6.5);
  assert.equal(firstCheckin.source, 'aura_text');
  assert.deepEqual(firstCheckin.signalMetadata, { mood: { provenance: 'inferred' } });
  assert.equal(firstCheckin.sourceMessageId, undefined);
  assert.equal(firstCheckin.idempotencyKey, undefined);
  assert.equal(payload.data.commandCenter.operations.length, 1);
  assert.equal(payload.data.captures.length, 1);
  const firstJournalMessage = payload.data.journal.messages[0] as { content?: string };
  const firstHabit = payload.data.habits[0] as { title?: string };
  const firstPushSubscription = payload.data.pushSubscriptions[0] as { endpoint?: string };
  assert.equal(firstJournalMessage.content, 'texto da usuaria');
  assert.equal(firstHabit.title, 'Agua');
  assert.equal(firstPushSubscription.endpoint, 'push-endpoint');
  assert.equal(payload.data.canonicalMemories.length, 1);
  assert.equal(payload.data.memoryEvidence.length, 1);
  assert.equal(payload.data.knowledgeGraph.entities.length, 1);
  assert.deepEqual(calls, ['profile']);

  const deleted: string[] = [];
  const deletable: any = Object.fromEntries(['memoryEmbedding', 'userMemoryEvidence', 'userMemory', 'userFact', 'userPattern', 'userOpenDecision', 'userEntity']
    .map((name) => [name, { deleteMany: async () => { deleted.push(name); } }]));
  let cleanedPayload: Record<string, unknown> | null = null;
  let transactions = 0;
  deletable.$transaction = async (fn: (tx: any) => Promise<void>) => { transactions += 1; return fn(deletable); };
  deletable.onboardingResponse = {
    findUnique: async () => ({ aiProfilePayload: {
      aiActionFeedback: [{ title: 'old' }],
      longTermMemory: [{ summary: 'legacy' }],
      longTermMemoryRaw: 'legacy raw',
      keepMe: true,
    } }),
    update: async ({ data }: any) => { cleanedPayload = data.aiProfilePayload; },
  };
  await deleteAllMemoryData(deletable, 'user-1');
  assert.deepEqual(deleted, ['memoryEmbedding', 'userMemoryEvidence', 'userMemory', 'userFact', 'userPattern', 'userOpenDecision', 'userEntity']);
  assert.deepEqual(cleanedPayload, { keepMe: true }, 'memory deletion clears legacy action feedback without deleting unrelated onboarding context');
  assert.equal(transactions, 1);
  await assert.doesNotReject(() => deleteAllMemoryData(deletable, 'user-1'));
  assert.equal(transactions, 2, 'memory deletion is transactionally idempotent');

  let serializationAttempts = 0;
  const retryable: any = {
    $transaction: async (fn: (tx: any) => Promise<void>) => {
      serializationAttempts += 1;
      if (serializationAttempts < 3) throw Object.assign(new Error('serialization conflict'), { code: 'P2034' });
      return fn(retryable);
    },
  };
  await deleteAllMemoryData(retryable, 'user-2');
  assert.equal(serializationAttempts, 3, 'privacy erasure retries bounded Prisma serialization conflicts');
}

run()
  .then(() => {
    console.log('privacy-export.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
