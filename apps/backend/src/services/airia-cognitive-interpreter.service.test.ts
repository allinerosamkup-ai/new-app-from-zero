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
  assert.equal(result.responsePlan.allowedActionSource, 'none');
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

  const offline = (currentMessage: string, surface: 'aura-chat' | 'planner' | 'journal' = 'aura-chat') =>
    AiriaCognitiveInterpreterService.interpret({
      surface,
      dailyContext: baseContext({
        pendingTaskTitles: ['Tarefa antiga que não foi mencionada agora'],
        patternMemoryContext: 'Antes ela costumava transformar ansiedade em listas.',
      }),
      currentMessage,
      ragContext: 'Contexto antigo: talvez devesse marcar uma consulta.',
    }, {
      chat: {
        completions: {
          create: async () => ({ choices: [] }),
        },
      },
    } as any);

  const ventPt = await offline('Só estou desabafando. Não quero conselho nem tarefa agora.');
  assert.equal(ventPt.captureJudgment.captureAs, 'conversation');
  assert.equal(ventPt.captureJudgment.allowTaskCreation, false);
  assert.equal(ventPt.captureJudgment.allowDecisionMemory, false);
  assert.equal(ventPt.responsePlan.responseMode, 'acolher');

  const ventEn = await offline("I don’t want advice, just listen. I am only venting.", 'planner');
  assert.equal(ventEn.captureJudgment.captureAs, 'conversation');
  assert.equal(ventEn.captureJudgment.allowTaskCreation, false);
  assert.equal(ventEn.captureJudgment.allowDecisionMemory, false);
  assert.notEqual(ventEn.frame.intent, 'agenda_adaptation');

  const contextualTaskVentEn = await offline('I need to vent about having to create a task for this.');
  assert.deepEqual(contextualTaskVentEn.captureJudgment.allowedMutationActions, []);
  assert.equal(contextualTaskVentEn.captureJudgment.allowTaskCreation, false);

  const quotedTaskWithoutRequestEn = await offline('I was told: create a task. I am not asking you to do it.');
  assert.deepEqual(quotedTaskWithoutRequestEn.captureJudgment.allowedMutationActions, []);
  assert.equal(quotedTaskWithoutRequestEn.captureJudgment.allowTaskCreation, false);

  const explicitNoTask = await offline('Não crie uma tarefa; só quero pensar em voz alta.');
  assert.equal(explicitNoTask.captureJudgment.captureAs, 'conversation');
  assert.equal(explicitNoTask.captureJudgment.allowTaskCreation, false);

  const indirectNoTaskPt = await offline('Não quero que você agende nada. Só preciso falar.');
  assert.equal(indirectNoTaskPt.captureJudgment.captureAs, 'conversation');
  assert.equal(indirectNoTaskPt.captureJudgment.allowTaskCreation, false);

  const indirectNoTaskEn = await offline('I do not want you to create a task. Just hear me out.');
  assert.equal(indirectNoTaskEn.captureJudgment.captureAs, 'conversation');
  assert.equal(indirectNoTaskEn.captureJudgment.allowTaskCreation, false);

  for (const deniedMutation of [
    'Não atualize a tarefa da proposta.',
    'Do not mark the proposal task done.',
    'Não leve isso para o diário.',
    'Do not hand this off to my journal.',
    'Please do not delete the proposal task.',
    'Nunca crie uma meta com isso.',
  ]) {
    const result = await offline(deniedMutation);
    assert.deepEqual(result.captureJudgment.allowedMutationActions, [], deniedMutation);
    assert.equal(result.captureJudgment.allowTaskCreation, false, deniedMutation);
  }

  for (const reportedMutation of [
    'The note reads: delete the proposal task.',
    'O texto diz: conclua a tarefa da proposta.',
    'The instructions say to move the proposal task to tomorrow.',
    'No texto está escrito: exclua a tarefa da proposta.',
    'Ela disse complete the proposal task.',
    'She said complete the proposal task.',
    'Traduza delete the proposal task para português.',
  ]) {
    const result = await offline(reportedMutation);
    assert.deepEqual(result.captureJudgment.allowedMutationActions, [], reportedMutation);
    assert.equal(result.captureJudgment.allowTaskCreation, false, reportedMutation);
  }

  const explicitTaskPt = await offline('Crie uma tarefa para ligar para a dentista amanhã.');
  assert.equal(explicitTaskPt.captureJudgment.captureAs, 'task');
  assert.equal(explicitTaskPt.captureJudgment.explicitness, 'explicit');
  assert.equal(explicitTaskPt.captureJudgment.allowTaskCreation, true);
  assert.equal(explicitTaskPt.frame.intent, 'execution');
  assert.deepEqual(explicitTaskPt.captureJudgment.allowedMutationActions, ['create_task']);

  const explicitTaskEn = await offline('Please add a task to send the proposal tomorrow.');
  assert.equal(explicitTaskEn.captureJudgment.captureAs, 'task');
  assert.equal(explicitTaskEn.captureJudgment.allowTaskCreation, true);

  const explicitGoalPt = await offline('Quero criar uma meta para terminar o curso.');
  assert.equal(explicitGoalPt.captureJudgment.allowTaskCreation, true);
  assert.deepEqual(explicitGoalPt.captureJudgment.allowedMutationActions, ['create_goal']);

  const explicitChecklistPt = await offline('Quebra preparar a apresentação em passos.');
  assert.equal(explicitChecklistPt.captureJudgment.allowTaskCreation, true);
  assert.deepEqual(explicitChecklistPt.captureJudgment.allowedMutationActions, ['create_checklist']);

  const explicitSchedulePt = await offline('Marcar dentista amanhã às 14h.');
  assert.equal(explicitSchedulePt.captureJudgment.captureAs, 'calendar_commitment');
  assert.equal(explicitSchedulePt.captureJudgment.allowTaskCreation, true);
  assert.deepEqual(explicitSchedulePt.captureJudgment.allowedMutationActions, ['create_agenda']);

  const broadRoutinePt = await offline('Monte minha rotina completa a partir das minhas anotações.');
  assert.equal(broadRoutinePt.captureJudgment.allowTaskCreation, false);
  assert.deepEqual(broadRoutinePt.captureJudgment.allowedMutationActions, []);

  const explicitGoalEn = await offline('Could you create a goal to finish the course?');
  assert.equal(explicitGoalEn.captureJudgment.allowTaskCreation, true);
  assert.deepEqual(explicitGoalEn.captureJudgment.allowedMutationActions, ['create_goal']);

  const journalPt = await offline('Leve isso para o diário para eu elaborar melhor.');
  assert.deepEqual(journalPt.captureJudgment.allowedMutationActions, ['handoff_to_journal']);
  assert.equal(journalPt.captureJudgment.allowTaskCreation, false);

  const journalEn = await offline('Take this to my journal so I can reflect on it.');
  assert.deepEqual(journalEn.captureJudgment.allowedMutationActions, ['handoff_to_journal']);

  const registerJournalEn = await offline('Register this in my journal.');
  assert.deepEqual(registerJournalEn.captureJudgment.allowedMutationActions, ['handoff_to_journal']);

  const updatePt = await offline('Altere a tarefa da proposta para amanhã às 10h.');
  assert.deepEqual(updatePt.captureJudgment.allowedMutationActions, ['update_task']);
  assert.equal(updatePt.captureJudgment.mutationTargetText, 'proposta');
  assert.match(AiriaCognitiveInterpreterService.formatForPrompt(updatePt), /Alvo atual da mutacao: proposta/i);

  const updateEn = await offline('Change the proposal task to tomorrow at 10am.');
  assert.deepEqual(updateEn.captureJudgment.allowedMutationActions, ['update_task']);

  const completePt = await offline('Conclua a tarefa da proposta.');
  assert.deepEqual(completePt.captureJudgment.allowedMutationActions, ['complete_items']);
  assert.equal(completePt.captureJudgment.mutationTargetText, 'proposta');

  const completeEn = await offline('Complete the proposal task.');
  assert.deepEqual(completeEn.captureJudgment.allowedMutationActions, ['complete_items']);

  const transformPt = await offline('Transforme isso em uma tarefa para amanhã.');
  assert.deepEqual(transformPt.captureJudgment.allowedMutationActions, ['create_task']);

  const putAsTaskEn = await offline('Put this down as a task for tomorrow.');
  assert.deepEqual(putAsTaskEn.captureJudgment.allowedMutationActions, ['create_task']);

  const deletePt = await offline('Exclua a tarefa da proposta.');
  assert.deepEqual(deletePt.captureJudgment.allowedMutationActions, ['delete_task']);

  const deleteEn = await offline('Delete the proposal task.');
  assert.deepEqual(deleteEn.captureJudgment.allowedMutationActions, ['delete_task']);
  assert.equal(deleteEn.captureJudgment.mutationTargetText, 'proposal');

  const politeDeletePt = await offline('Exclua a tarefa da proposta por favor.');
  assert.deepEqual(politeDeletePt.captureJudgment.allowedMutationActions, ['delete_task']);
  assert.equal(politeDeletePt.captureJudgment.mutationTargetText, 'proposta');

  const politeDeleteEn = await offline('Delete the proposal task please.');
  assert.deepEqual(politeDeleteEn.captureJudgment.allowedMutationActions, ['delete_task']);
  assert.equal(politeDeleteEn.captureJudgment.mutationTargetText, 'proposal');

  const personalDeletePt = await offline('Exclua a tarefa da proposta pra mim.');
  assert.deepEqual(personalDeletePt.captureJudgment.allowedMutationActions, ['delete_task']);
  assert.equal(personalDeletePt.captureJudgment.mutationTargetText, 'proposta');

  const personalDeleteEn = await offline('Delete the proposal task for me.');
  assert.deepEqual(personalDeleteEn.captureJudgment.allowedMutationActions, ['delete_task']);
  assert.equal(personalDeleteEn.captureJudgment.mutationTargetText, 'proposal');

  const commitment = await offline('I have a dentist appointment tomorrow at 3pm.');
  assert.equal(commitment.captureJudgment.captureAs, 'calendar_commitment');
  assert.equal(commitment.captureJudgment.allowTaskCreation, false);
  assert.equal(commitment.captureJudgment.allowDecisionMemory, false);

  const note = await offline('Remember that my mother prefers calls in the morning.');
  assert.equal(note.captureJudgment.captureAs, 'memory_fact');
  assert.equal(note.captureJudgment.allowTaskCreation, false);
  assert.equal(note.captureJudgment.allowDecisionMemory, false);

  const reflection = await offline('Percebi que fico sobrecarregada quando aceito tudo de uma vez.');
  assert.equal(reflection.captureJudgment.captureAs, 'reflection');
  assert.equal(reflection.captureJudgment.allowTaskCreation, false);

  const decisionCorrection = await offline('Eu decidi recusar a proposta, não aceitar como eu tinha dito antes.');
  assert.equal(decisionCorrection.captureJudgment.captureAs, 'decision');
  assert.equal(decisionCorrection.captureJudgment.allowDecisionMemory, true);
  assert.equal(decisionCorrection.captureJudgment.explicitness, 'explicit');
  assert.equal(AiriaCognitiveInterpreterService.allowsMemoryDecisionExtraction(decisionCorrection), true);
  assert.equal(AiriaCognitiveInterpreterService.allowsMemoryDecisionExtraction(explicitTaskPt), false);
  assert.equal(AiriaCognitiveInterpreterService.allowsMemoryDecisionExtraction(ventEn), false);

  const notDecided = await offline('Ainda não decidi se aceito a proposta.');
  assert.equal(notDecided.captureJudgment.allowDecisionMemory, false);

  const ambiguous = await offline('Talvez eu devesse organizar isso algum dia.');
  assert.equal(ambiguous.captureJudgment.allowTaskCreation, false);
  assert.equal(ambiguous.captureJudgment.allowDecisionMemory, false);
  assert.equal(ambiguous.responsePlan.allowedActionSource, 'none');

  const ambiguousEn = await offline('I feel like I need to move through this slowly.');
  assert.equal(ambiguousEn.captureJudgment.captureAs, 'reflection');
  assert.equal(ambiguousEn.captureJudgment.allowTaskCreation, false);

  const agendaNounPt = await offline('Minha agenda está vazia hoje.');
  assert.equal(agendaNounPt.captureJudgment.allowTaskCreation, false);
  assert.equal(agendaNounPt.frame.intent, 'conversation');
  assert.notEqual(agendaNounPt.responsePlan.responseMode, 'adaptar_agenda');

  const scheduleNounEn = await offline('My schedule is full today.');
  assert.equal(scheduleNounEn.captureJudgment.allowTaskCreation, false);
  assert.equal(scheduleNounEn.frame.intent, 'conversation');
  assert.notEqual(scheduleNounEn.responsePlan.responseMode, 'adaptar_agenda');

  const agendaNounWithOldActionPlan = await AiriaCognitiveInterpreterService.interpret({
    surface: 'planner',
    dailyContext: context,
    currentMessage: 'Minha agenda está vazia hoje.',
    ragContext: 'Memória antiga sobre separar caixas da mudança.',
    actionPlan,
  }, { chat: { completions: { create: async () => ({ choices: [] }) } } } as any);
  assert.equal(agendaNounWithOldActionPlan.frame.intent, 'conversation');
  assert.notEqual(agendaNounWithOldActionPlan.responsePlan.responseMode, 'adaptar_agenda');
  assert.equal(agendaNounWithOldActionPlan.responsePlan.allowedActionSource, 'none');
  assert.doesNotMatch(agendaNounWithOldActionPlan.responsePlan.finalMove, /Separar caixas da mudança/i);

  const ventWithOldActionPlan = await AiriaCognitiveInterpreterService.interpret({
    surface: 'aura-chat',
    dailyContext: context,
    currentMessage: 'Só estou desabafando. Não quero que você faça nada.',
    ragContext: 'Contexto antigo sobre a mudança.',
    actionPlan,
  }, { chat: { completions: { create: async () => ({ choices: [] }) } } } as any);
  assert.equal(ventWithOldActionPlan.captureJudgment.allowTaskCreation, false);
  assert.equal(ventWithOldActionPlan.responsePlan.allowedActionSource, 'none');
  assert.doesNotMatch(ventWithOldActionPlan.responsePlan.finalMove, /Separar caixas da mudança/i);

  const modelTriesToInventTask = await AiriaCognitiveInterpreterService.interpret({
    surface: 'aura-chat',
    dailyContext: baseContext(),
    currentMessage: "I don’t want advice, just listen.",
    ragContext: 'Old memory says create a task to call someone.',
  }, {
    chat: {
      completions: {
        create: async () => ({
          choices: [{ message: { content: JSON.stringify({
            frame: {
              currentFact: 'Create a task.', userInterpretation: '', emotionalSignal: '', intent: 'execution',
              decisionInPlay: 'Call someone', moodCycleReading: '', relevantEvidence: ['old memory'],
              memoryJudgments: [], riskOfBadResponse: [], confidence: 'alta',
            },
            responsePlan: {
              responseMode: 'executar', tone: 'executor', oneSentenceReading: '', finalMove: 'Create task',
              mustMention: [], mustAvoid: [], allowedActionSource: 'memory_pattern',
            },
            captureJudgment: {
              captureAs: 'task', allowTaskCreation: true, allowDecisionMemory: true,
              explicitness: 'explicit', confidence: 'alta', reason: 'old context',
            },
          }) } }],
        }),
      },
    },
  } as any);
  assert.equal(modelTriesToInventTask.captureJudgment.captureAs, 'conversation');
  assert.equal(modelTriesToInventTask.captureJudgment.allowTaskCreation, false);
  assert.deepEqual(modelTriesToInventTask.captureJudgment.allowedMutationActions, []);
  assert.equal(modelTriesToInventTask.frame.intent, 'conversation');
  assert.equal(modelTriesToInventTask.responsePlan.allowedActionSource, 'none');

  const modelUsesOldDecision = await AiriaCognitiveInterpreterService.interpret({
    surface: 'aura-chat',
    dailyContext: baseContext(),
    currentMessage: 'Tell me what you understood.',
    ragContext: 'Old context: she had considered declining an offer.',
    actionPlan,
  }, {
    chat: { completions: { create: async () => ({
      choices: [{ message: { content: JSON.stringify({
        frame: {
          currentFact: 'She declined the offer.', userInterpretation: '', emotionalSignal: '', intent: 'decision',
          decisionInPlay: 'Decline it', moodCycleReading: '', relevantEvidence: ['old context'],
          memoryJudgments: [], riskOfBadResponse: [], confidence: 'alta',
        },
        responsePlan: {
          responseMode: 'executar', tone: 'executor', oneSentenceReading: '', finalMove: 'Persist decision',
          mustMention: [], mustAvoid: [], allowedActionSource: 'memory_pattern',
        },
      }) } }],
    }) } },
  } as any);
  assert.equal(modelUsesOldDecision.frame.intent, 'conversation');
  assert.equal(modelUsesOldDecision.captureJudgment.allowDecisionMemory, false);
  assert.equal(modelUsesOldDecision.responsePlan.allowedActionSource, 'none');
  assert.notEqual(modelUsesOldDecision.responsePlan.responseMode, 'executar');
  assert.doesNotMatch(modelUsesOldDecision.responsePlan.finalMove, /Persist decision|Separar caixas da mudança/i);

  const hostileModelWithUnrelatedPlan = await AiriaCognitiveInterpreterService.interpret({
    surface: 'planner',
    dailyContext: context,
    currentMessage: 'My schedule is full today.',
    ragContext: 'Old memory about moving boxes.',
    actionPlan,
  }, {
    chat: { completions: { create: async () => ({
      choices: [{ message: { content: JSON.stringify({
        frame: {
          currentFact: 'The user ordered execution.', userInterpretation: '', emotionalSignal: '', intent: 'agenda_adaptation',
          decisionInPlay: 'Move the boxes', moodCycleReading: '', relevantEvidence: ['old memory'],
          memoryJudgments: [], riskOfBadResponse: [], confidence: 'alta',
        },
        responsePlan: {
          responseMode: 'adaptar_agenda', tone: 'executor',
          oneSentenceReading: 'Move the old task now.', finalMove: 'Separar caixas da mudança.',
          mustMention: ['Delete every task'], mustAvoid: [], allowedActionSource: 'agenda',
        },
        captureJudgment: {
          captureAs: 'task', allowTaskCreation: true, allowDecisionMemory: true,
          allowMemoryCapture: true, explicitness: 'explicit', confidence: 'alta', reason: 'hostile model',
        },
      }) } }],
    }) } },
  } as any);
  assert.equal(hostileModelWithUnrelatedPlan.frame.intent, 'conversation');
  assert.notEqual(hostileModelWithUnrelatedPlan.responsePlan.responseMode, 'adaptar_agenda');
  assert.equal(hostileModelWithUnrelatedPlan.responsePlan.allowedActionSource, 'none');
  assert.doesNotMatch(hostileModelWithUnrelatedPlan.responsePlan.oneSentenceReading, /old task/i);
  assert.doesNotMatch(hostileModelWithUnrelatedPlan.responsePlan.mustMention.join(' '), /Delete every task/i);
  assert.doesNotMatch(hostileModelWithUnrelatedPlan.responsePlan.finalMove, /Separar caixas/i);
  assert.deepEqual(hostileModelWithUnrelatedPlan.captureJudgment.allowedMutationActions, []);

  const hostileModelActionMismatch = await AiriaCognitiveInterpreterService.interpret({
    surface: 'aura-chat',
    dailyContext: baseContext(),
    currentMessage: 'Create a task to send the proposal tomorrow.',
  }, {
    chat: { completions: { create: async () => ({
      choices: [{ message: { content: JSON.stringify({
        frame: {
          currentFact: 'Delete an old task.', userInterpretation: '', emotionalSignal: '', intent: 'execution',
          decisionInPlay: 'Delete', moodCycleReading: '', relevantEvidence: [], memoryJudgments: [],
          riskOfBadResponse: [], confidence: 'alta',
        },
        responsePlan: {
          responseMode: 'executar', tone: 'executor', oneSentenceReading: '', finalMove: 'Delete it',
          mustMention: [], mustAvoid: [], allowedActionSource: 'user_report',
        },
        captureJudgment: {
          captureAs: 'task', allowedMutationActions: ['delete_task'], allowTaskCreation: true,
          allowDecisionMemory: false, allowMemoryCapture: false, explicitness: 'explicit',
          confidence: 'alta', reason: 'hostile action substitution',
        },
      }) } }],
    }) } },
  } as any);
  assert.deepEqual(hostileModelActionMismatch.captureJudgment.allowedMutationActions, ['create_task']);

  const formatted = AiriaCognitiveInterpreterService.formatForPrompt(explicitTaskEn);
  assert.match(formatted, /Captura permitida: task/i);
  assert.match(formatted, /Criar tarefa: sim/i);
}

run()
  .then(() => {
    console.log('airia-cognitive-interpreter.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
