// Independent verifier: isolated synthetic repository, no user database/provider.
process.env.TS_NODE_PROJECT = require('path').resolve('apps/backend/tsconfig.json');
require('ts-node/register/transpile-only');
const assert = require('node:assert/strict');
const { CheckinApplicationService, PrismaCheckinApplicationRepository } = require('../../../apps/backend/src/services/checkin-application.service.ts');
const base = { userId: '00000000-0000-4000-8000-000000000001', localDate: '2026-10-02', moodScore: 3, energyScore: 3, source: 'screen', checkinSlot: 'morning', idempotencyKey: 'verify-fixture-01', note: 'não quero mais viver' };
async function run() {
  let row;
  let evaluations = 0;
  const writes = [];
  const prisma = { dailyCheckin: {
    findFirst: async ({ where }) => row?.idempotencyKey === where.idempotencyKey ? structuredClone(row) : null,
    upsert: async (args) => { writes.push(args); row = { id: '00000000-0000-4000-8000-000000000002', ...args.create }; return structuredClone(row); },
    updateMany: async () => { throw new Error('DERIVED_PRIVATE_SECRET'); },
    findUnique: async () => structuredClone(row),
  } };
  const repository = new PrismaCheckinApplicationRepository(prisma);
  const unavailable = new CheckinApplicationService({ repository, evaluate: async () => { evaluations++; throw new Error('PROVIDER_PRIVATE_SECRET'); } });
  const first = await unavailable.record(base);
  assert.equal(first.status, 'persisted'); assert.equal(first.analysisStatus, 'unavailable');
  assert.equal(first.riskSafety.route, 'crisis_protocol'); assert.equal(first.stateLabel, null);
  assert.equal(row.aiState.analysisStatus, 'unavailable');
  assert.ok(!JSON.stringify(first).includes('SECRET'));
  const retry = await unavailable.record(base);
  assert.equal(retry.id, first.id); assert.equal(evaluations, 1); assert.equal(retry.riskSafety.route, 'crisis_protocol');
  assert.equal(writes.length, 1);
  const sourceFailure = new CheckinApplicationService({ repository: { ...repository, findByIdempotency: async () => null, upsertBySlot: async () => { throw new Error('SOURCE_WRITE_FAIL'); } }, evaluate: async () => { throw new Error('MUST_NOT_EVALUATE'); } });
  await assert.rejects(sourceFailure.record(base), /SOURCE_WRITE_FAIL/);
  const derivedFailure = new CheckinApplicationService({ repository, evaluate: async () => ({ stateLabel: 'invented', stateLabelType: 'calm', stateSummary: 'must not leak', aiState: {}, riskSafety: { riskLevel: 'none', route: 'self_support' } }) });
  const derived = await derivedFailure.record({ ...base, idempotencyKey: 'verify-fixture-02' });
  assert.equal(derived.analysisStatus, 'unavailable'); assert.equal(derived.stateSummary, null);
  assert.equal(derived.riskSafety.route, 'crisis_protocol'); assert.equal(row.aiState.riskSafety.route, 'crisis_protocol');
  assert.equal(writes.at(-1).update.stateSummary, null); assert.equal(writes.at(-1).update.stateLabel, null);
  const { AiriaReadingService } = require('../../../apps/backend/src/services/airia-reading.service.ts');
  const sourceOnly = new AiriaReadingService({
    airiaReading: { findUnique: async () => ({ currentState: { checkinId: 'old', observedAt: 'old' }, decision: { title: 'STALE DECISION' } }) },
    dailyCheckin: { findMany: async () => [structuredClone(row)] },
  });
  sourceOnly.rebuild = async () => { throw new Error('REBUILD_FAILED'); };
  const readback = await sourceOnly.get(base.userId, base.localDate);
  assert.equal(readback.decision, null); assert.equal(readback.capacity, null);
  assert.equal(readback.riskSafety.route, 'crisis_protocol'); assert.equal(readback.currentState.analysisStatus, 'unavailable');
  row.aiState.analysisStatus = 'available';
  const failedRebuild = await sourceOnly.get(base.userId, base.localDate);
  assert.equal(failedRebuild.decision, null); assert.equal(failedRebuild.currentState.analysisStatus, 'unavailable');
  const { CheckinResponseSchema } = require('../../../apps/backend/src/contracts/checkin.contract.ts');
  assert.equal(CheckinResponseSchema.safeParse(first).success, true);
  assert.equal(CheckinResponseSchema.safeParse({ ...first, analysisStatus: 'fake' }).success, false);
  let staleFeedbackWrites = 0;
  const staleDecision = { id: 'old-decision', readingId: 'old-reading', reading: { id: 'old-reading', localDate: new Date(base.localDate), updatedAt: new Date(), currentState: { checkinId: 'old', observedAt: 'old' }, intraday: {}, historical: {}, riskSafety: first.riskSafety } };
  const feedbackService = new AiriaReadingService({
    dailyCheckin: { findMany: async () => [structuredClone(row)] },
    airiaDecision: { findFirst: async () => staleDecision, update: async () => { staleFeedbackWrites++; return staleDecision; } },
    eventLog: { create: async () => ({}) },
  });
  await feedbackService.feedback({ userId: base.userId, decisionId: 'old-decision', status: 'aceita', surface: 'home' }).catch(() => {});
  assert.equal(staleFeedbackWrites, 0, 'A stale decision must not be accepted after a new source');
  row.aiState.analysisStatus = 'unavailable';
  let forbiddenDerivationWrites = 0;
  const rebuildService = new AiriaReadingService({
    dailyCheckin: { findMany: async () => [structuredClone(row)] },
    journalSession: { findMany: async () => [] }, objective: { findMany: async () => [] }, userPattern: { findMany: async () => [] },
    airiaReading: { upsert: async () => { forbiddenDerivationWrites++; throw new Error('MUST_NOT_WRITE'); } },
    airiaDecision: { findMany: async () => [], upsert: async () => { forbiddenDerivationWrites++; throw new Error('MUST_NOT_WRITE'); } },
  });
  const rebuilt = await rebuildService.rebuild({ userId: base.userId, localDate: base.localDate });
  assert.equal(rebuilt.decision, null); assert.equal(rebuilt.capacity, null); assert.equal(forbiddenDerivationWrites, 0);
  console.log('PASS independent service: durable source, sanitization, crisis, retry, source-write failure, derived-write failure, clearing stale fields.');
  console.log('PASS independent canonical read: unavailable source and failed rebuild suppress stale decision; response enum enforced.');
  console.log('PASS independent feedback/rebuild: stale confirmation rejected before mutation; unavailable rebuild has no interpretation writes.');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
