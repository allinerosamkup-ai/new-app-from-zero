import assert from 'node:assert/strict';

import { AiriaReadingService } from './airia-reading.service';

const userId = '11111111-1111-4111-8111-111111111111';
const date = '2026-08-13';
const checkins = [
  { id: 'morning', userId, localDate: new Date(`${date}T00:00:00.000Z`), recordedAt: new Date(`${date}T08:00:00.000Z`), updatedAt: new Date(`${date}T08:00:00.000Z`), checkinSlot: 'morning', checkinPurpose: 'window', moodScore: 8, energyScore: 8, stateLabel: 'Voo Alto', stateSummary: 'Alta energia.', aiState: {}, note: null },
  { id: 'midday', userId, localDate: new Date(`${date}T00:00:00.000Z`), recordedAt: new Date(`${date}T13:00:00.000Z`), updatedAt: new Date(`${date}T13:00:00.000Z`), checkinSlot: 'midday', checkinPurpose: 'window', moodScore: 3, energyScore: 3, stateLabel: 'Pausa', stateSummary: 'Queda importante.', aiState: {}, note: null },
  { id: 'evening', userId, localDate: new Date(`${date}T00:00:00.000Z`), recordedAt: new Date(`${date}T21:00:00.000Z`), updatedAt: new Date(`${date}T21:00:00.000Z`), checkinSlot: 'evening', checkinPurpose: 'window', moodScore: 7, energyScore: 6, stateLabel: 'Retomada', stateSummary: 'Recuperação parcial.', aiState: {}, note: null },
];

let savedReading: any;
let savedDecision: any;
const prisma: any = {
  dailyCheckin: { findMany: async () => checkins },
  journalSession: { findMany: async () => [] },
  objective: { findMany: async () => [{ id: 'objective-1', title: 'Sala pronta', progress: 20, subgoals: [{ id: 'action-1', title: 'Separar os itens da sala', done: false }], milestones: [], updatedAt: new Date(`${date}T09:00:00.000Z`) }] },
  userPattern: { findMany: async () => [] },
  userFact: { findMany: async () => [] },
  airiaReading: {
    upsert: async ({ create, update }: any) => {
      savedReading = { ...(savedReading ?? create), ...update, id: savedReading?.id ?? 'reading-1', userId, localDate: new Date(`${date}T00:00:00.000Z`), createdAt: new Date(), updatedAt: new Date() };
      return savedReading;
    },
    findUnique: async () => null,
  },
  airiaDecision: {
    findUnique: async () => savedDecision ?? null,
    upsert: async ({ create, update }: any) => { savedDecision = { ...(savedDecision ?? create), ...update, id: savedDecision?.id ?? 'decision-1', readingId: 'reading-1' }; return savedDecision; },
  },
  eventLog: { create: async () => ({}) },
};

void (async () => {
  const reading = await new AiriaReadingService(prisma).rebuild({ userId, localDate: date, surface: 'checkin' });
  assert.equal(reading.version, 'v1');
  assert.equal(reading.currentState.phase, 'Retomada');
  assert.equal((reading.currentState.intraday as any).observations, 3);
  assert.equal((reading.currentState.intraday as any).direction, 'oscillating');
  assert.equal((reading.currentState.intraday as any).range, 5);
  assert.equal(reading.period.observedDays, 1);
  assert.equal(reading.decision?.title, 'Separar os itens da sala');
  assert.equal(reading.decision?.requiresConfirmation, true);
  const historical = await new AiriaReadingService(prisma).rebuild({ userId, localDate: date, periodFrom: '2026-08-10', periodTo: '2026-08-12', surface: 'insights' });
  assert.equal(historical.currentState.phase, 'Retomada', 'custom period never replaces the latest state');
  assert.equal(historical.period.from, '2026-08-10');
  assert.equal(historical.period.to, '2026-08-12');
  console.log('airia-reading.service tests passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
