import assert from 'node:assert/strict';

import type { DailyContext } from './context-grounding.service';
import { ReasoningContextService } from './reasoning-context.service';

function baseContext(overrides: Partial<DailyContext> = {}): DailyContext {
  return {
    source: 'ContextGroundingService',
    date: '2026-05-07',
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
  const lowHabitTrace = ReasoningContextService.build({
    dailyContext: baseContext({
      pendingHabitTitles: ['Revisar rotina do sono'],
      todayAnchorTitles: ['Revisar rotina do sono'],
      habits: [{ id: 'habit-1', title: 'Revisar rotina do sono', frequency: 'daily', completions: [] }],
    }),
    surface: 'checkin',
    requestContext: { energyScore: 2, moodScore: 4, currentHour: 14, currentMinute: 20 },
    currentMessage: 'Estou bem sem energia hoje.',
  });
  assert.equal(lowHabitTrace.capacity, 'protecao');
  assert.equal(lowHabitTrace.decision.title, 'Revisar rotina do sono');
  assert.match(lowHabitTrace.why, /versão reduzida|reduzida|pausa|ritmo/i);

  const oldMemoryTrace = ReasoningContextService.build({
    dailyContext: baseContext({
      patternMemoryContext: 'Memória antiga: evita falar com clientes quando dorme mal.',
    }),
    surface: 'journal',
    requestContext: { currentHour: 10, currentMinute: 0 },
    ragContext: 'Memória antiga: evita falar com clientes quando dorme mal.',
  });
  assert.equal(oldMemoryTrace.decision.type, 'pergunta');
  assert.equal(oldMemoryTrace.confidence, 'baixa');
  assert.match(oldMemoryTrace.hypothesis, /pouca ancora operacional atual/i);

  const fabricatedDecisionTrace = ReasoningContextService.build({
    dailyContext: baseContext({ patternMemoryContext: 'Memória antiga sobre responder clientes.' }),
    surface: 'aura-chat',
    ragContext: 'Memória antiga sobre responder clientes.',
    decisionBrain: {
      surface: 'aura-chat',
      date: '2026-05-07',
      allowedActions: [{
        id: 'memory:reply',
        title: 'Responder cliente',
        kind: 'suggested_commitment',
        source: 'memory',
        targetType: 'system',
        action: 'suggest',
        score: 90,
        confidence: 0.95,
        reason: 'A memória sugere isso.',
        notificationAllowed: false,
        requiresConfirmation: true,
      }],
      blockedActions: [],
      dayPriorities: ['Responder cliente'],
      reasoning: 'Memória antiga.',
      confidence: 0.95,
      emptyReason: null,
    },
  });
  assert.equal(fabricatedDecisionTrace.decision.type, 'pergunta');
  assert.equal(fabricatedDecisionTrace.decision.targetId, null);
  assert.equal(fabricatedDecisionTrace.confidence, 'baixa');

  const goalTrace = ReasoningContextService.build({
    dailyContext: baseContext({
      activeGoalTitles: ['Finalizar proposta comercial'],
      todayAnchorTitles: ['Finalizar proposta comercial'],
      goals: [{ id: 'goal-1', title: 'Finalizar proposta comercial', progress: 40, subgoals: [] }],
    }),
    surface: 'home',
    requestContext: { energyScore: 8, moodScore: 7, phase: 'voo alto', currentHour: 9, currentMinute: 30 },
    currentMessage: 'Hoje acordei com mais clareza.',
  });
  assert.equal(goalTrace.capacity, 'alta');
  assert.equal(goalTrace.decision.title, 'Finalizar proposta comercial');
  assert.equal(goalTrace.decision.targetId, 'goal-1');
  assert.equal(goalTrace.decision.action, 'suggest');

  const blockedTrace = ReasoningContextService.build({
    dailyContext: baseContext({
      pendingTaskTitles: ['Enviar orçamento'],
      completedTaskTitles: ['Enviar orçamento'],
      blockedActionTitles: ['Enviar orçamento'],
      todayAnchorTitles: ['Enviar orçamento'],
      tasks: [{ id: 'task-1', title: 'Enviar orçamento', status: 'completed' }],
    }),
    surface: 'aura-chat',
    requestContext: { currentHour: 11, currentMinute: 0 },
    currentMessage: 'O que eu faço agora?',
  });
  assert.equal(blockedTrace.decision.type, 'pergunta');
  assert.match(blockedTrace.evidence.join('\n'), /Bloqueios\/repeticoes/i);

  const lateTrace = ReasoningContextService.build({
    dailyContext: baseContext({
      activeGoalTitles: ['Estudar documentação técnica'],
      todayAnchorTitles: ['Estudar documentação técnica'],
      goals: [{ id: 'goal-2', title: 'Estudar documentação técnica', progress: 10, subgoals: [] }],
    }),
    surface: 'planner',
    requestContext: { energyScore: 4, currentHour: 22, currentMinute: 30 },
    currentMessage: 'Ainda quero fazer algo hoje.',
  });
  assert.notEqual(lateTrace.decision.type, 'acao');
  assert.match(ReasoningContextService.formatForPrompt(lateTrace), /Horario local: 22:30/);
  assert.match(ReasoningContextService.formatForPrompt(lateTrace), /Nao cite ReasoningTrace/);
}

run()
  .then(() => {
    console.log('reasoning-context.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
