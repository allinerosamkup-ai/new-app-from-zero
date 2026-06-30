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

{
  const result = PlannerSyncSchema.safeParse({
    ...validPayload,
    blocks: [
      { ...validPayload.blocks[0], category: 'casa' },
      { ...validPayload.blocks[0], category: 'lazer' },
      { ...validPayload.blocks[0], category: 'planning' },
      { ...validPayload.blocks[0], category: 'self-care' },
    ],
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(
      result.data.blocks.map((block) => block.category),
      ['casa', 'pessoal', 'pessoal', 'autocuidado'],
    );
  }
}

{
  const result = PlannerSyncSchema.safeParse({
    ...validPayload,
    blocks: [
      {
        ...validPayload.blocks[0],
        noteMode: 'checklist',
        note: 'Separar documentos antes de sair.',
        checklist: [
          { id: 'item-1', text: 'Pegar documento', done: false },
          { id: 'item-2', text: 'Confirmar endereco', done: true },
        ],
        recurring: {
          enabled: true,
          frequency: 'weekly',
          days: [0, 2, 4],
          everyNDays: 1,
        },
        energyLevel: 'leve',
        lastResetDate: '2026-04-12',
        persistentReminderEnabled: true,
        persistentReminderIntervalMinutes: 60,
        isAiSuggested: true,
        aiReasoning: 'Sugerido pela Airia.',
      },
    ],
  });

  assert.equal(result.success, true);
  if (result.success) {
    const block = result.data.blocks[0];
    assert.equal(block.noteMode, 'checklist');
    assert.equal(block.note, 'Separar documentos antes de sair.');
    assert.equal(block.checklist?.[1]?.done, true);
    assert.equal(block.recurring?.frequency, 'weekly');
    assert.equal(block.energyLevel, 'leve');
    assert.equal(block.lastResetDate, '2026-04-12');
    assert.equal(block.persistentReminderEnabled, true);
    assert.equal(block.persistentReminderIntervalMinutes, 60);
    assert.equal(block.isAiSuggested, true);
    assert.equal(block.aiReasoning, 'Sugerido pela Airia.');
  }
}

{
  const result = PlannerSyncSchema.safeParse({
    ...validPayload,
    blocks: [
      {
        ...validPayload.blocks[0],
        noteMode: 'audio',
        checklist: [{ id: 'item-1', text: '', done: false }],
        recurring: { enabled: true, frequency: 'monthly', days: [9], everyNDays: 0 },
        energyLevel: 'exaurida',
        lastResetDate: '12/04/2026',
      },
    ],
  });

  assert.equal(result.success, false);
}

console.log('planner.contract tests passed');
