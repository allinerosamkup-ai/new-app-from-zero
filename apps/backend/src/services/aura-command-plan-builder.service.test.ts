import assert from 'node:assert/strict';

import { AuraCommandPlanBuilderService } from './aura-command-plan-builder.service';

const ids = [
  '550e8400-e29b-41d4-a716-446655440010',
  '550e8400-e29b-41d4-a716-446655440011',
  '550e8400-e29b-41d4-a716-446655440012',
  '550e8400-e29b-41d4-a716-446655440013',
];

function idFactory() {
  return ids.shift() ?? '550e8400-e29b-41d4-a716-446655440099';
}

function run() {
  const checklist = AuraCommandPlanBuilderService.build({
    response: {
      assistantMessage: 'Preparei sua checklist.',
      intent: 'checklist',
      action: 'create_checklist',
      payload: { title: 'Viagem', items: ['Passaporte', 'Carregador'] },
      needsConfirmation: false,
      needsClarification: false,
      clarifyingQuestion: null,
    },
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    sourceMessageId: '550e8400-e29b-41d4-a716-446655440002',
    localDate: '2026-07-28',
    currentTime: '09:00',
    defaultCalendarId: 'primary',
    busyWindows: [],
    idFactory,
  });
  assert.equal(checklist.operations[0]?.type, 'create_capture');
  assert.equal(checklist.executionPolicy, 'auto_apply');

  const appointment = AuraCommandPlanBuilderService.build({
    response: {
      assistantMessage: 'Encontrei o melhor horário.',
      intent: 'calendar_event',
      action: 'create_calendar_event',
      payload: { title: 'Dentista', date: '2026-07-29', durationMinutes: 60 },
      needsConfirmation: true,
      needsClarification: false,
      clarifyingQuestion: null,
    },
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    sourceMessageId: '550e8400-e29b-41d4-a716-446655440002',
    localDate: '2026-07-28',
    currentTime: '09:00',
    phase: 'fluindo',
    energyScore: 7,
    moodScore: 7,
    defaultCalendarId: 'trabalho@example.com',
    busyWindows: [{ startTime: '09:00', endTime: '10:00', fixed: true }],
    idFactory,
  });
  assert.equal(appointment.operations[0]?.type, 'create_calendar_event');
  if (appointment.operations[0]?.type === 'create_calendar_event') {
    assert.equal(appointment.operations[0].payload.calendarId, 'trabalho@example.com');
    assert.equal(appointment.operations[0].payload.startTime, '10:00');
  }
  assert.equal(appointment.executionPolicy, 'review_required');

  const checkin = AuraCommandPlanBuilderService.build({
    response: {
      assistantMessage: 'Registrei os sinais que você informou.',
      intent: 'checkin',
      action: 'create_checkin',
      payload: { moodScore: 7, energyScore: 6, clarityScore: 8, irritabilityScore: null },
      needsConfirmation: false,
      needsClarification: false,
      clarifyingQuestion: null,
    },
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    sourceMessageId: '550e8400-e29b-41d4-a716-446655440002',
    localDate: '2026-07-28',
    currentTime: '09:00',
    defaultCalendarId: 'primary',
    busyWindows: [],
    idFactory,
  });
  assert.deepEqual(checkin.missingFields, []);
  assert.equal(checkin.executionPolicy, 'auto_apply');

  const adaptiveTask = AuraCommandPlanBuilderService.build({
    response: {
      assistantMessage: 'Escolhi o melhor horário livre para amanhã.',
      intent: 'planner_task',
      action: 'create_task',
      payload: { title: 'Revisar o portfólio', date: '2026-07-29' },
      needsConfirmation: false,
      needsClarification: false,
      clarifyingQuestion: null,
    },
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    sourceMessageId: '550e8400-e29b-41d4-a716-446655440002',
    localDate: '2026-07-28',
    currentTime: '09:00',
    phase: 'recolhimento',
    energyScore: 2,
    moodScore: 2,
    defaultCalendarId: 'primary',
    busyWindows: [{ startTime: '09:00', endTime: '10:00', fixed: true }],
    idFactory,
  });
  assert.equal(adaptiveTask.operations[0]?.type, 'create_planner_task');
  if (adaptiveTask.operations[0]?.type === 'create_planner_task') {
    assert.equal(adaptiveTask.operations[0].payload.startTime, '11:00');
  }

  const goal = AuraCommandPlanBuilderService.build({
    response: {
      assistantMessage: 'Quebrei a meta e separei o primeiro passo.',
      intent: 'goal_project',
      action: 'create_goal',
      payload: { title: 'Publicar meu curso', subgoals: ['Definir promessa', 'Montar módulo 1', 'Gravar aula piloto'] },
      needsConfirmation: true,
      needsClarification: false,
      clarifyingQuestion: null,
    },
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    sourceMessageId: '550e8400-e29b-41d4-a716-446655440002',
    localDate: '2026-07-28',
    currentTime: '09:00',
    defaultCalendarId: 'primary',
    busyWindows: [{ startTime: '09:00', endTime: '10:00' }],
    idFactory,
  });
  assert.equal(goal.operations[0]?.type, 'create_goal');
  if (goal.operations[0]?.type === 'create_goal') {
    assert.equal(goal.operations[0].payload.firstAction?.title, 'Definir promessa');
    assert.equal(goal.operations[0].payload.firstAction?.startTime, '10:00');
  }

  const completed = AuraCommandPlanBuilderService.build({
    response: {
      assistantMessage: 'Registrei o que você concluiu.',
      intent: 'complete_items',
      action: 'complete_items',
      payload: {
        items: [{
          title: 'Enviar proposta',
          type: 'task',
          targetId: '660e8400-e29b-41d4-a716-446655440001',
          targetType: 'timeline',
        }],
      },
      needsConfirmation: false,
      needsClarification: false,
      clarifyingQuestion: null,
    },
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    sourceMessageId: '550e8400-e29b-41d4-a716-446655440002',
    localDate: '2026-07-28',
    currentTime: '09:00',
    defaultCalendarId: 'primary',
    busyWindows: [],
    idFactory,
  });
  assert.equal(completed.operations[0]?.type, 'complete_item');
  assert.equal(completed.executionPolicy, 'auto_apply');
}

run();
console.log('aura-command-plan-builder.service tests passed');
