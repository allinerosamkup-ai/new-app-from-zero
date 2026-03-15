import assert from 'node:assert/strict';

import { PlannerSyncSchema } from './planner.contract';

const validPayload = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  date: '2026-03-13',
  forceSave: false,
  blocks: [
    {
      startTime: '09:00',
      endTime: '10:00',
      title: 'Foco leve',
      category: 'trabalho',
      intensity: 'M',
      status: 'planned',
    },
  ],
};

{
  const result = PlannerSyncSchema.safeParse({
    date: validPayload.date,
    blocks: validPayload.blocks,
  });

  assert.equal(result.success, false);
}

{
  const result = PlannerSyncSchema.safeParse(validPayload);

  assert.equal(result.success, true);
}

console.log('planner.contract tests passed');
