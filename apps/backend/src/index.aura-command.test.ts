import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp, enforceAuraCaptureGate } from './index';

async function readResponseText(response: Response): Promise<string> {
  return await response.text();
}

async function run() {
  const createdSessions: any[] = [];
  const savedMessages: any[] = [];
  const updatedBlocks: any[] = [];
  const previousOpenAiKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  const mutatingActions = [
    'create_task', 'create_checklist', 'create_goal', 'create_agenda',
    'handoff_to_journal', 'update_task', 'delete_task', 'complete_items',
  ] as const;
  for (const action of mutatingActions) {
    const candidate = {
      assistantMessage: 'Mutation accepted by the model.',
      intent: 'planner_task',
      action,
      payload: { taskId: 'task-1' },
      needsConfirmation: false,
      needsClarification: false,
      clarifyingQuestion: null,
    } as any;
    const blocked = enforceAuraCaptureGate(candidate, {
      captureJudgment: { allowedMutationActions: [] },
    }, 'en-US');
    assert.equal(blocked.action, 'ask_clarification');
    assert.deepEqual(blocked.payload, {});

    const payloadWithTarget = action === 'complete_items'
      ? { items: [{ title: 'Proposal', type: 'task' }] }
      : action === 'update_task'
        ? { taskId: 'task-1', newDate: '2026-04-07', newStartTime: '14:00' }
        : action === 'delete_task'
          ? { taskId: 'task-1' }
          : action === 'create_task'
            ? { title: 'Proposal', date: '2026-04-07', startTime: '14:00' }
            : action === 'create_goal'
              ? { title: 'Finish course' }
              : action === 'create_checklist'
                ? { title: 'Proposal', items: ['Review'] }
                : action === 'create_agenda'
                  ? { blocks: [{ title: 'Proposal', date: '2026-04-07', startTime: '14:00' }] }
                  : {};
    const exactCandidate = { ...candidate, payload: payloadWithTarget };
    const allowed = enforceAuraCaptureGate(exactCandidate, {
      captureJudgment: {
        allowedMutationActions: [action],
        mutationTargetText: action === 'update_task' || action === 'delete_task' ? 'proposal' : null,
      },
    }, 'en-US', { resolvedTaskTitle: action === 'update_task' || action === 'delete_task' ? 'Send proposal' : null });
    assert.equal(allowed.action, action);
    for (const [key, value] of Object.entries(payloadWithTarget)) {
      assert.deepEqual((allowed.payload as any)[key], value, `${action}.${key}`);
    }
  }

  const actionMismatch = enforceAuraCaptureGate({
    assistantMessage: 'Deleted it.', intent: 'delete_task', action: 'delete_task',
    payload: { taskId: 'task-1' }, needsConfirmation: false,
    needsClarification: false, clarifyingQuestion: null,
  }, { captureJudgment: { allowedMutationActions: ['create_task'] } }, 'en-US');
  assert.equal(actionMismatch.action, 'ask_clarification');

  for (const action of ['update_task', 'delete_task', 'complete_items'] as const) {
    const missingTarget = enforceAuraCaptureGate({
      assistantMessage: 'Done.',
      intent: action === 'update_task' ? 'reschedule' : action,
      action,
      payload: {},
      needsConfirmation: false,
      needsClarification: false,
      clarifyingQuestion: null,
    }, { captureJudgment: { allowedMutationActions: [action] } }, 'en-US');
    assert.equal(missingTarget.action, 'ask_clarification');
    // Falta de alvo é falta de dado, não falta de permissão: a Airia pergunta qual item.
    assert.equal(missingTarget.needsClarification, true, action);
    assert.match(String(missingTarget.clarifyingQuestion), /which one/i, action);
  }

  const wrongTarget = enforceAuraCaptureGate({
    assistantMessage: 'Deleted it.', intent: 'delete_task', action: 'delete_task',
    payload: { taskId: 'task-1' }, needsConfirmation: false,
    needsClarification: false, clarifyingQuestion: null,
  }, {
    captureJudgment: { allowedMutationActions: ['delete_task'], mutationTargetText: 'dentist' },
  }, 'en-US', { resolvedTaskTitle: 'Send proposal' });
  assert.equal(wrongTarget.action, 'ask_clarification');

  for (const politeTarget of ['proposta por favor', 'proposal please', 'proposta pra mim', 'proposal for me']) {
    const politeTargetCandidate = {
      assistantMessage: 'Deleted it.', intent: 'delete_task', action: 'delete_task',
      payload: { taskId: 'task-1' }, needsConfirmation: false,
      needsClarification: false, clarifyingQuestion: null,
    } as const;
    const politeTargetAllowed = enforceAuraCaptureGate(politeTargetCandidate, {
      captureJudgment: { allowedMutationActions: ['delete_task'], mutationTargetText: politeTarget },
    }, 'en-US', { resolvedTaskTitle: politeTarget.startsWith('proposal') ? 'Send proposal' : 'Enviar proposta' });
    assert.equal(politeTargetAllowed.action, 'delete_task', politeTarget);
    assert.equal((politeTargetAllowed.payload as any).taskId, 'task-1', politeTarget);
  }

  const incompleteUpdate = enforceAuraCaptureGate({
    assistantMessage: 'Moved it.', intent: 'reschedule', action: 'update_task',
    payload: { taskId: 'task-1', newDate: '2026-04-07' }, needsConfirmation: false,
    needsClarification: false, clarifyingQuestion: null,
  }, {
    captureJudgment: { allowedMutationActions: ['update_task'], mutationTargetText: 'proposal' },
  }, 'en-US', { resolvedTaskTitle: 'Send proposal' });
  assert.equal(incompleteUpdate.action, 'ask_clarification');

  // Sem título não há o que criar — isso a Airia não inventa.
  for (const [action, payload] of [
    ['create_goal', {}],
    ['create_checklist', { title: 'Proposal', items: [] }],
    ['create_agenda', { blocks: [] }],
  ] as const) {
    const incompleteCreation = enforceAuraCaptureGate({
      assistantMessage: 'Created.', intent: action === 'create_goal' ? 'goal_project' : action === 'create_checklist' ? 'checklist' : 'agenda_plan',
      action, payload, needsConfirmation: false, needsClarification: false, clarifyingQuestion: null,
    }, { captureJudgment: { allowedMutationActions: [action] } }, 'en-US');
    assert.equal(incompleteCreation.action, 'ask_clarification', action);
  }

  // Com título e sem horário, a Airia decide o horário em vez de devolver a pergunta.
  const completedTask = enforceAuraCaptureGate({
    assistantMessage: 'Created.', intent: 'planner_task', action: 'create_task',
    payload: { title: 'Comprar ração' }, needsConfirmation: false,
    needsClarification: false, clarifyingQuestion: null,
  }, {
    captureJudgment: { allowedMutationActions: ['create_task'], captureMode: 'propose' },
  }, 'pt-BR', { localDate: '2026-04-07', currentHour: 10, currentMinute: 5 });
  assert.equal(completedTask.action, 'create_task');
  assert.equal((completedTask.payload as any).date, '2026-04-07');
  assert.equal((completedTask.payload as any).startTime, '10:30');
  assert.equal((completedTask.payload as any).timingWasInferred, true);
  assert.equal((completedTask.payload as any).inferredFromContext, true);

  // Tarde demais para encaixar hoje: cai para a manhã seguinte, nunca de madrugada.
  const nextMorning = enforceAuraCaptureGate({
    assistantMessage: 'Created.', intent: 'planner_task', action: 'create_task',
    payload: { title: 'Ligar para a escola' }, needsConfirmation: false,
    needsClarification: false, clarifyingQuestion: null,
  }, {
    captureJudgment: { allowedMutationActions: ['create_task'], captureMode: 'propose' },
  }, 'pt-BR', { localDate: '2026-04-07', currentHour: 23, currentMinute: 40 });
  assert.equal((nextMorning.payload as any).date, '2026-04-08');
  assert.equal((nextMorning.payload as any).startTime, '09:00');

  // Horário informado pela usuária é preservado sem arredondamento.
  const respectsGivenTime = enforceAuraCaptureGate({
    assistantMessage: 'Created.', intent: 'planner_task', action: 'create_task',
    payload: { title: 'Consulta', date: '2026-04-09', startTime: '15:00' }, needsConfirmation: false,
    needsClarification: false, clarifyingQuestion: null,
  }, {
    captureJudgment: { allowedMutationActions: ['create_task'], captureMode: 'propose' },
  }, 'pt-BR', { localDate: '2026-04-07', currentHour: 10, currentMinute: 5 });
  assert.equal((respectsGivenTime.payload as any).startTime, '15:00');
  assert.equal((respectsGivenTime.payload as any).timingWasInferred, false);

  // Pedido de escuta continua sendo respeitado — isso não mudou.
  const listenOnly = enforceAuraCaptureGate({
    assistantMessage: 'Created.', intent: 'planner_task', action: 'create_task',
    payload: { title: 'Descansar' }, needsConfirmation: false,
    needsClarification: false, clarifyingQuestion: null,
  }, {
    captureJudgment: { allowedMutationActions: [], captureMode: 'listen' },
  }, 'pt-BR');
  assert.equal(listenOnly.action, 'ask_clarification');
  assert.doesNotMatch(listenOnly.assistantMessage, /pedido expl/i);

  const prisma = {
    $queryRaw: async () => [],
    $executeRaw: async () => ({}),
    profile: {
      findUnique: async () => ({ fullName: 'Teste Aura' }),
    },
    memoryEmbedding: {
      findFirst: async () => null,
    },
    memoryItem: {
      findFirst: async () => null,
      create: async () => ({}),
      update: async () => ({}),
    },
    onboardingResponse: {
      findUnique: async () => ({ aiProfileSummary: 'Perfil resumido.' }),
    },
    dailyCheckin: {
      findFirst: async () => ({
        localDate: new Date('2026-04-06T00:00:00.000Z'),
        moodScore: 2,
        energyScore: 2,
        sleepScore: 3,
        stateLabel: 'Dia sensível',
        stateLabelType: 'sensível',
        stateSummary: 'Emoções à flor da pele.',
      }),
    },
    timelineBlock: {
      findMany: async () => [],
      findFirst: async ({ where }: any) => where.id === 'task-1' ? ({
        id: 'task-1',
        userId: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Tarefa existente',
        startAt: new Date('2026-04-06T10:00:00.000Z'),
        endAt: new Date('2026-04-06T11:00:00.000Z'),
        gcalEventId: null,
      }) : null,
      update: async ({ where, data }: any) => {
        updatedBlocks.push({ where, data });
        return { id: where.id, ...data };
      },
      delete: async () => ({}),
    },
    journalSession: {
      create: async ({ data }: any) => {
        const session = { id: `session-${createdSessions.length + 1}`, ...data };
        createdSessions.push(session);
        return session;
      },
      update: async ({ where, data }: any) => ({
        id: where.id,
        ...data,
      }),
    },
    journalMessage: {
      create: async ({ data }: any) => {
        savedMessages.push(data);
        return { id: `message-${savedMessages.length}`, ...data };
      },
    },
  };

  const app = createApp({
    authMiddleware: (req: any, _res: any, next: any) => {
      req.userId = '550e8400-e29b-41d4-a716-446655440000';
      next();
    },
    prisma: prisma as any,
    auraCommandService: {
      interpretCommand: async ({ message }: any) => {
        if (/mova|desabafando|do not want you to create/i.test(message)) {
          return {
            assistantMessage: 'Pronto, movi a tarefa.',
            intent: 'reschedule',
            action: 'update_task',
            payload: { taskId: 'task-1', newDate: '2026-04-07', newStartTime: '14:00' },
            needsConfirmation: false,
            needsClarification: false,
            clarifyingQuestion: null,
          };
        }
        if (/organize esse texto/i.test(message)) {
          return {
            assistantMessage: 'Montei os blocos.',
            intent: 'agenda_plan',
            action: 'create_agenda',
            payload: { blocks: [] },
            needsConfirmation: false,
            needsClarification: false,
            clarifyingQuestion: null,
          };
        }
        return {
          assistantMessage: 'Isso parece diário. Vou guardar um resumo por aqui.',
          intent: 'reflective_handoff',
          action: 'handoff_to_journal',
          payload: {},
          needsConfirmation: false,
          needsClarification: false,
          clarifyingQuestion: null,
        };
      },
    } as any,
    aiService: {
      summarizeJournalSession: async () => ({
        summary: 'Resumo salvo pela Aura.',
        emotions: ['ansiosa', 'aliviada'],
        themes: ['relacionamento'],
        suggestions: ['Respirar antes de responder.'],
      }),
      streamJournalReply: async () => 'ok',
    } as any,
    memoryService: {
      store: async () => ({}),
      retrieve: async () => [],
      formatForPrompt: () => '',
      deleteAll: async () => undefined,
    } as any,
    auraMemoryIngestionService: {
      ingest: async () => undefined,
    },
    generateJournalSuggestedTasks: async () => [],
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('failed to open test server');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const response = await fetch(`${baseUrl}/api/aura/command/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        sessionId: '7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11',
        message: 'Salve no diário o que aconteceu hoje para eu processar isso.',
        history: [
          { role: 'assistant', content: 'Pode me contar o que aconteceu.' },
          { role: 'user', content: 'Foi uma conversa difícil.' },
        ],
      }),
    });

    assert.equal(response.status, 200);
    const streamBody = await readResponseText(response);

    assert.equal(createdSessions.length, 1);
    assert.ok(savedMessages.length >= 2);
    assert.match(streamBody, /assistant\.completed/);
    assert.match(streamBody, /Resumo salvo pela Aura/);
    assert.match(streamBody, /journalSummary/i);

    const longCommandResponse = await fetch(`${baseUrl}/api/aura/command/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        sessionId: '7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d12',
        message: 'Organize esse texto grande no planner. '.repeat(650),
        history: [
          { role: 'assistant', content: 'Pode colar tudo aqui.' },
        ],
      }),
    });

    assert.equal(longCommandResponse.status, 200);

    const explicitMoveResponse = await fetch(`${baseUrl}/api/aura/command/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        sessionId: '7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d13',
        message: 'Mova a tarefa existente para amanhã às 14h.',
        history: [],
      }),
    });
    const explicitMoveBody = await readResponseText(explicitMoveResponse);
    assert.equal(explicitMoveResponse.status, 200);
    assert.equal(updatedBlocks.length, 1);
    assert.match(explicitMoveBody, /update_task/);
    assert.match(explicitMoveBody, /updatedTaskId/);

    const blockedVentResponse = await fetch(`${baseUrl}/api/aura/command/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        sessionId: '7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d14',
        message: 'Só estou desabafando. Não quero que você faça nada.',
        history: [],
      }),
    });
    const blockedVentBody = await readResponseText(blockedVentResponse);
    assert.equal(blockedVentResponse.status, 200);
    assert.equal(updatedBlocks.length, 1);
    assert.match(blockedVentBody, /ask_clarification/);
    assert.doesNotMatch(blockedVentBody, /Pronto, movi a tarefa/);

    const blockedEnglishNegationResponse = await fetch(`${baseUrl}/api/aura/command/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({
        sessionId: '7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d15',
        message: 'I do not want you to create a task. Just hear me out.',
        locale: 'en-US',
        history: [],
      }),
    });
    const blockedEnglishNegationBody = await readResponseText(blockedEnglishNegationResponse);
    assert.equal(blockedEnglishNegationResponse.status, 200);
    assert.equal(updatedBlocks.length, 1);
    assert.match(blockedEnglishNegationBody, /ask_clarification/);
    assert.match(blockedEnglishNegationBody, /I won't turn this into a task/i);
    assert.doesNotMatch(blockedEnglishNegationBody, /Pronto, movi a tarefa/);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
    if (previousOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previousOpenAiKey;
  }
}

run()
  .then(() => {
    console.log('index.aura-command tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
