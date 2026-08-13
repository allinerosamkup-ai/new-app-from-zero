import assert from 'node:assert/strict';

import { CanonicalMemoryService, isDecisionEligiblePattern } from './canonical-memory.service';

function fakePrisma() {
  const memories: any[] = [];
  const evidence: any[] = [];
  let seq = 0;
  const memoryModel = {
    findFirst: async ({ where }: any) => memories.find((m) => m.userId === where.userId
      && (!where.canonicalKey || m.canonicalKey === where.canonicalKey)
      && (!where.lifecycle || m.lifecycle === where.lifecycle)) ?? null,
    findMany: async ({ where, orderBy, take, cursor, skip }: any) => {
      let rows = memories.filter((m) => m.userId === where.userId
        && (!where.lifecycle || m.lifecycle === where.lifecycle)
        && (!where.locale?.in || where.locale.in.includes(m.locale))
        && (!where.id?.in || where.id.in.includes(m.id))
        && (!(where.negativeState && Object.prototype.hasOwnProperty.call(where.negativeState, 'not')) || m.negativeState !== where.negativeState.not));
      if (orderBy) rows = rows.sort((a, b) => Number(b.salience ?? 0) - Number(a.salience ?? 0));
      if (cursor?.id) {
        const cursorIndex = rows.findIndex((row) => row.id === cursor.id);
        rows = cursorIndex >= 0 ? rows.slice(cursorIndex + Number(skip ?? 0)) : [];
      } else if (skip) {
        rows = rows.slice(skip);
      }
      return typeof take === 'number' ? rows.slice(0, take) : rows;
    },
    create: async ({ data }: any) => { const row = { id: `m${++seq}`, ...data, createdAt: new Date(), updatedAt: new Date() }; memories.push(row); return row; },
    update: async ({ where, data }: any) => { const row = memories.find((m) => m.id === where.id)!; Object.assign(row, data, { updatedAt: new Date() }); return row; },
  };
  const evidenceModel = {
    findFirst: async ({ where }: any) => evidence.find((e) => e.memoryId === where.memoryId && e.hash === where.hash) ?? null,
    findMany: async ({ where }: any) => evidence.filter((e) => e.memoryId === where.memoryId),
    create: async ({ data }: any) => { const row = { id: `e${++seq}`, ...data, createdAt: new Date() }; evidence.push(row); return row; },
  };
  const prisma: any = { userMemory: memoryModel, userMemoryEvidence: evidenceModel };
  let transactionQueue = Promise.resolve();
  prisma.$transaction = (fn: (tx: any) => Promise<any>) => {
    const run = transactionQueue.then(() => fn(prisma));
    transactionQueue = run.then(() => undefined, () => undefined);
    return run;
  };
  return { prisma, memories, evidence };
}

