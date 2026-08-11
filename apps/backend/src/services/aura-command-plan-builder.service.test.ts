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
      action: 'record_checkin',
      payload: {
        moodScore: 3,
        energyScore: 3,
        clarityScore: null,
        irritabilityScore: null,
        physicalScore: null,
        socialScore: null,
        sleepScore: null,
        sleepHours: null,
        note: 'Estou chateada e cansada',
        emotions: ['sad', 'tired'],
        factors: [],
        source: 'aura_text',
        sourceMessageId: '550e8400-e29b-41d4-a716-446655440002',
        idempotencyKey: 'session-message-checkin-0001',
        rawText: 'Estou chateada e cansada',
        signalMetadata: {
          mood: { provenance: 'inferred', confidence: 0.92, evidence: ['chateada'] },
          energy: { provenance: 'inferred', confidence: 0.95, evidence: ['cansada'] },
        },
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
  assert.deepEqual(checkin.missingFields, []);
  assert.equal(checkin.executionPolicy, 'auto_apply');
  assert.equal(checkin.operations[0]?.type, 'record_checkin');
  if (checkin.operations[0]?.type === 'record_checkin') {
    assert.equal(checkin.operations[0].payload.clarityScore, null);
    assert.equal(checkin.operations[0].payload.source, 'aura_text');
  }

  const legacyCheckinAction = AuraCommandPlanBuilderService.build({
    response: {
      assistantMessage: 'Entendi o estado que você descreveu.',
      intent: 'checkin',
      action: 'log_checkin',
      payload: {
        moodScore: 3,
        energyScore: 7,
        focusScore: 4,
        note: 'Irritada, dormi mal e tenho praia com a Érica.',
        emotions: ['irritada'],
        factors: ['sono ruim', 'praia com a Érica'],
      },
      needsConfirmation: false,
      needsClarification: false,
      clarifyingQuestion: null,
    },
    userMessage: 'Estou irritada, dormi mal e tenho praia com a Érica.',
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    sourceMessageId: '550e8400-e29b-41d4-a716-446655440002',
    localDate: '2026-07-28',
    currentTime: '09:00',
    defaultCalendarId: 'primary',
    busyWindows: [],
    idFactory,
  });
  assert.equal(legacyCheckinAction.operations[0]?.type, 'record_checkin');
  if (legacyCheckinAction.operations[0]?.type === 'record_checkin') {
    assert.equal(legacyCheckinAction.operations[0].payload.clarityScore, 4);
    assert.deepEqual(legacyCheckinAction.operations[0].payload.factors, ['sono ruim', 'praia com a Érica']);
    assert.equal(legacyCheckinAction.operations[0].payload.source, 'aura_text');
  }

  const adaptiveTask = AuraCommandPlanBuilderService.build({
    response: {
      assistantMessage: 'Escolhi o melhor horário livre para amanhã.',
      intent: 'planner_task',
      action: 'create_task',
      payload: {
        title: 'Revisar o portfólio',
        date: '2026-07-29',
        autoScheduleRequested: true,
      },
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
  assert.equal(adaptiveTask.executionPolicy, 'auto_apply');

  const explicitGoal = AuraCommandPlanBuilderService.build({
    response: {
      assistantMessage: 'Vou adicionar a meta e o primeiro passo.',
      intent: 'goal_project',
      action: 'create_goal',
      payload: {
        title: 'Organizar meu portfólio profissional',
        subgoals: ['Reunir trabalhos atuais', 'Escolher os melhores trabalhos', 'Montar a primeira versão'],
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
  assert.equal(explicitGoal.operations[0]?.type, 'create_goal');
  assert.equal(explicitGoal.executionPolicy, 'auto_apply');

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
    assert.equal(goal.operations[0].payload.firstAction, null, 'objetivo não pode criar tarefa no Planner');
  }

  const broadGoal = AuraCommandPlanBuilderService.build({
    response: {
      assistantMessage: 'Guardei o objetivo e preciso de uma resposta para montar o caminho.',
      intent: 'goal_project', action: 'create_goal',
      payload: { title: 'Organizar minhas finanças', subgoals: [], question: 'O foco é dívida, controle do mês ou entender os gastos?' },
      needsConfirmation: false, needsClarification: false, clarifyingQuestion: null,
    },
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    sourceMessageId: '550e8400-e29b-41d4-a716-446655440002',
    localDate: '2026-07-28', currentTime: '09:00', defaultCalendarId: 'primary', busyWindows: [], idFactory,
  });
  assert.equal(broadGoal.operations[0]?.type, 'create_goal');
  if (broadGoal.operations[0]?.type === 'create_goal') {
    assert.equal(broadGoal.operations[0].payload.pathStatus, 'needs_answer');
    assert.match(broadGoal.operations[0].payload.pathQuestion ?? '', /dívida/);
    assert.deepEqual(broadGoal.operations[0].payload.subgoals, []);
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

  const postponed = AuraCommandPlanBuilderService.build({
    response: {
      assistantMessage: 'Adiei a proposta para amanhã.',
      intent: 'postpone',
      action: 'postpone_task',
      payload: {
        taskId: '660e8400-e29b-41d4-a716-446655440001',
        targetDate: '2026-07-29',
        reason: 'dia cheio',
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
  assert.equal(postponed.operations[0]?.type, 'postpone_timeline_task');
  assert.equal(postponed.executionPolicy, 'auto_apply');

  const started = AuraCommandPlanBuilderService.build({
    response: {
      assistantMessage: 'Começamos a proposta agora.',
      intent: 'start_task',
      action: 'start_task',
      payload: { taskId: '660e8400-e29b-41d4-a716-446655440001' },
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
  assert.equal(started.operations[0]?.type, 'start_timeline_task');
  assert.equal(started.executionPolicy, 'auto_apply');

  const adapted = AuraCommandPlanBuilderService.build({
    response: {
      assistantMessage: 'Ajustei o seu dia.',
      intent: 'adapt_agenda',
      action: 'adapt_agenda',
      payload: {},
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
  assert.equal(adapted.operations[0]?.type, 'adapt_agenda');
  assert.equal(adapted.executionPolicy, 'auto_apply');

  const opened = AuraCommandPlanBuilderService.build({
    response: {
      assistantMessage: 'Abrindo o check-in.',
      intent: 'navigate',
      action: 'open_screen',
      payload: { screen: 'checkin' },
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
  assert.equal(opened.operations[0]?.type, 'open_screen');
  assert.equal(opened.executionPolicy, 'auto_apply');
}

/**
 * A proposta de check-in que o diário monta precisa passar pelo construtor.
 *
 * Ela nunca passou. O diário sempre mandou `signalMetadata: { surface: 'journal' }`
 * e nunca mandou `assistantMessage`; os dois faziam o `parse` lançar dentro do
 * `catch` mudo do endpoint de streaming, então a proposta de check-in — e a de
 * meta, que vinha depois no mesmo laço — desapareciam sem log de erro e sem
 * nada na tela. Este teste é o que impede a regressão, porque o caminho real
 * engole a exceção por desenho.
 */
function journalProposalBuilds() {
  const plan = AuraCommandPlanBuilderService.build({
    response: {
      assistantMessage: 'Registro do que você contou, se quiser confirmar.',
      action: 'record_checkin',
      payload: {
        localDate: '2026-08-08',
        moodScore: 4,
        energyScore: 6,
        emotions: [],
        factors: [],
        source: 'aura_text',
        sourceMessageId: '550e8400-e29b-41d4-a716-446655440002',
        idempotencyKey: 'journal:session:message',
        rawText: 'hoje foi pesado',
        needsConfirmation: true,
        signalMetadata: { surface: 'journal' },
      },
    } as never,
    sessionId: '550e8400-e29b-41d4-a716-446655440001',
    sourceMessageId: '550e8400-e29b-41d4-a716-446655440002',
    localDate: '2026-08-08',
    currentTime: '09:00',
    defaultCalendarId: '',
    busyWindows: [],
    idFactory,
  });

  assert.equal(plan.operations[0]?.type, 'record_checkin');
  assert.deepEqual((plan.operations[0] as any).payload.signalMetadata, { surface: 'journal' });
  // A política de execução não é decidida aqui: o endpoint do diário fixa
  // `review_required` ao montar o plano final, porque superfície confessional
  // nunca aplica sozinha. O construtor só precisa entregar a operação.
}

run();
journalProposalBuilds();
console.log('aura-command-plan-builder.service tests passed');
