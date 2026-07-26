import assert from 'node:assert/strict';

import { AdaptiveAgendaEngine, buildDayStructureProfile } from './adaptive-agenda-engine.service';
import type { DailyContext } from './context-grounding.service';

const emptyAgendaWithGoal: DailyContext = {
  source: 'ContextGroundingService',
  date: '2026-04-30',
  pendingTaskTitles: [],
  completedTaskTitles: [],
  pendingHabitTitles: [],
  completedHabitTitles: [],
  activeGoalTitles: ['Enviar proposta para investidor'],
  completedGoalTitles: [],
  completedSubgoalTitles: [],
  recentSuggestionTitles: [],
  blockedActionTitles: [],
  todayAnchorTitles: ['Enviar proposta para investidor'],
  tasks: [],
  habits: [],
  goals: [],
  actionFeedback: [],
  patternMemoryContext: '',
  operationalRule: 'Contexto antigo explica padrão; ação do dia precisa de âncora operacional atual.',
};

function at(time: string): Date {
  return new Date(`2026-04-30T${time}:00.000Z`);
}

{
  const profile = buildDayStructureProfile({
    ...emptyAgendaWithGoal,
    tasks: [
      {
        id: 'gcal-1',
        title: 'Reunião externa',
        status: 'planned',
        startAt: at('09:00'),
        endAt: at('11:00'),
        gcalEventId: 'google-1',
        temporalPolicy: 'flexible',
        adaptationPermission: 'eligible',
      },
      {
        id: 'flex-1',
        title: 'Escrever proposta',
        status: 'planned',
        startAt: at('10:00'),
        endAt: at('12:00'),
        temporalPolicy: 'flexible',
        adaptationPermission: 'eligible',
      },
    ],
  });

  assert.equal(profile.scheduledMinutes, 180, 'overlapping blocks count once');
  assert.equal(profile.protectedMinutes, 120, 'Google Calendar is always protected');
  assert.equal(profile.flexibleMinutes, 60, 'protected time wins over flexible overlap');
  assert.equal(profile.freeMinutes, 540);
  assert.equal(profile.mode, 'open');
  assert.equal(profile.initiativeLevel, 'lead');
  assert.deepEqual(profile.protectedAnchors.map((anchor) => anchor.id), ['gcal-1']);
}

{
  const open = buildDayStructureProfile(emptyAgendaWithGoal);
  assert.equal(open.freedomScore, 100);
  assert.equal(open.mode, 'open');
  assert.equal(open.initiativeLevel, 'lead');

  const structured = buildDayStructureProfile({
    ...emptyAgendaWithGoal,
    tasks: [{
      id: 'fixed-day',
      title: 'Expediente',
      status: 'planned',
      startAt: at('08:00'),
      endAt: at('17:00'),
      temporalPolicy: 'fixed',
      adaptationPermission: 'protected',
    }],
  });
  assert.equal(structured.freedomScore, 25);
  assert.equal(structured.mode, 'structured');
  assert.equal(structured.initiativeLevel, 'protect');
}

{
  const expanded = buildDayStructureProfile({
    ...emptyAgendaWithGoal,
    tasks: [{
      id: 'late-anchor',
      title: 'Plantão noturno',
      status: 'planned',
      startAt: at('23:00'),
      endAt: new Date('2026-05-01T01:00:00.000Z'),
      temporalPolicy: 'fixed',
      adaptationPermission: 'protected',
    }, {
      id: 'early-flex',
      title: 'Preparar material',
      status: 'planned',
      startAt: at('06:30'),
      endAt: at('07:00'),
      temporalPolicy: 'flexible',
      adaptationPermission: 'eligible',
    }],
  });
  assert.equal(expanded.scheduledMinutes, 150, 'includes early and cross-midnight commitments');
  assert.equal(expanded.protectedMinutes, 120);
  assert.equal(expanded.protectedAnchors[0]?.endTime, '01:00 (+1)');
}

