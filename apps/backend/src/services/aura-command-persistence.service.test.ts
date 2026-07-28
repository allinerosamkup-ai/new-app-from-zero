import assert from 'node:assert/strict';

import { AuraCommandPersistenceService } from './aura-command-persistence.service';

async function main() {
  const operation = {
    id: '10000000-0000-4000-8000-000000000001',
    clientOperationId: 'task-1',
    type: 'create_planner_task',
    status: 'proposed',
    selected: true,
    payload: {
      title: 'Enviar proposta',
      date: '2026-07-29',
      startTime: '14:00',
      durationMinutes: 30,
      category: 'trabalho',
      checklist: [],
    },
  };
  const plan = {
    id: '20000000-0000-4000-8000-000000000001',
    userId: '30000000-0000-4000-8000-000000000001',
    status: 'proposed',
    operations: [operation],
  };
  const prisma: any = {
    auraCommandPlan: {
      findFirst: async ({ where }: any) =>
        where.id === plan.id && where.userId === plan.userId ? plan : null,
      update: async ({ data }: any) => Object.assign(plan, data),
    },
    auraCommandOperation: {
      update: async ({ data }: any) => Object.assign(operation, data),
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => callback(prisma),
  };

  const updated = await AuraCommandPersistenceService.updatePlan({
    prisma,
    userId: plan.userId,
    planId: plan.id,
    changes: [{
      id: 'task-1',
      payload: { ...operation.payload, startTime: '15:30' },
    }],
  });
  assert.equal((updated!.operations[0].payload as any).startTime, '15:30');

  await assert.rejects(
    () => AuraCommandPersistenceService.updatePlan({
      prisma,
      userId: plan.userId,
      planId: plan.id,
      changes: [{
        id: 'task-1',
        payload: { ...operation.payload, startTime: '99:00' },
      }],
    }),
    /validation|invalid|expected/i,
  );

  console.log('aura-command-persistence.service tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
