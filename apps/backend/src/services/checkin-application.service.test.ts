import assert from 'node:assert/strict';

import type { CheckinCreateInput } from '../contracts/checkin.contract';

async function run() {
  let module: typeof import('./checkin-application.service');
  try {
    module = await import('./checkin-application.service');
  } catch {
    assert.fail('CheckinApplicationService ainda não existe');
  }

  let upsertCall: any;
  let guardedCall: any;
  const prismaRepository = new module.PrismaCheckinApplicationRepository({ dailyCheckin: {
    upsert: async (input: any) => { upsertCall = input; return { id: 'db-row' }; },
    updateMany: async (input: any) => { guardedCall = input; return { count: 0 }; },
  } } as any);
  await prismaRepository.upsertBySlot({ userId: 'u', localDate: new Date('2026-07-31'), recordedAt: new Date('2026-07-31'), checkinSlot: 'midday', source: 'screen', moodScore: 3, energyScore: 3, menstrualPhase: null, cycleDay: null, physicalSymptoms: [], aiState: { analysisStatus: 'unavailable', riskSafety: { route: 'human_support' } } } as any);
  assert.equal(upsertCall.update.stateSummary, null);
  assert.equal(upsertCall.update.stateLabel, null);
  assert.equal(upsertCall.update.aiState.analysisStatus, 'unavailable');
  const sourceTime = new Date('2026-07-31');
  await assert.rejects(prismaRepository.updateEvaluation('db-row', { stateLabel: 'old', stateLabelType: 'leve', stateSummary: 'old', aiState: {} }, sourceTime, 'revision-1'), /CHECKIN_SOURCE_CHANGED/);
  assert.equal(guardedCall.where.recordedAt, sourceTime);
  assert.deepEqual(guardedCall.where.aiState, { path: ['sourceRevision'], equals: 'revision-1' });

  let concurrentRow: any;
  let releaseSlow!: () => void;
  const slow = new Promise<void>((resolve) => { releaseSlow = resolve; });
  const concurrent = new module.CheckinApplicationService({ repository: {
    findByIdempotency: async () => null,
    upsertBySlot: async (input) => { concurrentRow = { ...input, id: 'same-slot', stateLabel: null, stateSummary: null }; return { ...concurrentRow }; },
    updateEvaluation: async (_id, evaluation, _recordedAt, revision) => {
      if (concurrentRow.aiState.sourceRevision !== revision) throw new Error('CHECKIN_SOURCE_CHANGED');
      concurrentRow = { ...concurrentRow, ...evaluation }; return { ...concurrentRow };
    },
  }, evaluate: async ({ note }) => { if (note === 'slow') await slow; return { stateLabel: note!, stateLabelType: 'leve', stateSummary: note!, aiState: {}, riskSafety: { riskLevel: 'none' } }; } });
  const concurrentInput = { userId: '11111111-1111-4111-8111-111111111111', localDate: '2026-10-02', moodScore: 3, energyScore: 3, checkinSlot: 'midday', source: 'screen' as const };
  const sameMillisecond = { now: new Date('2026-10-02T12:00:00.000Z') };
  const firstPending = concurrent.record({ ...concurrentInput, note: 'slow' }, sameMillisecond);
  await new Promise<void>((resolve) => setImmediate(resolve));
  await concurrent.record({ ...concurrentInput, note: 'new' }, sameMillisecond);
  releaseSlow();
  const staleResult = await firstPending;
  assert.equal(concurrentRow.stateSummary, 'new');
  assert.equal(staleResult.analysisStatus, 'unavailable');

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
      if (existing) return Object.assign(existing, input, { stateLabel: null, stateLabelType: null, stateSummary: null, updatedAt: input.recordedAt });
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

  const unavailable = new module.CheckinApplicationService({ repository, evaluate: async () => { throw new Error('provider secret'); } });
  const savedWithoutAnalysis = await unavailable.record({ ...base, idempotencyKey: 'unavailable', sourceMessageId: 'unavailable', note: 'não quero mais viver' });
  assert.equal(savedWithoutAnalysis.status, 'persisted');
  assert.equal(savedWithoutAnalysis.analysisStatus, 'unavailable');
  assert.equal(savedWithoutAnalysis.riskSafety?.route, 'crisis_protocol');
  const retry = await unavailable.record({ ...base, idempotencyKey: 'unavailable', sourceMessageId: 'unavailable', note: 'não quero mais viver' });
  assert.equal(retry.checkinId, savedWithoutAnalysis.checkinId);
  assert.equal(retry.analysisStatus, 'unavailable');
  assert.equal(retry.riskSafety?.route, 'crisis_protocol');
  const failingWrite = new module.CheckinApplicationService({ repository: { ...repository, upsertBySlot: async () => { throw new Error('write failed'); } }, evaluate: async () => assert.fail('must not evaluate') });
  await assert.rejects(failingWrite.record({ ...base, idempotencyKey: 'write-error' }), /write failed/);
  const derivedWriteFailure = new module.CheckinApplicationService({ repository: { ...repository, updateEvaluation: async () => { throw new Error('derived write failed'); } }, evaluate: async () => ({ stateLabel: 'old', stateLabelType: 'leve', stateSummary: 'obsolete', aiState: { recommendations: ['obsolete'] }, riskSafety: {} }) });
  const derivedFailed = await derivedWriteFailure.record({ ...base, idempotencyKey: 'derived-error' });
  assert.equal(derivedFailed.analysisStatus, 'unavailable');
  assert.equal((derivedFailed.aiState as any).analysisStatus, 'unavailable');
  assert.equal((derivedFailed.aiState as any).recommendations, undefined);
  rows.length = 0;

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

  const amended = await unavailable.record({ ...base, source: 'screen', sourceMessageId: null, checkinSlot: rows[2].checkinSlot, idempotencyKey: 'screen-2026-07-31-morning', note: 'sem saída' }, { now: new Date('2026-07-31T09:05:00.000Z') });
  assert.equal(amended.stateSummary, null);
  assert.equal(amended.stateLabel, null);
  assert.equal(rows[2].stateSummary, null);
  assert.equal(rows[2].aiState.analysisStatus, 'unavailable');
  assert.equal(rows[2].aiState.riskSafety.route, 'human_support');

  /**
   * O que a tela do check-in pergunta chega à camada de persistência.
   *
   * Clareza e irritabilidade tinham coluna aqui e nenhuma pergunta na tela;
   * capacidade e objetivo prioritário tinham o inverso. Este bloco é o elo
   * final da prova: com a tela perguntando, o valor precisa aparecer no que vai
   * para o banco — não só ser aceito pelo contrato.
   */
  rows.length = 0;
  await service.record({
    ...base,
    source: 'screen',
    sourceMessageId: null,
    idempotencyKey: 'screen-2026-07-31-evening',
    clarityScore: 2,
    irritabilityScore: 9,
    physicalScore: 6,
    socialScore: 4,
    sleepScore: 3,
    sleepHours: 5,
    signalMetadata: {
      mood: { provenance: 'reported', confidence: 1, evidence: ['screen:mood'] },
      irritability: { provenance: 'reported', confidence: 1, evidence: ['screen:irritability'] },
      dayPlan: { capacity: 'quick', priorityGoalId: 'goal-7' },
    },
  }, { now: new Date('2026-07-31T20:00:00.000Z') });

  assert.equal(rows[0].clarityScore, 2);
  assert.equal(rows[0].irritabilityScore, 9);
  assert.equal(rows[0].sleepHours, 5);
  assert.deepEqual(rows[0].signalMetadata.dayPlan, { capacity: 'quick', priorityGoalId: 'goal-7' });
}

void run().then(() => console.log('checkin-application.service tests passed'));