{
  const fixedTask = (id: string, startAt: Date, endAt: Date) => ({
    id,
    title: id,
    status: 'planned',
    startAt,
    endAt,
    temporalPolicy: 'fixed' as const,
    adaptationPermission: 'protected' as const,
  });
  const daytime = buildDayStructureProfile({
    ...emptyAgendaWithGoal,
    tasks: [fixedTask('turno-dia', at('08:00'), at('16:00'))],
  });
  const nighttime = buildDayStructureProfile({
    ...emptyAgendaWithGoal,
    tasks: [fixedTask('turno-noite', at('23:00'), new Date('2026-05-01T07:00:00.000Z'))],
  });
  assert.equal(daytime.scheduledMinutes, 480);
  assert.equal(nighttime.scheduledMinutes, 480);
  assert.equal(daytime.freedomScore, nighttime.freedomScore);
  assert.equal(daytime.initiativeLevel, nighttime.initiativeLevel);

  const overlap = buildDayStructureProfile({
    ...emptyAgendaWithGoal,
    tasks: [
      fixedTask('turno-noite', at('23:00'), new Date('2026-05-01T07:00:00.000Z')),
      {
        id: 'flex-overlap',
        title: 'Bloco sobreposto',
        status: 'planned',
        startAt: at('06:00'),
        endAt: at('09:00'),
        temporalPolicy: 'flexible',
        adaptationPermission: 'eligible',
      },
    ],
  });
  assert.equal(overlap.protectedMinutes, 480);
  assert.equal(overlap.flexibleMinutes, 120, 'protected time wins the overlapping hour');
  assert.equal(overlap.scheduledMinutes, 600, 'union is deduplicated');
  assert.equal(overlap.freeMinutes, 120);

  const allDay = buildDayStructureProfile({
    ...emptyAgendaWithGoal,
    tasks: [fixedTask('all-day', at('00:00'), new Date('2026-05-01T00:00:00.000Z'))],
  });
  assert.equal(allDay.scheduledMinutes, 720);
  assert.equal(allDay.protectedMinutes, 720);
  assert.equal(allDay.freeMinutes, 0);
  assert.equal(allDay.freedomScore, 0);

  const overCapacity = buildDayStructureProfile({
    ...emptyAgendaWithGoal,
    tasks: [
      fixedTask('protected-10h', at('00:00'), at('10:00')),
      {
        id: 'flexible-4h',
        title: 'Bloco flexível longo',
        status: 'planned',
        startAt: at('12:00'),
        endAt: at('16:00'),
        temporalPolicy: 'flexible',
        adaptationPermission: 'eligible',
      },
    ],
  });
  assert.equal(overCapacity.protectedMinutes, 600);
  assert.equal(overCapacity.flexibleMinutes, 120);
  assert.equal(overCapacity.scheduledMinutes, 720);
  assert.equal(overCapacity.freeMinutes, 0);
  assert.equal(overCapacity.protectedMinutes + overCapacity.flexibleMinutes, 720);
}

{
  const plan = AdaptiveAgendaEngine.plan({
    dailyContext: emptyAgendaWithGoal,
    trigger: 'manual',
    surface: 'planner',
    requestContext: { phase: 'Fluindo', currentHour: 11, currentMinute: 0 },
  });

  assert.equal(plan.decisions[0]?.type, 'suggest');
  assert.equal(plan.decisions[0]?.targetType, 'goal');
  // Phase-aware: at 11:00 in Fluindo, a 60-min task would end at 12:15 (past the 12:00 peak boundary).
  // The algorithm correctly picks the next peak window starting at 15:00.
  assert.equal(plan.decisions[0]?.suggestedStartTime, '15:00');
  assert.equal(plan.decisions[0]?.suggestedEndTime, '16:00');
  assert.equal(plan.decisions[0]?.impactLabel, 'aproveita janela');
  assert.match(plan.decisions[0]?.bioReason ?? '', /janela boa|meta ativa/);
  assert.equal(plan.decisions[0]?.kind, 'suggested_commitment');
  assert.equal(plan.decisions[0]?.requiresConfirmation, false);
  assert.equal(plan.decisions[0]?.notificationAllowed, false);
  assert.equal(plan.dayStructure.mode, 'open');
  assert.match(plan.summary, /mais iniciativa|toma a frente/i);
}