async function run() {
  const db = fakePrisma();
  const projections: any[] = [];
  let vectorResult: any[] | null = null;
  const service = new CanonicalMemoryService(db.prisma as any, {
    retrieve: async () => {
      if (vectorResult === null) throw new Error('vector offline');
      return vectorResult;
    },
    store: async (input: any) => { projections.push(input); },
  });
  const base = { userId: 'u1', kind: 'preference' as const, scope: 'routine', canonicalKey: 'routine.focus', content: 'Prefere foco pela manha', source: 'aura', sourceId: 'msg-1', observedAt: new Date('2026-07-10T10:00:00Z') };
  const first = await service.write(base);
  const duplicate = await service.write(base);
  assert.equal(first.memory?.id, duplicate.memory?.id, 'same evidence must be idempotent');
  assert.equal(db.evidence.length, 1);
  assert.equal(projections[0]?.memoryId, first.memory?.id, 'canonical projection must carry the real memory UUID');
  assert.equal(projections[0]?.contentId, `canonical:${first.memory?.id}`);

  const renewedUntil = new Date('2026-08-01');
  await service.write({ ...base, observedAt: new Date('2026-07-12'), validUntil: renewedUntil, structuredValue: { preferredWindow: 'morning' }, confidence: 0.91, salience: 0.8 });
  const renewed = db.memories.find((m) => m.id === first.memory?.id);
  assert.equal(new Date(renewed.validUntil).toISOString(), renewedUntil.toISOString());
  assert.equal(renewed.structuredValue.preferredWindow, 'morning');
  assert.equal(projections.filter((item) => item.memoryId === first.memory?.id).length, 1, 'unchanged content reuses its embedding');

  for (const [sourceId, date] of [['p1', '2026-07-10'], ['p2', '2026-07-10'], ['p3', '2026-07-11']] as const) {
    await service.write({ ...base, kind: 'pattern', canonicalKey: 'agenda.late-focus', content: 'Costuma focar tarde', sourceId, observedAt: new Date(`${date}T18:00:00Z`), inferred: true });
  }
  const pattern = db.memories.find((m) => m.canonicalKey === 'agenda.late-focus');
  assert.equal((pattern.structuredValue as any).confirmed, true, 'pattern needs 3 evidence items across 2 days');
  assert.equal((pattern.structuredValue as any).evidenceIds.length, 3, 'confirmed pattern keeps evidence references');
  assert.equal(isDecisionEligiblePattern(pattern), true, 'confirmed pattern can feed a decision');
  assert.equal(isDecisionEligiblePattern({ kind: 'pattern', structuredValue: { inferred: true, confirmed: false } }), false,
    'unconfirmed inferred pattern cannot feed a decision');
  assert.equal(isDecisionEligiblePattern({ kind: 'pattern', structuredValue: { confirmed: true, evidenceCount: 3, distinctDays: 2, evidenceIds: ['e1', 'e2'] } }), false,
    'confirmation without three persisted evidence references cannot feed a decision');

  await service.write({ ...base, sourceId: 'msg-2', content: 'Prefere foco a tarde', observedAt: new Date('2026-07-13') });
  assert.equal(db.memories.filter((m) => m.canonicalKey === 'routine.focus' && m.lifecycle === 'active').length, 1);
  assert.equal(db.memories.some((m) => m.canonicalKey === 'routine.focus' && m.lifecycle === 'superseded'), true);

  await service.write({ ...base, canonicalKey: 'old.context', kind: 'context', content: 'Contexto antigo', sourceId: 'old', validUntil: new Date('2026-07-01') });
  await service.write({ ...base, canonicalKey: 'pt.fact', kind: 'fact', content: 'Fato em portugues', sourceId: 'pt', locale: 'pt-BR' });
  await service.write({ ...base, canonicalKey: 'en.fact', kind: 'fact', content: 'English fact', sourceId: 'en', locale: 'en-US' });
  await service.writeNegative({ userId: 'u1', canonicalKey: 'task:pay-rent', targetType: 'timeline', targetId: 't-1', state: 'completed', content: 'Aluguel pago', source: 'feedback' });
  const retrieved = await service.retrieve({ userId: 'u1', query: 'rotina', locale: 'pt-BR', now: new Date('2026-07-14') });
  assert.equal(retrieved.memories.some((m: any) => m.canonicalKey === 'old.context'), false, 'expired memory excluded');
  assert.equal(retrieved.memories.some((m: any) => m.canonicalKey === 'en.fact'), false, 'different locale excluded');
  assert.equal(retrieved.hardGuards.targetIds.includes('t-1'), true, 'negative exact id is a hard guard');
  assert.equal(retrieved.authority, 'none');
  assert.match(service.formatForPrompt(retrieved), /PREFERENCIAS|PREFERENCES/);
  assert.match(service.formatForPrompt(retrieved), /BLOQUEIOS EXATOS|EXACT GUARDS/);

  for (let index = 0; index < 25; index += 1) {
    db.memories.push({ id: `bulk-${index}`, userId: 'u1', kind: 'context', scope: 'bulk', canonicalKey: `bulk.${index}`, content: `bulk ${index}`, structuredValue: {}, confidence: 0.7, salience: 1 - index / 100, lifecycle: 'active', locale: 'pt-BR', actionAuthority: 'none', negativeState: null, lastSeenAt: new Date() });
  }
  db.memories.push({ id: 'vector-outside-top20', userId: 'u1', kind: 'fact', scope: 'work', canonicalKey: 'work.vector-hit', content: 'semantic hit outside recent top twenty', structuredValue: {}, confidence: 0.9, salience: 0.01, lifecycle: 'active', locale: 'pt-BR', actionAuthority: 'none', negativeState: null, lastSeenAt: new Date() });
  await service.writeNegative({ userId: 'u1', canonicalKey: 'task:english-guard', targetType: 'timeline', targetId: 'en-target', state: 'rejected', content: 'Rejected in English', source: 'feedback', locale: 'en-US' });
  vectorResult = [{ memory_id: 'vector-outside-top20', similarity: 0.99 }];
  const vectorRetrieved = await service.retrieve({ userId: 'u1', query: 'semantic', locale: 'pt-BR', limit: 5 });
  assert.equal(vectorRetrieved.memories[0]?.id, 'vector-outside-top20');
  assert.equal(vectorRetrieved.hardGuards.targetIds.includes('en-target'), true, 'negative guards cross locale boundaries');

  for (let index = 0; index < 300; index += 1) {
    db.memories.push({
      id: `negative-${String(index).padStart(3, '0')}`,
      userId: 'u1', kind: 'context', scope: 'negative_action', canonicalKey: `task:guard-${index}`,
      content: `guard ${index}`, structuredValue: {}, confidence: 1, salience: 1,
      lifecycle: 'active', locale: 'pt-BR', actionAuthority: 'none', negativeState: 'completed',
      targetId: `target-${index}`, lastSeenAt: new Date(2026, 0, 1, 0, index),
    });
  }
  const allGuards = await service.retrieve({ userId: 'u1', query: 'guard', locale: 'pt-BR', limit: 5 });
  assert.equal(allGuards.hardGuards.targetIds.includes('target-299'), true,
    'hard guards remain complete beyond one 250-row database page');

  const concurrent = {
    ...base,
    kind: 'fact' as const,
    canonicalKey: 'work.concurrent-fact',
    content: 'A mesma verdade observada por duas fontes',
  };
  await Promise.all([
    service.write({ ...concurrent, sourceId: 'concurrent-1' }),
    service.write({ ...concurrent, sourceId: 'concurrent-2' }),
  ]);
  const activeConcurrent = db.memories.filter((memory) => memory.canonicalKey === 'work.concurrent-fact' && memory.lifecycle === 'active');
  assert.equal(activeConcurrent.length, 1, 'serializable concurrent writes leave one active winner');
  assert.equal(db.evidence.filter((item) => item.memoryId === activeConcurrent[0].id).length, 2, 'both concurrent evidence items are preserved on the winner');

  await service.write({ ...base, kind: 'fact', canonicalKey: 'life.current-state', content: 'Current state is new', sourceId: 'live-new', observedAt: new Date('2026-07-20') });
  const liveState = db.memories.find((memory) => memory.canonicalKey === 'life.current-state' && memory.lifecycle === 'active');
  liveState.structuredValue = { current: true };
  liveState.confidence = 0.97;
  liveState.salience = 0.88;
  liveState.validUntil = new Date('2026-09-01');
  const liveSnapshot = {
    lastSeenAt: new Date(liveState.lastSeenAt).toISOString(),
    structuredValue: { ...liveState.structuredValue },
    confidence: liveState.confidence,
    salience: liveState.salience,
    validUntil: new Date(liveState.validUntil).toISOString(),
  };
  await service.write({ ...base, kind: 'fact', canonicalKey: 'life.current-state', content: 'Old historical state', sourceId: 'backfill-old', observedAt: new Date('2026-07-01') });
  await service.write({ ...base, kind: 'fact', canonicalKey: 'life.current-state', content: 'Old historical state', sourceId: 'backfill-old', observedAt: new Date('2026-07-02'), structuredValue: { current: false }, confidence: 0.2, salience: 0.1, validUntil: new Date('2026-07-03') });
  await service.write({ ...base, kind: 'fact', canonicalKey: 'life.current-state', content: 'Another historical observation', sourceId: 'backfill-old-2', observedAt: new Date('2026-07-03'), structuredValue: { current: false }, confidence: 0.3, salience: 0.2 });
  await service.write({ ...base, kind: 'fact', canonicalKey: 'life.current-state', content: 'Current state is new', sourceId: 'backfill-same-content', observedAt: new Date('2026-07-04'), structuredValue: { current: false }, confidence: 0.1, salience: 0.05, validUntil: new Date('2026-07-05') });
  await service.write({ ...base, kind: 'fact', canonicalKey: 'life.current-state', content: 'Current state is new', sourceId: 'backfill-same-content', observedAt: new Date('2026-07-05'), structuredValue: { current: false }, confidence: 0.1, salience: 0.05, validUntil: new Date('2026-07-06') });
  const currentState = db.memories.find((memory) => memory.canonicalKey === 'life.current-state' && memory.lifecycle === 'active');
  assert.equal(currentState.content, 'Current state is new', 'old backfill evidence never supersedes a newer live state');
  assert.deepEqual({
    lastSeenAt: new Date(currentState.lastSeenAt).toISOString(),
    structuredValue: currentState.structuredValue,
    confidence: currentState.confidence,
    salience: currentState.salience,
    validUntil: new Date(currentState.validUntil).toISOString(),
  }, liveSnapshot, 'historical duplicate and later historical evidence never rewrite current metadata');
  assert.equal(db.evidence.some((item) => item.memoryId === currentState.id && item.statement === 'Old historical state'), true);
  assert.equal(db.evidence.filter((item) => item.memoryId === currentState.id && item.sourceId === 'backfill-old').length, 1, 'historical duplicate remains idempotent');
  assert.equal(db.evidence.some((item) => item.memoryId === currentState.id && item.sourceId === 'backfill-old-2'), true, 'new historical evidence is preserved');
  assert.equal(db.evidence.filter((item) => item.memoryId === currentState.id && item.sourceId === 'backfill-same-content').length, 1, 'same-content historical duplicate is idempotent without becoming current');
}

run().then(() => console.log('canonical-memory.service tests passed')).catch((error) => { console.error(error); process.exit(1); });
