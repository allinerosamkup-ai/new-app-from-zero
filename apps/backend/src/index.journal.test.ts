import assert from 'node:assert/strict';
import http from 'node:http';

import { createApp } from './index';

async function readResponseText(response: Response): Promise<string> {
  return await response.text();
}

async function run() {
  const savedMessages: any[] = [];
  const retrievedQueries: string[] = [];
  let capturedJournalContext = '';
  let capturedPlannerContext = '';
  const sessionId = '7a0f7c1e-1f25-4d9a-8b9a-b3d2df6a7d11';

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
        localDate: new Date('2026-03-13T00:00:00.000Z'),
        moodScore: 3,
        energyScore: 2,
        sleepScore: 2,
        stateLabel: 'Dia sensível',
        stateLabelType: 'sensível',
        stateSummary: 'Energia mais baixa no começo do dia.',
      }),
    },
    timelineBlock: {
      findMany: async () => [],
    },
    journalMessage: {
      create: async ({ data }: any) => {
        savedMessages.push(data);
        return { id: String(savedMessages.length), ...data };
      },
      findMany: async () => savedMessages,
    },
    journalSession: {
      findUnique: async () => ({ id: sessionId, userId: '550e8400-e29b-41d4-a716-446655440000' }),
      update: async ({ where }: any) => ({ id: where.id }),
    },
  };

  const app = createApp({
    authMiddleware: (req: any, _res: any, next: any) => {
      req.userId = req.body?.userId ?? '550e8400-e29b-41d4-a716-446655440000';
      next();
    },
    prisma: prisma as any,
    aiService: {
      summarizeJournalSession: async () => ({
        summary: 'Resumo',
        emotions: ['ansiosa', 'aliviada'],
        themes: ['trabalho'],
        suggestions: ['Respire por alguns minutos.'],
      }),
      streamJournalReply: async ({ context, onDelta }: any) => {
        capturedJournalContext = context.journalContext ?? '';
        capturedPlannerContext = context.plannerContext ?? '';
        onDelta?.('Olá, ');
        onDelta?.('estou com você.');
        return 'Olá, estou com você.';
      },
    } as any,
    journalService: {
      startOrResumeSession: async () => ({
        created: false,
        session: {
          id: sessionId,
          userId: '550e8400-e29b-41d4-a716-446655440000',
          status: 'active',
          localDate: new Date('2026-03-13T00:00:00.000Z'),
        },
      }),
      buildRoutineContext: async () => ({
        routineSummary: 'Costuma render melhor no fim da manhã.',
        promptSummary: 'Rotina percebida: Costuma render melhor no fim da manhã.',
        topThemes: ['trabalho'],
        topPlannerCategories: ['trabalho'],
        activeGoals: ['Resolver audiência'],
        recentSessionHistory: '[ontem] Audiência trouxe medo de não conseguir sustentar o ponto.',
        checkinToday: {
          moodScore: 3,
          energyScore: 2,
          stateLabel: 'Dia sensível',
        },
      }),
      getSessionMessages: async () => [],
      nextOrderIndex: (messages: Array<{ orderIndex: number }>) =>
        messages.length === 0 ? 0 : Math.max(...messages.map((message) => message.orderIndex)) + 1,
    } as any,
    memoryService: {
      store: async () => {},
      retrieve: async (_userId: string, query: string) => {
        retrievedQueries.push(query);
        return [];
      },
      formatForPrompt: (memories: any[]) => memories.map((memory) => memory.content).join('\n'),
      deleteAll: async () => {},
    },
    generateJournalSuggestedTasks: async () => ([
      { title: 'Separar uma tarefa pequena', category: 'rotina', time: '09:00', dayOffset: 0 },
    ]),
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('failed to open test server');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const startResponse = await fetch(`${baseUrl}/api/journal/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: '550e8400-e29b-41d4-a716-446655440000',
      }),
    });

    assert.equal(startResponse.status, 200);

    const startJson = await startResponse.json();
    assert.equal(startJson.sessionId, sessionId);
    assert.equal(startJson.context.checkinToday.stateLabel, 'Dia sensível');

    const streamResponse = await fetch(`${baseUrl}/api/journal/message/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        sessionId,
        message: 'Por hoje é isso, já terminei.',
        localDate: '2026-03-13',
        currentHour: 21,
        currentMinute: 10,
        phase: 'Pausa',
      }),
    });

    assert.equal(streamResponse.status, 200);
    assert.equal(streamResponse.headers.get('content-type'), 'text/event-stream; charset=utf-8');

    const streamBody = await readResponseText(streamResponse);

    assert.match(streamBody, /event: assistant\.delta/);
    assert.match(streamBody, /event: assistant\.completed/);
    assert.doesNotMatch(streamBody, /event: session\.finalized/);
    assert.equal(savedMessages.length, 2);
    assert.equal(savedMessages[0].role, 'user');
    assert.equal(savedMessages[1].role, 'assistant');
    assert.equal(savedMessages[1].content, 'Olá, estou com você.');
    assert.ok(retrievedQueries.length >= 2);
    assert.match(retrievedQueries.join('\n'), /padrões recorrentes/i);
    assert.match(capturedJournalContext, /Mensagem atual: Por hoje é isso/i);
    assert.match(capturedJournalContext, /RAG vetorial não trouxe fragmentos/i);
    assert.match(capturedJournalContext, /Audiência trouxe medo/i);
    assert.match(capturedJournalContext, /Chão operacional/i);
    assert.equal(capturedPlannerContext, '');

    const longStreamResponse = await fetch(`${baseUrl}/api/journal/message/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        sessionId,
        message: 'entrada longa no diário '.repeat(650),
      }),
    });

    assert.equal(longStreamResponse.status, 200);

    const finalizeResponse = await fetch(`${baseUrl}/api/journal/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    assert.equal(finalizeResponse.status, 200);
    const finalizeJson = await finalizeResponse.json();
    assert.equal(finalizeJson.sessionStatus, 'completed');
    assert.equal(finalizeJson.suggestedTasks[0].title, 'Separar uma tarefa pequena');
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
  }
}

run()
  .then(() => {
    console.log('index.journal tests passed');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