{
  const goals = ['A', 'B', 'C', 'D', 'E'];
  const leadPlan = AdaptiveAgendaEngine.plan({
    dailyContext: {
      ...emptyAgendaWithGoal,
      activeGoalTitles: goals,
      todayAnchorTitles: goals,
    },
    requestContext: { currentHour: 8, currentMinute: 0 },
  });
  assert.equal(leadPlan.decisions.length, 4, 'lead mode can surface four real actionable changes');
  assert.ok(leadPlan.decisions.every((decision) => goals.includes(decision.title)), 'never invents a title');
  assert.deepEqual(
    leadPlan.decisions.map((decision) => decision.score),
    [...leadPlan.decisions].map((decision) => decision.score).sort((a, b) => b - a),
    'highest-confidence actionable changes come first',
  );

  const mixedPlan = AdaptiveAgendaEngine.plan({
    dailyContext: {
      ...emptyAgendaWithGoal,
      activeGoalTitles: goals,
      todayAnchorTitles: goals,
      tasks: [{
        id: 'fixed-morning',
        title: 'Aula fixa',
        status: 'planned',
        startAt: at('08:00'),
        endAt: at('12:00'),
        temporalPolicy: 'fixed',
        adaptationPermission: 'protected',
      }],
    },
    requestContext: { currentHour: 8, currentMinute: 0 },
  });
  assert.equal(mixedPlan.dayStructure.mode, 'mixed');
  assert.equal(mixedPlan.decisions.length, 3, 'mixed mode caps only actionable changes at three');
  assert.ok(mixedPlan.decisions.every((decision) => decision.title !== 'Aula fixa'));

  const protectedTasks = [{
    id: 'fixed-0',
    title: 'Expediente protegido',
    status: 'planned',
    startAt: at('08:00'),
    endAt: at('17:00'),
    temporalPolicy: 'fixed' as const,
    adaptationPermission: 'protected' as const,
  }, {
    id: 'flexible-overdue',
    title: 'Rascunho flexível atrasado',
    status: 'planned',
    startAt: at('07:00'),
    endAt: at('07:30'),
    temporalPolicy: 'flexible' as const,
    adaptationPermission: 'eligible' as const,
  }];
  const protectPlan = AdaptiveAgendaEngine.plan({
    dailyContext: {
      ...emptyAgendaWithGoal,
      activeGoalTitles: goals,
      todayAnchorTitles: goals,
      tasks: protectedTasks,
    },
    requestContext: { currentHour: 9, currentMinute: 0 },
  });
  assert.equal(protectPlan.decisions.length, 2, 'protect mode limits actionable changes to two');
  assert.ok(protectPlan.decisions.every((decision) => decision.title !== 'Expediente protegido'));
  assert.ok(protectPlan.decisions.some((decision) => decision.targetId === 'flexible-overdue'));
  assert.match(protectPlan.summary, /protege.*âncora/i);
}

{
  const plan = AdaptiveAgendaEngine.plan({
    dailyContext: {
      ...emptyAgendaWithGoal,
      activeGoalTitles: [],
      todayAnchorTitles: [],
      recentSuggestionTitles: ['Enviar proposta para investidor'],
    },
    trigger: 'home',
    surface: 'home',
  });

  assert.deepEqual(plan.decisions, []);
  assert.match(plan.summary, /não encontrou ajuste confiável/i);
}

console.log('adaptive-agenda-engine.service tests passed');
