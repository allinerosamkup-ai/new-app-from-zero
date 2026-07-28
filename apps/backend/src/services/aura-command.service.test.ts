import assert from 'node:assert/strict';

import { getOpenAiModel } from '../lib/openai-config';
import { AuraCommandService, parseAuraCommandResponse } from './aura-command.service';

async function run() {
  const explicitRoutineMessage =
    'Eu preciso criar uma rotina onde eu crie todo dia ou pelo menos três vezes por semana um vídeo dark e também faça pelo menos três publicações no meu perfil de cabeleireiro.';

  const routineBuilder = parseAuraCommandResponse(
    JSON.stringify({
      assistantMessage: 'Vou abrir o montador para separar, revisar e organizar sua semana.',
      intent: 'routine_builder',
      action: 'create_agenda',
      payload: { sourceText: 'Minha rotina está toda solta.' },
      needsConfirmation: false,
    }),
    'Monte minha rotina completa a partir disso.',
  );
  assert.equal(routineBuilder.intent, 'routine_builder');
  assert.equal(routineBuilder.action, 'create_agenda');

  const routineBuilderOverridesWrongModelAction = parseAuraCommandResponse(
    JSON.stringify({
      assistantMessage: 'Fechado; mantenha seu check-in e tente postar três vezes por semana.',
      intent: 'conversation',
      action: 'respond',
      payload: {},
      needsConfirmation: false,
    }),
    explicitRoutineMessage,
  );
  assert.equal(routineBuilderOverridesWrongModelAction.intent, 'routine_builder');
  assert.equal(routineBuilderOverridesWrongModelAction.action, 'create_agenda');
  assert.equal(routineBuilderOverridesWrongModelAction.payload.sourceText, explicitRoutineMessage);
  // A fala confirma que montou aqui — e não anuncia ida para outra tela. Depois do
  // onboarding, o Montador não aparece mais: quem monta é a Airia, na conversa.
  assert.match(routineBuilderOverridesWrongModelAction.assistantMessage, /montar|semana|rotina/i);
  assert.doesNotMatch(routineBuilderOverridesWrongModelAction.assistantMessage, /abrir o montador|vou abrir/i);

  const naturalShortRoutineRequest = parseAuraCommandResponse(
    JSON.stringify({
      assistantMessage: 'Posso ajudar.',
      intent: 'conversation',
      action: 'respond',
      payload: {},
    }),
    'Quero montar meu dia.',
  );
  assert.equal(naturalShortRoutineRequest.action, 'create_agenda');

  const structuredChecklistWithoutCommand = [
    'CHECKLIST — GOVERNO E ACELERAÇÃO',
    '1. UM DIA FIXO PARA SAIR',
    '□ Defini qual dia da semana',
    '□ Saí de casa',
    'Objetivo: tirar a vida do modo espera',
    '2. TETO DE GASTO PESSOAL',
    '□ Defini valor máximo',
    '□ Não antecipei',
    'Objetivo: treinar limite sem punição',
    '3. ENCERRAMENTOS',
    '□ Encerrei pelo menos uma coisa',
    '□ Nada ficou aberto por distração',
  ].join('\n');
  const structuredChecklistResult = parseAuraCommandResponse(
    JSON.stringify({
      assistantMessage: 'Faça um check-in e escolha uma coisa para hoje.',
      intent: 'conversation',
      action: 'respond',
      payload: {},
    }),
    structuredChecklistWithoutCommand,
  );
  assert.equal(structuredChecklistResult.action, 'create_agenda');
  assert.equal(structuredChecklistResult.intent, 'routine_builder');
  assert.equal(structuredChecklistResult.payload.sourceText, structuredChecklistWithoutCommand);

  const negatedRoutineRequest = parseAuraCommandResponse(
    JSON.stringify({ assistantMessage: 'Entendi.', payload: {} }),
    'Não quero criar uma rotina agora; só estou desabafando.',
  );
  assert.equal(negatedRoutineRequest.action, 'respond');
  assert.equal(negatedRoutineRequest.intent, 'conversation');

  const reportedRoutineMention = parseAuraCommandResponse(
    JSON.stringify({ assistantMessage: 'Entendi.', payload: {} }),
    'Só estou falando sobre criar uma rotina; não quero que você faça isso agora.',
  );
  assert.equal(reportedRoutineMention.action, 'respond');
  assert.equal(reportedRoutineMention.intent, 'conversation');

  const conversational = parseAuraCommandResponse(
    JSON.stringify({
      assistantMessage: 'Você está tentando sustentar tudo sozinha; hoje o passo útil é escolher uma decisão pequena e terminá-la.',
      payload: {},
    }),
    'Estou ansiosa com a mudança e não consigo começar.',
  );
  assert.equal(conversational.intent, 'conversation');
  assert.equal(conversational.action, 'respond');
  assert.equal(conversational.needsClarification, false);

  const recoveredAgenda = parseAuraCommandResponse(
    JSON.stringify({
      assistantMessage: 'Separei a proposta em blocos para você revisar.',
      action: 'create_agenda',
      payload: {
        blocks: [
          {
            title: 'Check-in do dia',
            date: '2026-04-18',
            startTime: '09:00',
            category: 'rotina',
          },
        ],
      },
      needsConfirmation: true,
    }),
    'Organize esse texto grande no planner: ' + 'bloco '.repeat(900),
  );

  assert.equal(recoveredAgenda.intent, 'agenda_plan');
  assert.equal(recoveredAgenda.action, 'create_agenda');
  assert.equal(recoveredAgenda.needsConfirmation, true);

  const recoveredClarification = parseAuraCommandResponse(
    JSON.stringify({
      assistantMessage: 'Recebi bastante coisa de uma vez. Posso organizar, resumir ou transformar em passos.',
      payload: {},
    }),
    'texto longo '.repeat(900),
  );

  assert.equal(recoveredClarification.intent, 'conversation');
  assert.equal(recoveredClarification.action, 'respond');
  assert.equal(recoveredClarification.needsClarification, false);

  const captureNote = parseAuraCommandResponse(JSON.stringify({
    assistantMessage: 'Anotei para você revisar nas Capturas.',
    intent: 'capture',
    action: 'create_capture',
    payload: { kind: 'note', title: 'Endereço', content: 'Rua das Flores, 20' },
    needsConfirmation: false,
  }), 'Anota o endereço Rua das Flores, 20');
  assert.equal(captureNote.intent, 'capture');
  assert.equal(captureNote.action, 'create_capture');

  const naturalCheckin = parseAuraCommandResponse(JSON.stringify({
    assistantMessage: 'Montei seu check-in para revisão.',
    intent: 'checkin',
    action: 'create_checkin',
    payload: { moodScore: 3, energyScore: 2, clarityScore: null, irritabilityScore: 7 },
    needsConfirmation: true,
  }), 'Fazer check-in: estou cansada, irritada e sem foco');
  assert.equal(naturalCheckin.action, 'create_checkin');

  const habit = parseAuraCommandResponse(JSON.stringify({
    assistantMessage: 'Preparei o hábito.',
    intent: 'habit',
    action: 'create_habit',
    payload: { title: 'Caminhar', frequency: 'daily' },
    needsConfirmation: true,
  }), 'Cria o hábito de caminhar todos os dias');
  assert.equal(habit.action, 'create_habit');

  const appointment = parseAuraCommandResponse(JSON.stringify({
    assistantMessage: 'Preparei o compromisso no Google Agenda.',
    intent: 'calendar_event',
    action: 'create_calendar_event',
    payload: { title: 'Dentista', date: '2026-07-29', startTime: '10:00' },
    needsConfirmation: true,
  }), 'Marque dentista amanhã às 10h');
  assert.equal(appointment.action, 'create_calendar_event');

  const capturedMessages: Array<{ role: string; content: string }> = [];
  const capturedModels: string[] = [];
  const queuedResponses = [
    {
      assistantMessage: 'Entendi o compromisso. Revise e confirme antes de eu salvar no planner.',
      intent: 'planner_task',
      action: 'create_task',
      payload: {
        title: 'Consulta com dentista',
        date: '2026-04-06',
        time: '14:00',
        category: 'saude',
      },
      needsConfirmation: true,
      needsClarification: false,
      clarifyingQuestion: null,
    },
    {
      assistantMessage: 'Isso parece um pequeno plano com etapas. Vou quebrar em checklist.',
      intent: 'checklist',
      action: 'create_checklist',
      payload: {
        title: 'Preparar apresentação',
        items: ['Abrir o slide atual', 'Listar os 3 tópicos principais'],
      },
      needsConfirmation: false,
      needsClarification: false,
      clarifyingQuestion: null,
    },
    {
      assistantMessage: 'Você está tentando dar conta de tudo ao mesmo tempo. Vamos escolher uma decisão pequena que muda o restante do dia.',
      intent: 'conversation',
      action: 'respond',
      payload: {},
      needsConfirmation: false,
      needsClarification: false,
      clarifyingQuestion: null,
    },
    {
      assistantMessage: 'Antes de agir, preciso só de um detalhe.',
      intent: 'clarify',
      action: 'ask_clarification',
      payload: {},
      needsConfirmation: false,
      needsClarification: true,
      clarifyingQuestion: 'Você quer transformar isso em tarefa, checklist ou meta?',
    },
  ];

  const fakeClient = {
    chat: {
      completions: {
        create: async ({ model, messages }: any) => {
          capturedModels.push(model);
          capturedMessages.push(...messages);
          const next = queuedResponses.shift();
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify(next),
                },
              },
            ],
          };
        },
      },
    },
  };

  let routineModelCalls = 0;
  const routineMustNotCallModelClient = {
    chat: {
      completions: {
        create: async () => {
          routineModelCalls += 1;
          throw new Error('Pedido explícito de rotina não deve depender do modelo');
        },
      },
    },
  };

  const deterministicRoutineResult = await AuraCommandService.interpretCommand({
    message: explicitRoutineMessage,
    userName: 'Ana',
  }, routineMustNotCallModelClient as any);

  assert.equal(deterministicRoutineResult.intent, 'routine_builder');
  assert.equal(deterministicRoutineResult.action, 'create_agenda');
  assert.equal(deterministicRoutineResult.payload.sourceText, explicitRoutineMessage);
  assert.equal(deterministicRoutineResult.needsConfirmation, false);
  assert.equal(routineModelCalls, 0);

  const plannerResult = await AuraCommandService.interpretCommand({
    message: 'Marcar dentista amanhã às 14h',
    userName: 'Ana',
  }, fakeClient as any);

  assert.equal(plannerResult.intent, 'planner_task');
  assert.equal(plannerResult.action, 'create_task');
  assert.equal(plannerResult.needsConfirmation, true);
  assert.equal(plannerResult.needsClarification, false);

  const checklistResult = await AuraCommandService.interpretCommand({
    message: 'Quebra preparar apresentação em passos',
    userName: 'Ana',
  }, fakeClient as any);

  assert.equal(checklistResult.intent, 'checklist');
  assert.equal(checklistResult.action, 'create_checklist');
  assert.equal(checklistResult.needsConfirmation, false);

  const reflectiveResult = await AuraCommandService.interpretCommand({
    message: 'Preciso desabafar porque hoje estou péssima',
    userName: 'Ana',
    interactionMode: 'conversation',
  }, fakeClient as any);

  assert.equal(reflectiveResult.intent, 'conversation');
  assert.equal(reflectiveResult.action, 'respond');
  assert.equal(reflectiveResult.needsConfirmation, false);

  const clarifyResult = await AuraCommandService.interpretCommand({
    message: 'Preciso resolver minha vida',
    userName: 'Ana',
  }, fakeClient as any);

  assert.equal(clarifyResult.intent, 'clarify');
  assert.equal(clarifyResult.action, 'ask_clarification');
  assert.equal(clarifyResult.needsConfirmation, false);
  assert.equal(clarifyResult.needsClarification, true);
  assert.match(clarifyResult.clarifyingQuestion || '', /tarefa, checklist ou meta/i);

  const systemPrompt = capturedMessages[0]?.content || '';
  const userPrompt = capturedMessages[1]?.content || '';

  assert.match(systemPrompt, /assistente pessoal de humor, energia e agenda adaptativa/i);
  assert.match(systemPrompt, /IDENTIDADE DO PRODUTO/i);
  assert.match(systemPrompt, /LEITURA TOTAL/i);
  assert.match(systemPrompt, /humor atual, historico de humor/i);
  assert.match(systemPrompt, /memorias RAG relevantes/i);
  assert.match(systemPrompt, /POLITICA DE SUGESTAO CONCRETA/i);
  // INTERNAL_METHOD_LENS reescrita — checa concept-key estável em vez de "termos proprietarios"
  assert.match(systemPrompt, /UM PROBLEMA POR VEZ/i);
  assert.match(systemPrompt, /APOIO, NAO SOLUCAO/i);
  assert.doesNotMatch(systemPrompt, /Aliança Divergente/i);
  assert.doesNotMatch(systemPrompt, /Marca Passo/i);
  assert.doesNotMatch(systemPrompt, /Ponto Cego/i);
  assert.doesNotMatch(systemPrompt, /Efeito Paralelo/i);
  assert.match(userPrompt, /create_task/i);
  assert.match(userPrompt, /create_checklist/i);
  assert.match(userPrompt, /handoff_to_journal/i);
  assert.match(userPrompt, /ask_clarification/i);
  assert.match(userPrompt, /MONTAR ROTINA AQUI NA CONVERSA/i);
  assert.doesNotMatch(userPrompt, /start_routine_builder|abrir o Montador/i);
  assert.match(userPrompt, /needsConfirmation/i);
  assert.match(userPrompt, /recorrent/i);
  assert.match(userPrompt, /HIERARQUIA DE EXECUÇÃO/i);
  assert.match(userPrompt, /MONTAR ROTINA AQUI NA CONVERSA/i);
  assert.match(userPrompt, /MODO EXECUTOR/i);
  assert.match(userPrompt, /FORMATO OBRIGATÓRIO PARA CREATE_AGENDA/i);
  assert.match(userPrompt, /RELATO DE CONCLUSÃO/i);
  assert.match(userPrompt, /taskId.*t[ií]tulo.*alvo atual/i);
  assert.match(userPrompt, /nunca diga que j[aá] salvou|n[aã]o diga que j[aá] salvou/i);
  assert.ok(capturedModels.every((model) => model === getOpenAiModel()));
}

run()
  .then(() => {
    console.log('aura-command.service tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
