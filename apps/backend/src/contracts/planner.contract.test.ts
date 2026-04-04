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

{
  const result = PlannerSyncSchema.safeParse({
    ...validPayload,
    blocks: [
      {
        ...validPayload.blocks[0],
        category: 'geral',
        intensity: 'media',
      },
    ],
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.blocks[0].category, 'pessoal');
    assert.equal(result.data.blocks[0].intensity, 'M');
  }
}

console.log('planner.contract tests passed');
