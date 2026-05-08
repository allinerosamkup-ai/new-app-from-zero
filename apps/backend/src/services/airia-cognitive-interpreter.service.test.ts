import assert from 'node:assert/strict';

import type { DailyContext } from './context-grounding.service';
import { AiriaCognitiveInterpreterService } from './airia-cognitive-interpreter.service';
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
  const context = baseContext({
    pendingTaskTitles: ['Separar caixas da mudança'],
    activeGoalTitles: ['Concluir mudança sem virar a noite'],
    todayAnchorTitles: ['Separar caixas da mudança', 'Concluir mudança sem virar a noite'],
    tasks: [{
      id: 'task-1',
      title: 'Separar caixas da mudança',
      status: 'planned',
      startAt: new Date('2026-05-08T10:00:00.000Z'),
      endAt: new Date('2026-05-08T11:00:00.000Z'),
      category: 'casa',
      intensity: 'M',
    }],
    goals: [{ id: 'goal-1', title: 'Concluir mudança sem virar a noite', progress: 30, subgoals: [] }],
  });
  const actionPlan = AiriaOperationalReasoningService.build({
    dailyContext: context,
    surface: 'home',
    requestContext: { currentHour: 9, currentMinute: 30, energyScore: 7, moodScore: 6 },
    currentMessage: 'Estou ansiosa com a mudança e quero fechar uma parte.',
  });

  const result = await AiriaCognitiveInterpreterService.interpret({
    surface: 'home',
    dailyContext: context,
    currentMessage: 'Estou ansiosa com a mudança e quero fechar uma parte.',
    ragContext: 'Memória antiga: quando tenta resolver tudo, perde energia. Memória irrelevante: conversa sobre treino antigo.',
    actionPlan,
  }, {
    chat: {
      completions: {
        create: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                frame: {
                  currentFact: 'Ela quer fechar uma parte da mudança hoje.',
                  userInterpretation: 'A ansiedade está puxando para resolver tudo.',
                  emotionalSignal: 'Ansiedade com urgência.',
                  intent: 'home_guidance',
                  decisionInPlay: 'Escolher uma frente concreta da mudança.',
                  moodCycleReading: 'Energia suficiente pede foco com limite.',
                  relevantEvidence: ['Mudança mencionada no relato', 'Agenda tem separar caixas'],
                  memoryJudgments: [
                    { memory: 'quando tenta resolver tudo, perde energia', status: 'accepted', reason: 'Conecta com ansiedade e excesso de frente.' },
                    { memory: 'conversa sobre treino antigo', status: 'rejected', reason: 'Não se conecta com mudança.' },
                  ],
                  riskOfBadResponse: ['Sugerir cuidado solto', 'Mandar escrever lista'],
                  confidence: 'alta',
                },
                responsePlan: {
                  responseMode: 'explicar',
                  tone: 'doce',
                  oneSentenceReading: 'A ansiedade está tentando abrir tudo, mas o caminho bom é fechar uma frente.',
                  finalMove: 'Separar caixas da mudança como próximo bloco real do dia.',
                  mustMention: ['mudança', 'separar caixas'],
                  mustAvoid: ['escrever lista', 'respirar'],
                  allowedActionSource: 'agenda',
                },
              }),
            },
          }],
        }),
      },
    },
  } as any);

  assert.equal(result.frame.intent, 'home_guidance');
  assert.equal(result.frame.memoryJudgments[0].status, 'accepted');
  assert.equal(result.frame.memoryJudgments[1].status, 'rejected');
  assert.equal(result.responsePlan.allowedActionSource, 'agenda');
  assert.doesNotMatch(AiriaCognitiveInterpreterService.formatForPrompt(result), /Aliança Divergente|Pense Comigo|Efeito Paralelo/);
  assert.match(AiriaCognitiveInterpreterService.formatForPrompt(result), /FRAME COGNITIVO DA AIRIA/i);

  const fallback = await AiriaCognitiveInterpreterService.interpret({
    surface: 'journal',
    dailyContext: baseContext({ patternMemoryContext: 'Memória antiga sem fato de hoje.' }),
    currentMessage: '',
    ragContext: 'Memória antiga sem fato de hoje.',
  }, {
    chat: {
      completions: {
        create: async () => {
          throw new Error('offline');
        },
      },
    },
  } as any);
  assert.equal(fallback.frame.intent, 'journal_reflection');
  assert.equal(fallback.responsePlan.responseMode, 'acolher');
  assert.match(fallback.responsePlan.mustAvoid.join(' '), /Não criar tarefa sem âncora real/i);
}

run()
  .then(() => {
    console.log('airia-cognitive-interpreter.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
