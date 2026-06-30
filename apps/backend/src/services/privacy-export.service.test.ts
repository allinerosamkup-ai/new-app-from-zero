import assert from 'node:assert/strict';

import { buildPrivacyExport } from './privacy-export.service';

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
    dailyCheckin: { findMany: async () => [{ moodScore: 4, energyScore: 2 }] },
    journalSession: { findMany: async () => [{ id: 'session-1', summary: 'Dia pesado' }] },
    journalMessage: { findMany: async () => [{ id: 'message-1', content: 'texto da usuaria' }] },
    timelineBlock: { findMany: async () => [{ id: 'block-1', title: 'Foco', status: 'pending' }] },
    objective: { findMany: async () => [{ id: 'goal-1', title: 'Dormir melhor' }] },
    habit: { findMany: async () => [{ id: 'habit-1', title: 'Agua', completions: [] }] },
    weeklyInsight: { findMany: async () => [{ id: 'insight-1', summary: 'Semana oscilou' }] },
    memoryEmbedding: { findMany: async () => [{ id: 'mem-1', content: 'preferencia registrada' }] },
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
  const firstJournalMessage = payload.data.journal.messages[0] as { content?: string };
  const firstHabit = payload.data.habits[0] as { title?: string };
  const firstPushSubscription = payload.data.pushSubscriptions[0] as { endpoint?: string };
  assert.equal(firstJournalMessage.content, 'texto da usuaria');
  assert.equal(firstHabit.title, 'Agua');
  assert.equal(firstPushSubscription.endpoint, 'push-endpoint');
  assert.deepEqual(calls, ['profile']);
}

run()
  .then(() => {
    console.log('privacy-export.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
