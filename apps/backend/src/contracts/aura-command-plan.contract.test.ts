import assert from 'node:assert/strict';

import {
  AuraCommandPlanSchema,
  AuraCommandPlanApplySchema,
  AuraCommandPlanPatchSchema,
  AuraCommandOperationSchema,
} from './aura-command-plan.contract';

function run() {
  const task = AuraCommandOperationSchema.parse({
    id: 'task-1',
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
  });
  assert.equal(task.type, 'create_planner_task');

  const mixedPlan = AuraCommandPlanSchema.parse({
    id: '550e8400-e29b-41d4-a716-446655440000',
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    sourceMessageId: '550e8400-e29b-41d4-a716-446655440002',
    status: 'proposed',
    executionPolicy: 'review_required',
    confidence: 0.92,
    assistantMessage: 'Organizei três ações para você revisar.',
    missingFields: [],
    operations: [
      task,
      {
        id: 'capture-1',
        type: 'create_capture',
        status: 'proposed',
        selected: true,
        payload: {
          kind: 'note',
          title: 'Endereço do dentista',
          content: 'Rua das Flores, 20',
          items: [],
        },
      },
      {
        id: 'checkin-1',
        type: 'record_checkin',
        status: 'proposed',
        selected: true,
        payload: {
          localDate: '2026-07-28',
          moodScore: 3,
          energyScore: 2,
          clarityScore: null,
          irritabilityScore: 7,
          note: 'Cansada e irritada.',
          source: 'aura_text',
          sourceMessageId: 'message-1',
          idempotencyKey: 'session-1:message-1',
          rawText: 'Cansada e irritada.',
          signalMetadata: {
            mood: { provenance: 'inferred', confidence: 0.8, evidence: ['irritada'] },
            energy: { provenance: 'inferred', confidence: 0.9, evidence: ['cansada'] },
          },
        },
      },
    ],
  });

  assert.equal(mixedPlan.operations.length, 3);
  assert.equal(mixedPlan.executionPolicy, 'review_required');
  assert.equal(mixedPlan.operations[2].type, 'record_checkin');

  assert.throws(() => AuraCommandOperationSchema.parse({
    id: 'unsafe',
    type: 'create_calendar_event',
    status: 'proposed',
    selected: true,
    payload: {
      title: 'Dentista',
      date: '2026-07-29',
      startTime: '10:00',
      durationMinutes: 60,
    },
  }), /calendarId/i);

  const apply = AuraCommandPlanApplySchema.parse({
    operationIds: ['task-1', 'capture-1'],
    idempotencyKey: 'plan-1-apply-1',
  });
  assert.deepEqual(apply.operationIds, ['task-1', 'capture-1']);

  const patch = AuraCommandPlanPatchSchema.parse({
    operations: [{
      id: 'task-1',
      selected: true,
      payload: {
        title: 'Enviar proposta revisada',
        date: '2026-07-29',
        startTime: '15:00',
        durationMinutes: 30,
        category: 'trabalho',
        checklist: [],
      },
    }],
  });
  assert.equal(patch.operations[0].id, 'task-1');
}

run();
console.log('aura-command-plan.contract tests passed');
