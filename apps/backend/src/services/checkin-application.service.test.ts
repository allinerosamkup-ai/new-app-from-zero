import assert from 'node:assert/strict';

import type { CheckinCreateInput } from '../contracts/checkin.contract';

async function run() {
  let module: typeof import('./checkin-application.service');
  try {
    module = await import('./checkin-application.service');
  } catch {
    assert.fail('CheckinApplicationService ainda não existe');
  }

  const rows: any[] = [];
  const evaluations: string[] = [];
  const repository: import('./checkin-application.service').CheckinApplicationRepository = {
    async findByIdempotency(userId, key) {
      return rows.find((row) => row.userId === userId && row.idempotencyKey === key) ?? null;
    },
    async upsertBySlot(input) {
      const existing = rows.find((row) => row.userId === input.userId
        && row.localDate.getTime() === input.localDate.getTime()
        && row.checkinSlot === input.checkinSlot);
      if (existing) return Object.assign(existing, input, { updatedAt: input.recordedAt });
      const row = { id: `checkin-${rows.length + 1}`, ...input, createdAt: input.recordedAt, updatedAt: input.recordedAt };
      rows.push(row);
      return row;
    },
    async updateEvaluation(id, evaluation) {
      const row = rows.find((item) => item.id === id);
      Object.assign(row, evaluation);
      return row;
    },
  };
  const service = new module.CheckinApplicationService({
    repository,
    evaluate: async ({ source }) => {
      evaluations.push(source);
      return {
        stateLabel: 'Energia protegida',
        stateLabelType: 'sensível',
        stateSummary: 'Hoje pede carga menor.',
        aiState: { recommendations: ['Manter apenas o próximo compromisso real.'] },
        riskSafety: { route: 'standard', riskLevel: 'none', matchedSignals: [] },
      } as any;
    },
  });

  const base: CheckinCreateInput = {
    userId: '11111111-1111-4111-8111-111111111111',
    localDate: '2026-07-31',
    moodScore: 3,
    energyScore: 3,
    clarityScore: null,
    irritabilityScore: null,
    physicalScore: null,
    socialScore: null,
    sleepScore: null,
    source: 'aura_text',
    sourceMessageId: 'message-1',
    idempotencyKey: 'session-1:message-1',
    signalMetadata: {
      mood: { provenance: 'inferred', confidence: 0.92, evidence: ['chateada'] },
      energy: { provenance: 'inferred', confidence: 0.95, evidence: ['cansada'] },
    },
    note: 'Estou chateada e cansada',
    emotions: ['sad', 'tired'],
    factors: [],
  };

  const first = await service.record(base, { now: new Date('2026-07-31T15:00:00.000Z') });
  assert.equal(first.status, 'persisted');
  assert.equal(first.checkinId, 'checkin-1');
  assert.equal(first.stateLabel, 'Energia protegida');
  assert.equal(first.stateSummary, 'Hoje pede carga menor.');
  assert.equal(rows[0].clarityScore, null);
  assert.equal(rows[0].physicalScore, null);
  assert.equal(rows[0].signalMetadata.mood.provenance, 'inferred');

  const duplicate = await service.record(base, { now: new Date('2026-07-31T15:01:00.000Z') });
  assert.equal(duplicate.checkinId, first.checkinId);
  assert.equal(rows.length, 1);
  assert.equal(evaluations.length, 1);

  const second = await service.record({
    ...base,
    sourceMessageId: 'message-2',
    idempotencyKey: 'session-1:message-2',
    note: 'Ainda cansada, mas mais calma',
  }, { now: new Date('2026-07-31T15:02:00.000Z') });
  assert.notEqual(second.checkinId, first.checkinId);
  assert.equal(rows.length, 2);
  assert.notEqual(rows[0].checkinSlot, rows[1].checkinSlot);

  await service.record({
    ...base,
    source: 'screen',
    sourceMessageId: null,
    idempotencyKey: 'screen-2026-07-31-morning',
  }, { now: new Date('2026-07-31T09:00:00.000Z') });
  assert.deepEqual(evaluations, ['aura_text', 'aura_text', 'screen']);
}

void run().then(() => console.log('checkin-application.service tests passed'));
