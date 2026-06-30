import assert from 'node:assert/strict';

import type { DailyContext } from './context-grounding.service';
import { AiriaOperationalReasoningService } from './airia-operational-reasoning.service';

function baseContext(overrides: Partial<DailyContext> = {}): DailyContext {
  return {
    source: 'ContextGroundingService',
    date: '2026-05-08',
    pendingTaskTitles: [],
    completedTaskTitles: [],
    pendingHabitTitles: [],
    completedHabitTitles: [],
    activeGoalTitles: [],
    completedGoalTitles: [],
    completedSubgoalTitles: [],
    recentSuggestionTitles: [],
    blockedActionTitles: [],
    todayAnchorTitles: [],
    tasks: [],
    habits: [],
    goals: [],
    healthSignals: null,
    actionFeedback: [],
    postponedActions: [],
    patternMemoryContext: '',
    operationalRule: 'Contexto antigo explica padrão; ação do dia precisa de âncora operacional atual.',
    ...overrides,
  };
}

async function run() {
  const lowHabitPlan = AiriaOperationalReasoningService.build({
    dailyContext: baseContext({
      pendingHabitTitles: ['Revisar rotina do sono'],
      todayAnchorTitles: ['Revisar rotina do sono'],
      habits: [{ id: 'habit-1', title: 'Revisar rotina do sono', frequency: 'daily', completions: [] }],
    }),
    surface: 'checkin',
    requestContext: { energyScore: 2, moodScore: 4, currentHour: 14, currentMinute: 20 },
    currentMessage: 'Estou sem energia.',
  });
  assert.equal(lowHabitPlan.reading.capacity, 'protecao');
  assert.equal(lowHabitPlan.decision.type, 'act');
  assert.match(AiriaOperationalReasoningService.visibleSuggestion(lowHabitPlan), /versão mínima|pausar/i);
  assert.doesNotMatch(AiriaOperationalReasoningService.visibleSuggestion(lowHabitPlan), /anot|escrev|registr/i);

  const oldMemoryPlan = AiriaOperationalReasoningService.build({
    dailyContext: baseContext({
      patternMemoryContext: 'Memória antiga: evita falar com clientes quando dorme mal.',
    }),
    surface: 'home',
    requestContext: { currentHour: 10, currentMinute: 0 },
    ragContext: 'Memória antiga: evita falar com clientes quando dorme mal.',
  });
  assert.equal(oldMemoryPlan.decision.type, 'ask_anchor');
  assert.match(AiriaOperationalReasoningService.visibleSuggestion(oldMemoryPlan), /coisa real de hoje/i);

  const goalPlan = AiriaOperationalReasoningService.build({
    dailyContext: baseContext({
      activeGoalTitles: ['Finalizar proposta comercial'],
      todayAnchorTitles: ['Finalizar proposta comercial'],
      goals: [{ id: 'goal-1', title: 'Finalizar proposta comercial', progress: 40, subgoals: [] }],
    }),
    surface: 'home',
    requestContext: { energyScore: 8, moodScore: 7, phase: 'voo alto', currentHour: 9, currentMinute: 30 },
    currentMessage: 'Hoje acordei com clareza.',
  });
  assert.equal(goalPlan.decision.type, 'act');
  assert.equal(goalPlan.action?.targetId, 'goal-1');
  assert.match(goalPlan.action?.displayText ?? '', /Finalizar proposta comercial/i);
  assert.match(goalPlan.reading.pattern, /meta ativa/i);

  const lateGoalPlan = AiriaOperationalReasoningService.build({
    dailyContext: baseContext({
      activeGoalTitles: ['Estudar documentação técnica'],
      todayAnchorTitles: ['Estudar documentação técnica'],
      goals: [{ id: 'goal-2', title: 'Estudar documentação técnica', progress: 10, subgoals: [] }],
    }),
    surface: 'checkin',
    requestContext: { energyScore: 4, currentHour: 22, currentMinute: 30 },
    currentMessage: 'Ainda quero fazer algo hoje.',
  });
  assert.equal(lateGoalPlan.decision.type, 'ask_anchor');
  assert.doesNotMatch(AiriaOperationalReasoningService.visibleSuggestion(lateGoalPlan), /22:30|Estudar documentação/i);

  const promptBlock = AiriaOperationalReasoningService.formatForPrompt(goalPlan);
  assert.match(promptBlock, /PLANO OPERACIONAL DA AIRIA/i);
  assert.match(promptBlock, /Acao principal validada/i);
  assert.doesNotMatch(promptBlock, /Aliança Divergente|Pense Comigo|Efeito Paralelo/i);
}

run()
  .then(() => {
    console.log('airia-operational-reasoning.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
